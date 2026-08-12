/**
 * UiNameCell — primary-name cell with detail link.
 */
import React from 'react';

export const UiNameCell: React.FC<{
  icon?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  secondaryAsCode?: boolean;
}> = ({ icon, primary, secondary, secondaryAsCode }) => (
  <div className="ui-name-cell">
    {icon && <div className="ui-name-icon">{icon}</div>}
    <div>
      <div className="ui-name-primary">{primary}</div>
      {secondary && (
        <div className="ui-name-secondary">{secondaryAsCode ? <code>{secondary}</code> : secondary}</div>
      )}
    </div>
  </div>
);

export default UiNameCell;
