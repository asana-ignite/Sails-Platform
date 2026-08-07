-- Email Connections — tenant SMTP / OAuth email settings.
-- SMTP credentials are encrypted at rest (AES-256-GCM, keyed by ENCRYPTION_KEY).
-- Configuration only — customer notification data lives in tenant schemas.

-- CreateTable
CREATE TABLE "core"."email_connections" (
    "id"                  TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "provider"            TEXT NOT NULL DEFAULT 'smtp',
    "is_default"          BOOLEAN NOT NULL DEFAULT false,
    "is_active"           BOOLEAN NOT NULL DEFAULT true,
    "smtp_host"           TEXT,
    "smtp_port"           INTEGER,
    "smtp_secure"         BOOLEAN DEFAULT false,
    "auth_type"           TEXT,
    "username"            TEXT,
    "password"            TEXT,
    "oauth_client_id"     TEXT,
    "oauth_client_secret" TEXT,
    "oauth_tenant_id"     TEXT,
    "oauth_refresh_token" TEXT,
    "oauth_access_token"  TEXT,
    "oauth_token_expiry"  TIMESTAMP(3),
    "from_name"           TEXT NOT NULL,
    "from_email"          TEXT NOT NULL,
    "reply_to"            TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_connections_tenant_id_is_active_idx" ON "core"."email_connections"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "core"."email_connections" ADD CONSTRAINT "email_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
