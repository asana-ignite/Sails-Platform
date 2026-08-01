import React, { useState, useRef, useEffect } from 'react';
import { GitFork, ChevronRight, ChevronDown, Search, X } from 'lucide-react';
import './FieldPathPicker.css';

export interface FieldDefinition {
  id: string;
  name: string;
  fieldName: string;
  logicalType: 'short_text' | 'number' | 'currency' | 'select' | 'date' | 'boolean' | 'relation';
  targetModel?: string;
  options?: { label: string; value: string }[];
}

export interface FieldPathPickerProps {
  rootModel: string;
  modelsSchemas: Record<string, FieldDefinition[]>;
  value: string[]; // Chain of selected field IDs, e.g. ['f9', 'u3', 'd1']
  onChange: (newChain: string[]) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  align?: 'left' | 'right' | 'auto';
  className?: string;
  style?: React.CSSProperties;
}

// Helper to resolve flyout column steps and display labels
function resolveChainDetails(
  rootModel: string,
  chain: string[] = [],
  modelsSchemas: Record<string, FieldDefinition[]>,
  searchQuery: string = ''
) {
  let currentModel = rootModel;
  const labels: string[] = [];
  const columns: { modelName: string; fields: FieldDefinition[]; activeFieldId: string }[] = [];

  for (let i = 0; i <= chain.length; i++) {
    let modelFields = modelsSchemas[currentModel] || [];
    if (modelFields.length === 0) break;

    // Filter fields if search query entered
    if (searchQuery) {
      modelFields = modelFields.filter(
        (f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.fieldName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const activeFieldId = chain[i] || '';
    columns.push({ modelName: currentModel, fields: modelFields, activeFieldId });

    if (!activeFieldId) break;

    const selectedF = (modelsSchemas[currentModel] || []).find((f) => f.id === activeFieldId);
    if (selectedF) {
      labels.push(selectedF.name);
      if (selectedF.logicalType === 'relation' && selectedF.targetModel) {
        currentModel = selectedF.targetModel; // Flyout into next model!
      } else {
        break;
      }
    }
  }

  const deepestName = labels.length > 0 ? labels[labels.length - 1] : 'Select Field';
  const fullPath = labels.join(' → ');
  const isNested = labels.length > 1;

  return {
    columns,
    deepestName,
    fullPath,
    isNested
  };
}

export const FieldPathPicker: React.FC<FieldPathPickerProps> = ({
  rootModel,
  modelsSchemas,
  value = [],
  onChange,
  placeholder = 'Select field...',
  size = 'sm',
  disabled = false,
  align = 'auto',
  className = '',
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [flyoutAlignRight, setFlyoutAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const info = resolveChainDetails(rootModel, value, modelsSchemas, isOpen ? searchQuery : '');

  // Detect boundary overflow to auto-align flyout right when near screen/modal right edge
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const parentModal = containerRef.current.closest('.qs-simple-widget, .sails-modal, .modal-content');
      const parentRight = parentModal
        ? parentModal.getBoundingClientRect().right
        : window.innerWidth;

      const estimatedFlyoutWidth = info.columns.length * 150 + 20;

      if (align === 'right') {
        setFlyoutAlignRight(true);
      } else if (align === 'left') {
        setFlyoutAlignRight(false);
      } else {
        // Auto alignment calculation
        if (rect.left + estimatedFlyoutWidth > parentRight || rect.left > window.innerWidth * 0.55) {
          setFlyoutAlignRight(true);
        } else {
          setFlyoutAlignRight(false);
        }
      }
    }
  }, [isOpen, info.columns.length, align]);

  // Close flyout menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectField = (columnIndex: number, field: FieldDefinition) => {
    if (disabled) return;
    const newChain = value.slice(0, columnIndex);
    newChain.push(field.id);
    onChange(newChain);

    // If scalar field selected, close flyout menu
    if (field.logicalType !== 'relation') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div
      ref={containerRef}
      className={`field-path-picker ${disabled ? 'field-path-picker--disabled' : ''} ${className}`}
      style={style}
    >
      {/* Rested State Control */}
      <div
        className={`field-path-picker__control ${isOpen ? 'is-open' : ''} size-${size}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        title={`Full Path: ${info.fullPath || placeholder}`}
      >
        <div className="sails-select-content">
          {info.isNested && <GitFork size={12} className="field-path-picker__nested-icon" />}
          <span className="sails-select-label">
            {value.length > 0 ? info.deepestName : placeholder}
          </span>
        </div>
        <ChevronDown size={14} className={`custom-select__arrow ${isOpen ? 'custom-select__arrow--open' : ''}`} />
      </div>

      {/* Navigation Flyout Menu (Auto-positioned boundary detection) */}
      {isOpen && (
        <div className={`field-path-picker__flyout ${flyoutAlignRight ? 'field-path-picker__flyout--align-right' : ''}`}>
          <div className="field-path-picker__header">
            <div className="field-path-picker__search">
              <Search size={12} className="field-path-picker__search-icon" />
              <input
                type="text"
                className="field-path-picker__search-input"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="button"
              className="field-path-picker__close"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
            >
              <X size={11} />
            </button>
          </div>

          <div className="field-path-picker__columns">
            {info.columns.map((col, cIdx) => (
              <div key={cIdx} className="field-path-picker__column">
                <div className="field-path-picker__column-title">{col.modelName}</div>
                <div className="field-path-picker__column-items">
                  {col.fields.length === 0 ? (
                    <div className="field-path-picker__no-match">No fields match</div>
                  ) : (
                    col.fields.map((f) => {
                      const isSelected = f.id === col.activeFieldId;
                      const isRelation = f.logicalType === 'relation';

                      return (
                        <div
                          key={f.id}
                          className={`field-path-picker__item ${
                            isSelected
                              ? cIdx === info.columns.length - 1
                                ? 'is-target-selected'
                                : 'is-parent-selected'
                              : ''
                          } ${isRelation ? 'field-path-picker__item--relation' : ''}`}
                          onClick={() => handleSelectField(cIdx, f)}
                          onMouseEnter={() => {
                            if (isRelation && f.id !== col.activeFieldId) {
                              handleSelectField(cIdx, f);
                            }
                          }}
                        >
                          <span className="field-path-picker__item-label">{f.name}</span>
                          {isRelation && <ChevronRight size={11} className="field-path-picker__item-arrow" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldPathPicker;
