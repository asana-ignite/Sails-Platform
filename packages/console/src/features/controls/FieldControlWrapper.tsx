import React from 'react';
import type { FieldControlProps } from './types';

interface FieldControlWrapperProps extends FieldControlProps {
  children: React.ReactNode;
}

export const FieldControlWrapper: React.FC<FieldControlWrapperProps> = ({
  error,
  size = 'md',
  variant = 'glass',
  disabled,
  readOnly,
  className = '',
  children,
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-[11px] rounded-md',
    md: 'px-3 py-1.5 text-xs rounded-lg',
    lg: 'px-4 py-2.5 text-sm rounded-xl',
  }[size];

  const variantClasses = {
    default: 'bg-slate-900 border-slate-700 text-slate-200',
    ghost: 'bg-transparent border-transparent text-slate-200 hover:bg-slate-800/40',
    glass: 'bg-slate-900/90 backdrop-blur-sm border-slate-700/80 text-slate-200',
  }[variant];

  const errorClasses = error
    ? 'border-red-500/80 ring-1 ring-red-500/20 focus-within:border-red-500'
    : 'focus-within:border-cyan-500/80 focus-within:ring-1 focus-within:ring-cyan-500/20';

  const stateClasses = disabled || readOnly
    ? 'opacity-60 cursor-not-allowed select-none'
    : 'transition-all duration-150';

  return (
    <div className="w-full flex flex-col gap-1">
      <div
        className={`sails-control-wrapper flex items-center border ${sizeClasses} ${variantClasses} ${errorClasses} ${stateClasses} ${className}`}
      >
        {children}
      </div>
      {error && (
        <span className="text-[11px] font-medium text-red-400 pl-1">
          {error}
        </span>
      )}
    </div>
  );
};
