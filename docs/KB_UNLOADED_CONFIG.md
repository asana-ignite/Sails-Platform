# KB: Unloaded Configuration (Empty Navigation / Mock Data Fallback)

**Audience:** AI agents and developers debugging why the Console sidebar shows no apps, wrong apps (e.g., only "Dashboard" and "CRM"), or why `GET /api/console/config` returns `0 apps` / mock data.

This incident has recurred multiple times. Follow the diagnosis order below — do not improvise fixes before identifying which root cause applies.

---

## 1. Symptoms

| Symptom | Meaning |
|---|---|
| Sidebar shows no apps/menus | Config API returned empty `apps` array |
| Sidebar shows "Dashboard" + "CRM" + minimal "Settings & Admin" | **Mock fallback active** — DB query returned 0 rows, `getMockData()` was used |
| Logs show `[CONFIG] Returning 0 apps` | Query or filtering produced nothing |
| `The column X does not exist` / `The table core.Y does not exist` | **Schema drift** — DB predates `prisma/schema.prisma` |
| Login works but data is wrong | **Stale JWT** — session holds pre-restore tenant/user IDs |

---

## 2. Root Causes (in observed frequency)

### 2.1 Stale JWT session after DB restore/rebuild
- Browser cookie holds a JWT signed with `NEXTAUTH_SECRET`. After a DB restore, the JWT's `token.id` may reference a user record that no longer exists.
- The `jwt` callback in `authOptions.ts` refreshes `tenantId` from DB **only if `db.user.findUnique(token.id)` succeeds**. If the ID is missing, stale values persist silently.
- **Result:** `session.user.tenantId` points at a non-existent tenant → DB query returns 0 apps → mock data fallback.
- **Fix:** Sign out, sign in. That is all. Do NOT patch code for this.

### 2.2 Stale `DEFAULT_TENANT_ID` in `packages/core/.env`
- Unauthenticated requests fall back to this tenant. After restoring a different dataset, it points at a deleted tenant.
- **Fix:** Set it to the live tenant ID (`SELECT id FROM core.tenants;`), restart `sails-core`.

### 2.3 Schema drift (DB older than `prisma/schema.prisma`)
- Restoring an old `pg_dump` brings old table structures. Newer models/columns (`table_layouts`, `positions`, `company_profiles`, `is_system`, `read_scope`/`modify_scope` enums on `object_permissions`) are missing.
- `prisma migrate status` reports "up to date" because `_prisma_migrations` rows came with the dump — **it does not detect drift**.
- **Diagnosis (the only reliable check):**
  ```bash
  docker exec sails-core sh -c "cd packages/core && bun x prisma migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma --script"
  ```
  Output must be `-- This is an empty migration.` Anything else is drift.
- **Fix:** Apply the missing DDL manually (see §4). `prisma db push` will FAIL if RLS policies depend on columns it tries to drop — drop those policies first, recreate them after.

### 2.4 Auto-mutation code inside runtime API paths (AI-generated anti-pattern)
- An AI agent added `ensurePlatformStudioMenus()` (auto-seeding menus) into `GET /api/console/config` and `GET /api/console/menus`, with a write-then-refetch pattern in one request. The re-fetch returned 0 rows inside the Next.js request context, blanking the entire navigation.
- **Rule: NEVER run writes, seeding, "auto-repair", or "auto-migration" inside runtime GET handlers.** Schema/menu changes belong in migrations, seed scripts, or explicit admin actions — never inline in read paths.
- If the nav suddenly returns 0 apps after a code change to `route.ts`, revert the change first.

### 2.5 Docker compose project / volume mismatch
- Containers may belong to a different compose project (e.g. created from a since-renamed directory) and mount different volumes than expected. Code edits on the host then have no effect, and `docker compose up` conflicts on container names.
- **Diagnosis:** `docker inspect sails-db --format '{{.Config.Labels}}' | tr ',' '\n' | grep compose` — check `com.docker.compose.project` and volume source paths.
- **Fix:** `docker rm -f` the stale containers, then `docker compose up -d` from the correct directory. Volumes survive; data is safe.

### 2.6 pg_dump full-backup cannot run as an init script
- `full_database_backup.sql` starts with `DROP DATABASE IF EXISTS postgres;` which fails when executed by `/docker-entrypoint-initdb.d` (connected to that very database). It also contains `\restrict`/`\unrestrict` wrapper lines psql rejects.
- **The init-restore mount has been removed from `docker-compose.yml`.** Restore manually instead (see §4).

---

## 3. Diagnosis Checklist (run in order)

```bash
# 1. Containers healthy and from the right project?
docker ps --format "table {{.Names}}\t{{.Status}}"
docker inspect sails-db --format '{{.Config.Labels}}' | tr ',' '\n' | grep compose.project

# 2. What does the API actually return?
curl -s http://localhost:3000/api/console/config | python3 -m json.tool | head -20

# 3. What does the core log say?
docker logs sails-core --since 5m 2>&1 | grep -E "CONFIG|error|Error" | tail -10

# 4. Is there schema drift?
docker exec sails-core sh -c "cd packages/core && bun x prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script"

# 5. Does .env point at a live tenant?
docker exec sails-db psql -U postgres -c "SELECT id, name, schema_name FROM core.tenants;"
grep DEFAULT_TENANT_ID packages/core/.env
```

