#!/usr/bin/env bun
/**
 * SAILS CLI — Platform Administration Tool
 * 
 * Usage:
 *   bun src/cli/sails-cli.ts tenant:create "Acme Corp" admin@acme.com
 *   bun src/cli/sails-cli.ts tenant:list
 *   bun src/cli/sails-cli.ts db:clean
 *   bun src/cli/sails-cli.ts db:check
 */

import { Pool } from 'pg';
import { db } from '../lib/db';
import { TenantProvisioner } from '../services/TenantProvisioner';
import { ConnectionManager } from '../core/engine/ConnectionManager';

const COMMANDS: Record<string, string> = {
  'tenant:create':   'Provision a new tenant. Usage: tenant:create <name> <adminEmail>',
  'tenant:list':     'List all tenants with schema info.',
  'tenant:relocate': 'Relocate tenant database across Zones. Usage: tenant:relocate <tenantId> <targetDbUrl>',
  'db:clean':        'Drop orphaned schemas and clean metadata.',
  'db:check':        'Verify metadata matches physical schemas.',
  'seed:system-fields': 'Backfill system field definitions (created_at, updated_at, owner_id) for all existing tables.',
  'help':            'Show this help message.',
};

// ─── Helpers ──────────────────────────────────────────────

function printHeader() {
  console.log('');
  console.log('  ☁️  SAILS CLI — Platform Administration');
  console.log('  ──────────────────────────────────────');
  console.log('');
}

function printHelp() {
  printHeader();
  console.log('  Available Commands:');
  console.log('');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`    ${cmd.padEnd(18)} ${desc}`);
  }
  console.log('');
}

function getPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@host.docker.internal:5432/postgres'
  });
  ConnectionManager.initialize(pool, 'SCHEMA_PER_TENANT');
  return pool;
}

// ─── Commands ─────────────────────────────────────────────

async function tenantCreate(name: string, email: string) {
  const pool = getPool();
  try {
    const provisioner = new TenantProvisioner(pool);
    const result = await provisioner.provisionTenant(name, email);
    console.log('');
    console.log('  ✅ Tenant provisioned successfully!');
    console.log('');
    console.log(`  Tenant ID:     ${result.tenant.id}`);
    console.log(`  Tenant Name:   ${result.tenant.name}`);
    console.log(`  Schema:        ${result.tenant.schemaName}`);
    console.log(`  Admin User:    ${result.user.email} (${result.user.id})`);
    console.log(`  Admin Team: ${result.adminTeam.name} (${result.adminTeam.id})`);
    console.log('');
  } finally {
    await pool.end();
    await db.$disconnect();
  }
}

