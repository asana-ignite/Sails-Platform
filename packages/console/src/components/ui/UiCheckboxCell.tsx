/**
 * UiCheckboxCell — row selection checkbox cell.
 */
import React from 'react';

/** Checkbox header cell (select-all) or body cell (row select). */
export const UiCheckboxTh: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, indeterminate, onChange }) => (
  <th className="ui-th" style={{ width: 40, minWidth: 40 }}>
    <div className="ui-th-content" style={{ justifyContent: 'center' }}>
      <input
        type="checkbox"
        className="ui-checkbox"
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate && !checked; }}
        onChange={(e) => onChange(e.target.checked)}
        title="Select all on page"
      />
    </div>
  </th>
);

export const UiCheckboxTd: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ checked, onChange, onClick }) => (
  <td className="ui-td" style={{ width: 40, minWidth: 40, textAlign: 'center' }} onClick={onClick}>
    <input
      type="checkbox"
      className="ui-checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </td>
);

export default UiCheckboxTh;
