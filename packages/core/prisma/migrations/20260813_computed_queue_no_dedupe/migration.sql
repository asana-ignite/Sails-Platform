-- Recompute queue: drop trigger-time dedupe.
--
-- The unique index + ON CONFLICT DO NOTHING in the enqueue triggers raced the
-- worker: a second write to the same record landing while the first queue row
-- was still pending was silently dropped, so that change was never recomputed.
-- The worker now dedupes at DRAIN time (DISTINCT ON) and recomputation is
-- idempotent, so redundant rows are harmless.

-- DropIndex
DROP INDEX IF EXISTS core.computed_recompute_queue_schema_name_table_name_record_id_key;

-- Redefine the forward enqueue trigger function without ON CONFLICT.
CREATE OR REPLACE FUNCTION core.enqueue_computed_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
DECLARE
  ref_id text;
  dep_schema text;
  dep_table text;
  dep_field text;
  n integer;
  i integer := 0;
BEGIN
  ref_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  n := array_length(TG_ARGV, 1);
  IF n IS NULL OR n % 3 <> 0 THEN
    RAISE WARNING 'enqueue_computed_change: TG_ARGV must be (dependent_schema, dependent_table, dependent_field) triplets';
    RETURN COALESCE(NEW, OLD);
  END IF;
  WHILE i < n LOOP
    dep_schema := TG_ARGV[i];
    dep_table := TG_ARGV[i + 1];
    dep_field := TG_ARGV[i + 2];
    EXECUTE format(
      'INSERT INTO core.computed_recompute_queue (schema_name, table_name, record_id, created_at) '
      || 'SELECT %L, %L, id, now() FROM %I.%I WHERE %I = $1',
      dep_schema,
      dep_table,
      dep_schema,
      dep_table,
      dep_field
    ) USING ref_id;
    i := i + 3;
  END LOOP;
  PERFORM pg_notify('sails_computed_recompute', ref_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Redefine the reverse (rollup) enqueue trigger function without ON CONFLICT.
CREATE OR REPLACE FUNCTION core.enqueue_computed_reverse_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
DECLARE
  parent_schema text;
  parent_table text;
  fk_field text;
  parent_id text;
  row record;
  n integer;
  i integer := 0;
BEGIN
  n := array_length(TG_ARGV, 1);
  IF n IS NULL OR n % 3 <> 0 THEN
    RAISE WARNING 'enqueue_computed_reverse_change: TG_ARGV must be (parent_schema, parent_table, fk_field_on_child) triplets';
    RETURN COALESCE(NEW, OLD);
  END IF;
  row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  WHILE i < n LOOP
    parent_schema := TG_ARGV[i];
    parent_table := TG_ARGV[i + 1];
    fk_field := TG_ARGV[i + 2];
    EXECUTE format('SELECT ($1).%I', fk_field) INTO parent_id USING row;
    IF parent_id IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO core.computed_recompute_queue (schema_name, table_name, record_id, created_at) '
        || 'SELECT %L, %L, $1, now()',
        parent_schema,
        parent_table
      ) USING parent_id;
    END IF;
    i := i + 3;
  END LOOP;
  PERFORM pg_notify('sails_computed_recompute', '');
  RETURN COALESCE(NEW, OLD);
END;
$$;
