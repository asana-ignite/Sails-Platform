-- SAILS Platform: System Name snake_case Database Data & Physical DDL Migration Script

BEGIN;

-- 1. Migrate core metadata tables
UPDATE core.tables SET table_name = 'test_model' WHERE id = 'cmrxlsnzg001pky2fatd2pv1g';
UPDATE core.tables SET table_name = 'trip_rate' WHERE id = 'cmryejgzr000dky2dayuvrqlw';
UPDATE core.tables SET table_name = 'test_type' WHERE id = 'cmsa8prp80025o72d8a2dbhmc';

-- 2. Migrate core metadata fields
UPDATE core.fields SET field_name = 'trip_no' WHERE id = 'cms2wwsl40001ky2e3d6dv27v';
UPDATE core.fields SET field_name = 'record_number' WHERE id = 'cms6ax8yq0005r02dondtd932';
UPDATE core.fields SET field_name = 'is_active' WHERE id = 'cms6axm4g0007r02dybcpv8cw';

-- 3. Migrate core metadata layouts
UPDATE core.table_layouts SET system_name = 'invoice_list' WHERE id = 'cms6a3zkk0003r02d3kl1xng7';
UPDATE core.table_layouts SET system_name = 'test_model_list_view' WHERE id = 'cms6b7d04000br02diuo5apmp';
UPDATE core.table_layouts SET system_name = 'test_type_list_view' WHERE id = 'cmsagyl2m0039o72d30m1njwm';
UPDATE core.table_layouts SET system_name = 'trip_rate_detail' WHERE id = 'cms4n1m2y0001mp2djr7qluhq';
UPDATE core.table_layouts SET system_name = 'lead_detail' WHERE id = 'cms4ve7ti0003mm2b72xiw29t';
UPDATE core.table_layouts SET system_name = 'test_model_detail' WHERE id = 'cms973vaq0005qq2epulk6p95';
UPDATE core.table_layouts SET system_name = 'test_test_draft' WHERE id = 'cmsa5sw2k0023o72d9vncmhd2';
UPDATE core.table_layouts SET system_name = 'test_type_details_view' WHERE id = 'cmsagvu7g0037o72dgudd163i';

-- 4. Migrate core metadata console apps
UPDATE core.console_apps SET slug = 'settings_admin' WHERE id = 'cms2qi7fd0001kyus7p18c51d';
UPDATE core.console_apps SET slug = 'marketing' WHERE id = 'cmrxlbj8l000xky2fqbyiaolk';
UPDATE core.console_apps SET slug = 'services' WHERE id = 'cmrxlbjkv0019ky2fd12nicbb';
UPDATE core.console_apps SET slug = 'sales' WHERE id = 'cmrxlbibz0009ky2foq8415i9';
UPDATE core.console_apps SET slug = 'sales_manager' WHERE id = 'cmrxlbixn000lky2f9gct9p5d';

-- 5. Rename physical PostgreSQL tables in tenant schemas
ALTER TABLE IF EXISTS tenant_sails_default.testmodel RENAME TO test_model;
ALTER TABLE IF EXISTS tenant_sails_default.triprate RENAME TO trip_rate;
ALTER TABLE IF EXISTS tenant_sails_default.testtype RENAME TO test_type;

-- 6. Rename physical PostgreSQL columns in tenant schemas
ALTER TABLE IF EXISTS tenant_sails_default.test_model RENAME COLUMN recordnumber TO record_number;
ALTER TABLE IF EXISTS tenant_sails_default.test_model RENAME COLUMN isactive TO is_active;
ALTER TABLE IF EXISTS tenant_sails_default.trip_rate RENAME COLUMN tripno TO trip_no;

COMMIT;
