import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './CustomSelect.css';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (value: any) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  className = '',
  size = 'md',
  disabled = false,
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      className={`klao-custom-select klao-custom-select--${size} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`} 
      ref={containerRef}
      style={style}
    >
      <button
        type="button"
        className="klao-custom-select__trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="klao-custom-select__value">
          {selectedOption ? (
            <span className="klao-custom-select__value-content">
              {selectedOption.icon && <span className="klao-custom-select__option-icon">{selectedOption.icon}</span>}
              {selectedOption.label}
            </span>
          ) : (
            <span className="klao-custom-select__placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className="klao-custom-select__chevron" />
      </button>

      {isOpen && (
        <div className="klao-custom-select__dropdown animate-fade-in">
          {options.map(option => {
            const isSelected = String(option.value) === String(value);
            return (
              <div
                key={String(option.value)}
                className={`klao-custom-select__option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <div className="klao-custom-select__option-content">
                  {option.icon && <span className="klao-custom-select__option-icon">{option.icon}</span>}
                  <span>{option.label}</span>
                </div>
                {isSelected && <Check size={14} className="klao-custom-select__check" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
