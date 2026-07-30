-- Add data_model_id column to console_menus
ALTER TABLE "core"."console_menus" ADD COLUMN IF NOT EXISTS "data_model_id" TEXT;

-- Change default action_type to 'data_model'
ALTER TABLE "core"."console_menus" ALTER COLUMN "action_type" SET DEFAULT 'data_model';

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'console_menus_data_model_id_fkey'
  ) THEN
    ALTER TABLE "core"."console_menus"
      ADD CONSTRAINT "console_menus_data_model_id_fkey"
      FOREIGN KEY ("data_model_id") REFERENCES "core"."tables"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
