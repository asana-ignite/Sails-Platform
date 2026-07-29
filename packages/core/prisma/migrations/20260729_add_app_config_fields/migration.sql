ALTER TABLE core.console_apps
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS console_apps_tenant_id_slug_key 
  ON core.console_apps(tenant_id, slug)
  WHERE slug IS NOT NULL;
