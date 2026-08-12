-- Reverse-dependency trigger function for the Expression-field recompute
-- engine (rollup support via $related('child_table', 'fk_field')).
--
-- Attached to a *child* table C via
--   CREATE TRIGGER ... BEFORE INSERT OR UPDATE OR DELETE ON <schema>.C
--   FOR EACH ROW EXECUTE FUNCTION core.enqueue_computed_reverse_change(<schemaP>, <parentTable>, <fkFieldOnChild>)
--
-- When a child row changes, the PARENT rows referencing it (parent.id =
-- NEW/OLD.<fkFieldOnChild>) are enqueued for recompute — the inverse of the
-- forward trigger, where the FK lives on the dependent table.
-- SECURITY DEFINER: system recompute must never depend on the writer's role.
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
        || 'SELECT %L, %L, $1, now() ON CONFLICT DO NOTHING',
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
