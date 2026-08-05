import React from 'react';
import { useRecordStack } from '../../contexts/RecordStackContext';
import { resolveDefaultDetailLayout } from '../../utils/recordNavigation';
import ListViewEngine from '../list/ListViewEngine';

interface RelatedListViewProps {
  /** Child model (physical tableName) owning the FK field. */
  tableName: string;
  /** FK field on the child model pointing at the parent record. */
  fieldName: string;
  /** LIST layout id (or systemName) of the child model to embed. */
  viewId?: string;
  /** Id of the currently open parent record. */
  parentRecordId: string;
  /** Display title (falls back to child model name). */
  title?: string;
}

/**
 * "Related List View" detail block. Renders the selected LIST view through the
 * shared ListViewEngine, filtered to records whose FK field points at the
 * current parent record. Paging, filters, sort, actions, and inline
 * edit/create all behave exactly like the full list page.
 */
const RelatedListView: React.FC<RelatedListViewProps> = ({
  tableName,
  fieldName,
  viewId,
  parentRecordId,
  title,
}) => {
  const { pushRecord } = useRecordStack();

  return (
    <ListViewEngine
      tableName={tableName}
      layoutId={viewId}
      related={{ fieldName, parentRecordId }}
      title={title || tableName}
      embedded
      onRecordOpen={(rec, detailLayoutKey) => {
        if (!rec?.id) return;
        if (detailLayoutKey) {
          pushRecord({ tableName, layoutKey: detailLayoutKey, recordId: rec.id });
          return;
        }
        resolveDefaultDetailLayout(tableName).then((detail) => {
          if (detail?.systemName) {
            pushRecord({ tableName, layoutKey: detail.systemName, recordId: rec.id });
          }
        });
      }}
    />
  );
};

export default RelatedListView;
