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
  searchable?: boolean;
  direction?: 'down' | 'up' | 'auto';
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
  searchable = false,
  direction = 'auto',
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [computedDropUp, setComputedDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isValueMatch = (val1: string | number, val2: string | number) => {
    if (val1 === undefined || val1 === null || val2 === undefined || val2 === null) return false;
    return String(val1).trim().toLowerCase() === String(val2).trim().toLowerCase();
  };

  const selectedOption = options.find(opt => isValueMatch(opt.value, value));

  const filteredOptions = searchable && searchQuery
    ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || String(opt.value).toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (direction === 'up') {
        setComputedDropUp(true);
      } else if (direction === 'down') {
        setComputedDropUp(false);
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setComputedDropUp(spaceBelow < 220);
      }
    }
  }, [isOpen, direction]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const dropClass = computedDropUp ? 'sails-custom-select--dropup' : '';

  return (
    <div 
      className={`sails-custom-select sails-custom-select--${size} ${dropClass} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`} 
      ref={containerRef}
      style={style}
    >
      <button
        type="button"
        className="sails-custom-select__trigger"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (isOpen) setSearchQuery('');
          }
        }}
        disabled={disabled}
      >
        <span className="sails-custom-select__value">
          {selectedOption ? (
            <span className="sails-custom-select__value-content">
              {selectedOption.icon && <span className="sails-custom-select__option-icon">{selectedOption.icon}</span>}
              {selectedOption.label}
            </span>
          ) : (
            <span className="sails-custom-select__placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className="sails-custom-select__chevron" />
      </button>

      {isOpen && (
        <div className="sails-custom-select__dropdown animate-fade-in">
          {searchable && (
            <div className="sails-custom-select__search-wrapper" onClick={e => e.stopPropagation()}>
              <input
                ref={searchInputRef}
                type="text"
                className="sails-custom-select__search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
          <div className="sails-custom-select__options-list">
            {filteredOptions.length === 0 ? (
              <div className="sails-custom-select__no-results">No matches found</div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = isValueMatch(option.value, value);
                return (
                  <div
                    key={String(option.value)}
                    className={`sails-custom-select__option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="sails-custom-select__option-content">
                      {option.icon && <span className="sails-custom-select__option-icon">{option.icon}</span>}
                      <span>{option.label}</span>
                    </div>
                    {isSelected && <Check size={14} className="sails-custom-select__check" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
