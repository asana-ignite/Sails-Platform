/**
 * UiEmptyState — empty table placeholder.
 */
import React from 'react';

export const UiEmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}> = ({ icon, title, text, action }) => (
  <div className="ui-empty">
    <div className="ui-empty__icon">{icon}</div>
    <h3 className="ui-empty__title">{title}</h3>
    <p className="ui-empty__text">{text}</p>
    {action}
  </div>
);

export default UiEmptyState;