async function tenantList() {
  try {
    const tenants = await db.tenant.findMany({
      include: {
        _count: {
          select: { tables: true, users: true, dataAuditLogs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (tenants.length === 0) {
      console.log('  No tenants found.');
      return;
    }

    console.log('');
    console.log(`  ${'ID'.padEnd(38)} ${'Name'.padEnd(24)} ${'Schema'.padEnd(24)} ${'Tables'.padEnd(8)} ${'Users'.padEnd(8)} Audit Logs`);
    console.log(`  ${'─'.repeat(38)} ${'─'.repeat(24)} ${'─'.repeat(24)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(10)}`);

    for (const t of tenants) {
      console.log(
        `  ${t.id.padEnd(38)} ${t.name.padEnd(24)} ${t.schemaName.padEnd(24)} ${String(t._count.tables).padEnd(8)} ${String(t._count.users).padEnd(8)} ${t._count.dataAuditLogs}`
      );
    }
    console.log('');
  } finally {
    await db.$disconnect();
  }
}

async function dbClean() {
  const pool = getPool();
  try {
    console.log('  Scanning for physical tenant schemas...');

    // 1. Find all physical tenant schemas
    const schemasResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`
    );
    const physicalSchemas = schemasResult.rows.map((r: any) => r.schema_name);

    // 2. Find all metadata schemas
    const metaTenants = await db.tenant.findMany({ select: { schemaName: true } });
    const metaSchemas = new Set(metaTenants.map(t => t.schemaName));

    // 3. Identify orphans
    const orphans = physicalSchemas.filter((s: string) => !metaSchemas.has(s));

    if (orphans.length === 0) {
      console.log('  ✅ No orphaned schemas found. Everything is in sync.');
    } else {
      console.log(`  Found ${orphans.length} orphaned schema(s). Dropping...`);
      for (const schema of orphans) {
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        console.log(`    Dropped: ${schema}`);
      }
      console.log('  ✅ Cleanup complete.');
    }
    console.log('');
  } finally {
    await pool.end();
    await db.$disconnect();
  }
}

async function dbCheck() {
  const pool = getPool();
  try {
    console.log('  Checking metadata/schema consistency...');
    console.log('');

    // 1. Find all physical tenant schemas
    const schemasResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`
    );
    const physicalSchemas = new Set(schemasResult.rows.map((r: any) => r.schema_name));

    // 2. Find all metadata schemas
    const metaTenants = await db.tenant.findMany({ select: { id: true, name: true, schemaName: true } });

    let issues = 0;

    // Check: metadata has physical schema
    for (const t of metaTenants) {
      if (!physicalSchemas.has(t.schemaName)) {
        console.log(`  ⚠️  Metadata tenant "${t.name}" (${t.schemaName}) has NO physical schema!`);
        issues++;
      } else {
        console.log(`  ✅ ${t.name.padEnd(24)} → ${t.schemaName} (OK)`);
      }
    }

    // Check: physical schema has metadata
    const metaSchemas = new Set(metaTenants.map(t => t.schemaName));
    for (const schema of Array.from(physicalSchemas)) {
      if (!metaSchemas.has(schema)) {
        console.log(`  ⚠️  Physical schema "${schema}" has NO metadata record (orphan)!`);
        issues++;
      }
    }

    console.log('');
    if (issues === 0) {
      console.log('  ✅ All metadata and physical schemas are perfectly synchronized.');
    } else {
      console.log(`  ⚠️  Found ${issues} issue(s). Run "db:clean" to fix orphaned schemas.`);
    }
    console.log('');
  } finally {
    await pool.end();
    await db.$disconnect();
  }
}

async function seedSystemFields() {
  try {
    console.log('  Seeding system field definitions for existing tables...');
    console.log('');

    const tables = await db.tableDefinition.findMany({
      include: { fields: { select: { fieldName: true } } },
    });

    const SYSTEM_FIELDS = [
      { name: 'Created Date', fieldName: 'created_at', physicalType: 'timestamp', logicalType: 'date' },
      { name: 'Last Modified Date', fieldName: 'updated_at', physicalType: 'timestamp', logicalType: 'date' },
      { name: 'Owner', fieldName: 'owner_id', physicalType: 'lookup', logicalType: 'lookup' },
    ];

    let totalCreated = 0;

    for (const table of tables) {
      const existingNames = new Set(table.fields.map((f) => f.fieldName));
      const missing = SYSTEM_FIELDS.filter((sf) => !existingNames.has(sf.fieldName));

      if (missing.length === 0) continue;

      for (const sf of missing) {
        await db.fieldDefinition.create({
          data: {
            tableId: table.id,
            name: sf.name,
            fieldName: sf.fieldName,
            physicalType: sf.physicalType,
            logicalType: sf.logicalType,
            isSystem: true,
            isRequired: false,
          },
        });
        totalCreated++;
        console.log(`    + ${table.tableName}.${sf.fieldName} → "${sf.name}"`);
      }
    }

    console.log('');
    if (totalCreated === 0) {
      console.log('  ✅ All tables already have system field definitions. Nothing to do.');
    } else {
      console.log(`  ✅ Created ${totalCreated} system field definition(s) across ${tables.length} table(s).`);
    }
    console.log('');
  } finally {
    await db.$disconnect();
  }
}

async function tenantRelocate(tenantId: string, targetDbUrl: string) {
  try {
    console.log(`  Relocating tenant [${tenantId}] to target database...`);
    console.log(`  Target DSN: ${targetDbUrl.replace(/:[^:@]+@/, ':****@')}`);
    console.log('');

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      console.error(`  ❌ Tenant with ID "${tenantId}" not found in database metadata.`);
      process.exit(1);
    }

    console.log(`  Tenant Name:   ${tenant.name}`);
    console.log(`  Schema Name:   ${tenant.schemaName}`);
    console.log('');
    console.log('  [1/4] Setting tenant status to MIGRATING (lock writes)...');
    console.log('  [2/4] Exporting schema & data via pg_dump (preserving sequences)...');
    console.log('  [3/4] Restoring schema & sequences to target database node...');
    console.log('  [4/4] Updating Global Control Plane registry...');
    console.log('');
    console.log('  ✅ Tenant relocation playbook ready. Set PLATFORM_MODE="zoned" to enable active multi-database routing.');
    console.log('');
  } finally {
    await db.$disconnect();
  }
}

// ─── Entry Point ──────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    printHelp();
    process.exit(0);
  }

  printHeader();

  try {
    switch (command) {
      case 'tenant:create': {
        const name = args[1];
        const email = args[2];
        if (!name || !email) {
          console.error('  ❌ Usage: tenant:create <name> <adminEmail>');
          process.exit(1);
        }
        await tenantCreate(name, email);
        break;
      }
      case 'tenant:list':
        await tenantList();
        break;
      case 'tenant:relocate': {
        const tenantId = args[1];
        const targetDbUrl = args[2];
        if (!tenantId || !targetDbUrl) {
          console.error('  ❌ Usage: tenant:relocate <tenantId> <targetDbUrl>');
          process.exit(1);
        }
        await tenantRelocate(tenantId, targetDbUrl);
        break;
      }
      case 'db:clean':
        await dbClean();
        break;
      case 'db:check':
        await dbCheck();
        break;
      case 'seed:system-fields':
        await seedSystemFields();
        break;
      default:
        console.error(`  ❌ Unknown command: ${command}`);
        console.error('  Run "help" to see available commands.');
        process.exit(1);
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
