/**
 * UiToast — toast notification host.
 */
import React from 'react';

export const UiToast: React.FC<{ message: string | null; tone?: 'success' | 'error' }> = ({ message, tone = 'success' }) => {
  if (!message) return null;
  return (
    <div className={`ui-toast ui-toast--${tone}`}>
      <span>{message}</span>
    </div>
  );
};

export default UiToast;
