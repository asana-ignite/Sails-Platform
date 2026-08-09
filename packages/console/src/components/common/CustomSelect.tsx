import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropPos, setDropPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isValueMatch = (val1: string | number, val2: string | number) => {
    if (val1 === undefined || val1 === null || val2 === undefined || val2 === null) return false;
    return String(val1).trim().toLowerCase() === String(val2).trim().toLowerCase();
  };

  const selectedOption = options.find(opt => isValueMatch(opt.value, value));

  // An empty-value option whose label duplicates the placeholder text is a
  // "no selection" sentinel (e.g. Boolean's "Select option..."). Render it with
  // the standard placeholder color instead of looking like a real selected value.
  // Real empty-value labels (e.g. "All Actions", "Default Active Detail Layout")
  // keep their normal selected styling.
  const isEmptySentinel =
    selectedOption !== undefined &&
    (selectedOption.value === '' || selectedOption.value === null) &&
    selectedOption.label === placeholder;
  const showPlaceholder = selectedOption === undefined || isEmptySentinel;

  const filteredOptions = searchable && searchQuery
    ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || String(opt.value).toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  // The dropdown is portaled to <body> with fixed positioning so it can fly
  // over modals / overflowing containers. Position is recomputed on open and
  // tracked across scroll + resize.
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const position = () => {
      const el = containerRef.current!;
      const rect = el.getBoundingClientRect();
      let dropUp: boolean;
      if (direction === 'up') dropUp = true;
      else if (direction === 'down') dropUp = false;
      else dropUp = window.innerHeight - rect.bottom < 220;
      setComputedDropUp(dropUp);
      setDropPos({
        left: rect.left,
        width: rect.width,
        ...(dropUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 4 }),
      });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [isOpen, direction]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && dropdownRef.current &&
        !containerRef.current.contains(target) &&
        !dropdownRef.current.contains(target)
      ) {
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
  // md is the form-field size: default to full-width + .sails-input metrics so
  // selects always match sibling controls. sm (pagination/page-size) stays compact.
  const fieldSizeClass = size === 'md' ? ' sails-custom-select--full sails-custom-select--field' : '';

  return (
    <div 
      className={`sails-custom-select sails-custom-select--${size}${fieldSizeClass} ${dropClass} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`} 
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
          {!showPlaceholder ? (
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

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="sails-custom-select__dropdown"
          style={dropPos ? { position: 'fixed', left: dropPos.left, width: dropPos.width, ...(dropPos.top !== undefined ? { top: dropPos.top } : { bottom: dropPos.bottom }) } : undefined}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
