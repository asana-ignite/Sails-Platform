ALTER TABLE core.console_apps
  ADD COLUMN translation_key TEXT;

ALTER TABLE core.console_menus
  ADD COLUMN translation_key TEXT;

ALTER TABLE core.console_widgets
  ADD COLUMN translation_key TEXT;

ALTER TABLE core.users
  ADD COLUMN locale TEXT DEFAULT 'en';

ALTER TABLE core.company_profiles
  ADD COLUMN default_locale TEXT DEFAULT 'en';
