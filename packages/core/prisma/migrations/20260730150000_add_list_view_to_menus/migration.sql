-- Add list_view_id to console_menus
ALTER TABLE "core"."console_menus" ADD COLUMN IF NOT EXISTS "list_view_id" TEXT;
