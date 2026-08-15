-- AlterTable: localized (i18n) variants of user-authored labels/descriptions.
-- Resolution: requested locale → tenant default → 'en' → legacy plain string.
ALTER TABLE core.tables ADD COLUMN name_i18n JSONB;
ALTER TABLE core.tables ADD COLUMN description_i18n JSONB;
ALTER TABLE core.fields ADD COLUMN name_i18n JSONB;
ALTER TABLE core.fields ADD COLUMN description_i18n JSONB;
ALTER TABLE core.validation_rules ADD COLUMN error_message_i18n JSONB;
ALTER TABLE core.console_apps ADD COLUMN name_i18n JSONB;
ALTER TABLE core.console_apps ADD COLUMN description_i18n JSONB;
ALTER TABLE core.console_menus ADD COLUMN label_i18n JSONB;