Reading the log output:
- `[CONFIG] Fetched 5 apps ... Returning 4 apps` → healthy (Settings & Admin is hidden for anonymous; expected).
- `[CONFIG] Returning 0 apps` with a real user → stale JWT (sign out/in) or wrong tenant.
- Apps named Dashboard/CRM with 1–2 menus → mock fallback; DB query found nothing.

---

## 4. Standard Fixes

### Backup (standard procedure)

Always use the script — it splits schema and data and timestamps both files:

```bash
./scripts/backup-db.sh
# → backups/sails_schema_YYYYMMDD_HHMMSS.sql
# → backups/sails_data_YYYYMMDD_HHMMSS.sql
```

### Restore from the split backup files

```bash
docker stop sails-core sails-console

# 1. Drop existing schemas (list tenant schemas first: \dn in psql)
docker exec sails-db psql -U postgres -c "DROP SCHEMA IF EXISTS core CASCADE;"
docker exec sails-db psql -U postgres -c "DROP SCHEMA IF EXISTS tenant_sails_default CASCADE;"

# 2. Apply schema, then data
cat backups/sails_schema_<TIMESTAMP>.sql | docker exec -i sails-db psql -U postgres -v ON_ERROR_STOP=1
cat backups/sails_data_<TIMESTAMP>.sql   | docker exec -i sails-db psql -U postgres -v ON_ERROR_STOP=1

# 3. Sync any drift introduced since the backup (new Prisma models/columns)
docker exec sails-core sh -c "cd packages/core && bun x prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script"
# (apply the emitted ALTER/CREATE statements manually via psql if any)

# 4. Align .env tenant + restart
docker start sails-core sails-console
```

### Restore the legacy monolithic backup (full_database_backup.sql)
```bash
docker stop sails-core sails-console
docker exec sails-db psql -U postgres -c "DROP SCHEMA IF EXISTS core CASCADE;"
# strip header (DROP/CREATE DATABASE + \restrict markers) and trailing \unrestrict
sed '1,34d; 1343d' backups/full_database_backup.sql | docker exec -i sails-db psql -U postgres
# then fix schema drift per §2.3, update .env, restart
docker start sails-core sails-console
```

### Sync schema drift manually
```bash
# Generate the diff, review it, then apply via psql. Watch for RLS policies
# depending on columns being dropped — drop policies first, recreate after.
docker exec sails-core sh -c "cd packages/core && bun x prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script"
```

### RLS policy gotcha (object_permissions)
- Policies reference `core.object_permissions`. The current schema uses `read_scope`/`modify_scope` (`core."AccessScope"` enum) — older dumps use `view_all_data`/`modify_all_data` booleans.
- After adding `tenant_id` to `object_permissions`, any policy with an unqualified `tenant_id` in a subquery becomes **ambiguous** — qualify as `"Lead".tenant_id` / `t.tenant_id`.

### Reset a tenant admin password
```bash
docker exec sails-core sh -c "cd /app/packages/core && bun -e \"
import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('Welcome2Ignite', 12));\""
docker exec sails-db psql -U postgres -c \
  "UPDATE core.users SET password = '<hash>' WHERE email = 'admin@klao.app';"
```

---

## 5. Container Rebuild Runbook (fast path)

```bash
# 1. Recreate containers (volumes persist — data is safe)
docker rm -f sails-core sails-console sails-db
docker compose up -d

# 2. Wait for db healthy, then verify drift
docker exec sails-core sh -c "cd packages/core && bun x prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script"
# expect: -- This is an empty migration.

# 3. Verify tenant + env alignment
docker exec sails-db psql -U postgres -c "SELECT id, name FROM core.tenants;"
grep DEFAULT_TENANT_ID packages/core/.env

# 4. Verify API
curl -s http://localhost:3000/api/console/config | python3 -m json.tool | head -10
```

If all four pass and the UI is still wrong → **stale browser JWT. Sign out and sign in.**

---

## 6. Hard Rules for AI Agents

1. **Never** add seeding / "auto-repair" / "auto-migration" logic into runtime API handlers (`route.ts`). Use migrations or one-off scripts.
2. **Never** `docker restart sails-core` as a way to "apply" changes — bun dev containers can fail on restart. Use `docker rm -f <c> && docker compose up -d <service>`.
3. **Always** check the compose project name and volume mounts before concluding code isn't reloading.
4. **Always** run `prisma migrate diff` (not `migrate status`) to verify schema sync after any restore.
5. **Never** modify RLS policies without checking every column they reference — adding a column to a joined table can make existing policies ambiguous.
6. When the user reports "no data", check the API response and core logs **before** changing any code.
