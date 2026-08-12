-- CreateTable
CREATE TABLE core.computed_recompute_queue (
    id TEXT NOT NULL DEFAULT gen_random_uuid(),
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT computed_recompute_queue_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE UNIQUE INDEX computed_recompute_queue_schema_name_table_name_record_id_key ON core.computed_recompute_queue(schema_name, table_name, record_id);

-- CreateIndex
CREATE INDEX computed_recompute_queue_created_at_idx ON core.computed_recompute_queue(created_at);

-- Trigger function backing the Expression-field recompute engine.
--
-- Attached to a *referenced* table B via
--   CREATE TRIGGER ... BEFORE INSERT OR UPDATE OR DELETE ON <schema>.B
--   FOR EACH ROW EXECUTE FUNCTION core.enqueue_computed_change(<schemaA>, <tableA>, <relField>)
--
-- For every write to B, the function enqueues the rows of dependent table A
-- whose relation field points at the changed row, then notifies the worker.
-- BEFORE DELETE captures affected ids before the ON DELETE SET NULL cascade
-- erases the FK linkage. SECURITY DEFINER lets the trigger read dependent
-- tables and write the queue regardless of the writing role's privileges.
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
      || 'SELECT %L, %L, id, now() FROM %I.%I WHERE %I = $1 '
      || 'ON CONFLICT DO NOTHING',
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
