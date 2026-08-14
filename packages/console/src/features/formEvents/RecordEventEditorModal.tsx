/**
 * RecordEventEditorModal — full Record Event editor for Layout Studio form
 * events, hosted in a Workflow-Studio-style modal. Reuses WorkflowEventWizard
 * so the mapping rail (sources / target columns / type checks / filters /
 * output mapping) is identical to Workflow Studio.
 *
 * Form-event "variables" are the sibling events' storeAs outputs, typed as
 * records (targetModel = the source event's model). Binding a result sets the
 * event's storeAs. Cancel restores the config snapshot taken at open.
 */
import React, { useRef } from 'react';
import type { FormEvent } from '@sails/shared';
import { WorkflowEventWizard, type WizardVariable } from '../../components/workflow/WorkflowEventWizard';
import type { DrillRoots } from '../../components/workflow/jsonataSuggest';
import type { PickerColumn, PickerSchemaMap } from '../../components/workflow/WorkflowVariablePicker';
import '../../pages/custom/WorkflowStudio.css';

interface RecordEventEditorModalProps {
  event: FormEvent;
  /** Sibling events' storeAs outputs — typed as records for the mapping rail. */
  variables: WizardVariable[];
  tables: { id: string; name: string; tableName: string; fields: any[] }[];
  triggerModel: { id: string; name: string; tableName: string; fields: any[] } | null;
  recordSchemas?: PickerSchemaMap;
  recordSchema?: PickerColumn[];
  drillRoots?: DrillRoots;
  /** Layout form controls for the Output step's "To Form Controls" mode. */
  formControls?: { fieldId: string; fieldName: string; name: string; logicalType: string; config?: any }[];
  onPatch: (patch: Partial<FormEvent>) => void;
  /**
   * Write-through for wizard parameter edits. Must be a FUNCTIONAL merge at
   * the host (the wizard fires several onConfigChange calls in one batch —
   * e.g. model change resets filterGroups + fieldMapping — so each write has
   * to land on the freshest config, never on a stale closure).
   */
  onConfigChange: (name: string, value: any) => void;
  onRemove: () => void;
  onClose: () => void;
  /** Host renders the Record Filter (FilterBuilder overlay) for this event id. */
  onOpenFilterBuilder: (eventId: string) => void;
}

export const RecordEventEditorModal: React.FC<RecordEventEditorModalProps> = ({
  event, variables, tables, triggerModel, recordSchemas, recordSchema, drillRoots, formControls,
  onPatch, onConfigChange, onRemove, onClose, onOpenFilterBuilder,
}) => {
  const originalConfigRef = useRef(event.config);
  const originalLabelRef = useRef(event.label);

  return (
    <div className="ls-modal-overlay" onClick={onClose}>
      <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ zIndex: 1000 }}>
        <WorkflowEventWizard
          eventId={event.id}
          eventType="record"
          config={event.config}
          label={event.label}
          onLabelChange={(label) => onPatch({ label })}
          description=""
          onDescriptionChange={() => undefined}
          variables={variables}
          tables={tables as any}
          triggerModel={triggerModel as any}
          hasOldRecord={false}
          recordSchemas={recordSchemas}
          recordSchema={recordSchema}
          drillRoots={drillRoots}
          formControls={formControls}
          formOutputOnly
          onCreateCollectionVariable={(name) => name}
          onCreateRecordVariable={(name) => name}
          onBindVariableToEvent={(varId) => onPatch({ storeAs: varId })}
          onOpenExpressionEditor={() => undefined}
          onOpenFilterBuilder={onOpenFilterBuilder}
          onConfigChange={onConfigChange}
          onSelectVariable={() => undefined}
          onDone={onClose}
          onRemove={() => { onRemove(); onClose(); }}
          onClose={() => {
            // Cancel — restore the config/label captured when the modal opened.
            onPatch({ config: originalConfigRef.current, label: originalLabelRef.current });
            onClose();
          }}
        />
      </div>
    </div>
  );
};

export default RecordEventEditorModal;
