import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { KlaoTableDefinition, FieldTypeMetadata, FieldParameterDefinition } from '@klao/shared';
import { useConsole } from '../../contexts/ConsoleContext';
import { 
  Database, 
  Plus, 
  ArrowLeft, 
  Search, 
  Layers, 
  Settings, 
  Calendar, 
  ShieldAlert, 
  Trash2, 
  Info,
  ChevronRight,
  ChevronLeft,
  Eye,
  MoreHorizontal,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Type,
  AlignLeft,
  Hash,
  DollarSign,
  ToggleLeft,
  List,
  Link,
  Mail,
  Phone,
  Sliders,
  Table
} from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';
import './ObjectManager.css';

const DEFAULT_FIELD_TYPES: FieldTypeMetadata[] = [
  {
    type: 'short_text',
    label: 'Short Text',
    description: 'Single line text string up to 255 characters',
    iconName: 'Type',
    physicalType: 'text',
    parametersSchema: [
      { name: 'maxLength', label: 'Max Length (Characters)', type: 'number', defaultValue: 255, min: 1, max: 4000 },
      { 
        name: 'transform', 
        label: 'Text Transform', 
        type: 'select', 
        defaultValue: 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'UPPERCASE', value: 'uppercase' },
          { label: 'lowercase', value: 'lowercase' }
        ]
      },
      { name: 'placeholder', label: 'Placeholder Text', type: 'text', placeholder: 'e.g. Enter text...' },
      { name: 'defaultValue', label: 'Default Value', type: 'text', placeholder: 'e.g. N/A' }
    ]
  },
  {
    type: 'long_text',
    label: 'Long Text',
    description: 'Multi-line text block or documentation body',
    iconName: 'AlignLeft',
    physicalType: 'text',
    parametersSchema: [
      { name: 'maxLength', label: 'Max Character Length', type: 'number', defaultValue: 2000, min: 1 },
      { name: 'placeholder', label: 'Placeholder Text', type: 'text', placeholder: 'e.g. Provide details...' }
    ]
  },
  {
    type: 'number',
    label: 'Number / Decimal',
    description: 'Numeric value supporting integer or floating point decimal precision',
    iconName: 'Hash',
    physicalType: 'number',
    parametersSchema: [
      {
        name: 'numberType',
        label: 'Number Subtype',
        type: 'select',
        defaultValue: 'decimal',
        options: [
          { label: 'Decimal / Floating Point', value: 'decimal' },
          { label: 'Integer (Whole Numbers)', value: 'integer' }
        ]
      },
      { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 2, min: 0, max: 10 },
      { name: 'min', label: 'Minimum Value', type: 'number', placeholder: 'e.g. 0' },
      { name: 'max', label: 'Maximum Value', type: 'number', placeholder: 'e.g. 1000000' },
      { name: 'defaultValue', label: 'Default Value', type: 'number', placeholder: 'e.g. 0' }
    ]
  },
  {
    type: 'currency',
    label: 'Currency',
    description: 'Financial monetary value with currency symbol',
    iconName: 'DollarSign',
    physicalType: 'number',
    parametersSchema: [
      {
        name: 'currencySymbol',
        label: 'Currency Symbol',
        type: 'select',
        defaultValue: '$',
        options: [
          { label: '$ (USD / Dollar)', value: '$' },
          { label: '฿ (THB / Baht)', value: '฿' },
          { label: '€ (EUR / Euro)', value: '€' },
          { label: '£ (GBP / Pound)', value: '£' },
          { label: '¥ (JPY / Yen)', value: '¥' }
        ]
      },
      { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 2, min: 0, max: 6 },
      { name: 'min', label: 'Minimum Amount', type: 'number', placeholder: '0' },
      { name: 'max', label: 'Maximum Amount', type: 'number', placeholder: '100000000' }
    ]
  },
  {
    type: 'boolean',
    label: 'Boolean',
    description: 'True or False toggle state',
    iconName: 'ToggleLeft',
    physicalType: 'boolean',
    parametersSchema: [
      {
        name: 'defaultValue',
        label: 'Default State',
        type: 'select',
        defaultValue: 'false',
        options: [
          { label: 'False (Unchecked)', value: 'false' },
          { label: 'True (Checked)', value: 'true' }
        ]
      },
      { name: 'trueLabel', label: 'True Display Label', type: 'text', placeholder: 'Yes / Active', defaultValue: 'True' },
      { name: 'falseLabel', label: 'False Display Label', type: 'text', placeholder: 'No / Inactive', defaultValue: 'False' }
    ]
  },
  {
    type: 'date',
    label: 'Date / Time',
    description: 'Calendar date and timestamp precision',
    iconName: 'Calendar',
    physicalType: 'date',
    parametersSchema: [
      {
        name: 'dateFormat',
        label: 'Display Date Format',
        type: 'select',
        defaultValue: 'YYYY-MM-DD',
        options: [
          { label: 'YYYY-MM-DD (ISO)', value: 'YYYY-MM-DD' },
          { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
          { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' }
        ]
      },
      { name: 'defaultCurrent', label: 'Default to Current Date/Time', type: 'boolean', defaultValue: false }
    ]
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Email address with pattern validation',
    iconName: 'Mail',
    physicalType: 'text',
    parametersSchema: [
      { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. user@example.com' }
    ]
  },
  {
    type: 'phone',
    label: 'Phone',
    description: 'Telephone or mobile phone number',
    iconName: 'Phone',
    physicalType: 'text',
    parametersSchema: [
      { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. +1 555-0199' }
    ]
  },
  {
    type: 'select',
    label: 'Single Selection Dropdown',
    description: 'Select a single option from a custom list or lookup values from another data model',
    iconName: 'List',
    physicalType: 'text',
    parametersSchema: [
      {
        name: 'sourceType',
        label: 'Option Value Source',
        type: 'select',
        defaultValue: 'custom',
        options: [
          { label: 'Custom Entered Options List', value: 'custom' },
          { label: 'Lookup Values from Data Model', value: 'object' }
        ]
      },
      {
        name: 'optionsText',
        label: 'Custom Options (One Per Line)',
        type: 'textarea',
        placeholder: 'Draft\nIn Review\nApproved\nClosed'
      },
      {
        name: 'sourceTable',
        label: 'Source Data Model (For Object Lookup)',
        type: 'model_select'
      },
      {
        name: 'sourceColumn',
        label: 'Source Column / Field Name',
        type: 'text',
        placeholder: 'e.g. status or category_name'
      },
      {
        name: 'allowMultiple',
        label: 'Allow Multi-Select',
        type: 'boolean',
        defaultValue: false
      }
    ]
  },
  {
    type: 'percentage',
    label: 'Percentage',
    description: 'Numeric percentage value (e.g. 15.5%)',
    iconName: 'Hash',
    physicalType: 'number',
    parametersSchema: [
      { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 2, min: 0, max: 6 },
      { name: 'min', label: 'Minimum Percent (%)', type: 'number', defaultValue: 0, placeholder: '0' },
      { name: 'max', label: 'Maximum Percent (%)', type: 'number', defaultValue: 100, placeholder: '100' },
      { name: 'showSymbol', label: 'Display % Symbol', type: 'boolean', defaultValue: true }
    ]
  },
  {
    type: 'address',
    label: 'Address',
    description: 'Physical location and postal address',
    iconName: 'AlignLeft',
    physicalType: 'text',
    parametersSchema: [
      { name: 'includeCountry', label: 'Include Country Field', type: 'boolean', defaultValue: true },
      { name: 'includePostalCode', label: 'Include Postal / Zip Code Field', type: 'boolean', defaultValue: true },
      { name: 'includeStateProvince', label: 'Include State / Province Field', type: 'boolean', defaultValue: true },
      { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. 123 Main St, City, Country' }
    ]
  },
  {
    type: 'attachment',
    label: 'Attachment / File',
    description: 'Document or file upload with file type extension limits',
    iconName: 'Link',
    physicalType: 'text',
    parametersSchema: [
      {
        name: 'allowedExtensions',
        label: 'Allowed File Extensions (Limit File Types)',
        type: 'text',
        placeholder: 'e.g. pdf, docx, png, jpg, csv, xlsx',
        defaultValue: 'pdf, docx, png, jpg'
      },
      {
        name: 'maxFileSizeMB',
        label: 'Max File Size Limit (MB)',
        type: 'number',
        defaultValue: 10,
        min: 1,
        max: 500
      },
      {
        name: 'allowMultiple',
        label: 'Allow Multiple File Uploads',
        type: 'boolean',
        defaultValue: false
      }
    ]
  },
  {
    type: 'relation',
    label: 'Relation',
    description: 'Foreign key link to records in another data model',
    iconName: 'Link',
    physicalType: 'relation',
    parametersSchema: [
      { name: 'targetTable', label: 'Target Data Model', type: 'model_select', required: true },
      {
        name: 'relationType',
        label: 'Relation Type',
        type: 'select',
        defaultValue: 'many_to_one',
        options: [
          { label: 'Many-to-One (Lookup Foreign Key)', value: 'many_to_one' },
          { label: 'One-to-Many', value: 'one_to_many' },
          { label: 'One-to-One', value: 'one_to_one' }
        ]
      }
    ]
  }
];

const ObjectManager: React.FC = () => {
  const [tables, setTables] = useState<KlaoTableDefinition[]>([]);
  const [selectedTable, setSelectedTable] = useState<KlaoTableDefinition | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state for tables
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Field Manager state
  const [fieldSearchTerm, setFieldSearchTerm] = useState('');
  const [fieldCurrentPage, setFieldCurrentPage] = useState(1);
  const [fieldPageSize, setFieldPageSize] = useState(10);
  const [activeMenuFieldId, setActiveMenuFieldId] = useState<string | null>(null);

  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [isCreatingField, setIsCreatingField] = useState(false);

  // Context menu & Edit Table state
  const [activeMenuTableId, setActiveMenuTableId] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<KlaoTableDefinition | null>(null);
  const [editTableName, setEditTableName] = useState('');
  const [editTableDesc, setEditTableDesc] = useState('');
  
  // Table form state
  const [newTableName, setNewTableName] = useState('');
  const [newTableDbName, setNewTableDbName] = useState('');
  const [newTableDesc, setNewTableDesc] = useState('');
  
  // Field form state
  const [fieldWizardStep, setFieldWizardStep] = useState<1 | 2>(1);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldDbName, setNewFieldDbName] = useState('');
  const [newFieldDesc, setNewFieldDesc] = useState('');
  const [newFieldLogicalType, setNewFieldLogicalType] = useState('short_text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  
  // Metadata-Driven Registry Schema state
  const [fieldTypeMetadataList, setFieldTypeMetadataList] = useState<FieldTypeMetadata[]>(DEFAULT_FIELD_TYPES);
  const [dynamicConfigValues, setDynamicConfigValues] = useState<Record<string, any>>({});

  // Edit Field state
  const [editingField, setEditingField] = useState<any | null>(null);
  const [editFieldWizardStep, setEditFieldWizardStep] = useState<1 | 2>(1);
  const [editFieldName, setEditFieldName] = useState('');
  const [editFieldDbName, setEditFieldDbName] = useState('');
  const [editFieldDesc, setEditFieldDesc] = useState('');
  const [editFieldLogicalType, setEditFieldLogicalType] = useState('short_text');
  const [editFieldRequired, setEditFieldRequired] = useState(false);
  const [editDynamicConfigValues, setEditDynamicConfigValues] = useState<Record<string, any>>({});

  // Fetch registered field types from Core API Registry
  const fetchFieldTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/metadata/field-types');
      if (res.ok) {
        const data: FieldTypeMetadata[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFieldTypeMetadataList(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch field types from registry:', err);
    }
  }, []);

  useEffect(() => {
    fetchFieldTypes();
  }, [fetchFieldTypes]);

  // Sync default dynamic parameter values when selected field logical type changes
  useEffect(() => {
    const activeMeta = fieldTypeMetadataList.find(t => t.type === newFieldLogicalType);
    if (activeMeta && activeMeta.parametersSchema) {
      const defaults: Record<string, any> = {};
      activeMeta.parametersSchema.forEach(param => {
        if (param.defaultValue !== undefined) {
          defaults[param.name] = param.defaultValue;
        }
      });
      setDynamicConfigValues(defaults);
    }
  }, [newFieldLogicalType, fieldTypeMetadataList]);

  const resetFieldParams = useCallback(() => {
    setFieldWizardStep(1);
    setNewFieldName('');
    setNewFieldDbName('');
    setNewFieldDesc('');
    setNewFieldLogicalType('short_text');
    setNewFieldRequired(false);
    setDynamicConfigValues({
      maxLength: 255,
      transform: 'none',
      placeholder: '',
      defaultValue: ''
    });
  }, []);



  // Custom Error Modal State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'table' | 'field';
    id: string;
    name: string;
    extra?: string;
  } | null>(null);

  const { setHeaderActions, setPageTitle, setPageSubtitle } = useConsole();

  // Dynamic header title and subtitle when viewing table detail
  useEffect(() => {
    if (viewMode === 'detail' && selectedTable) {
      setPageTitle(selectedTable.name);
      setPageSubtitle(selectedTable.description || 'Data model schema definition and field structure.');
    } else {
      setPageTitle(null);
      setPageSubtitle(null);
    }
  }, [viewMode, selectedTable, setPageTitle, setPageSubtitle]);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/metadata/objects');
      if (res.ok) {
        const data = await res.json();
        setTables(data);
        if (selectedTable) {
          const updatedSelected = data.find((t: any) => t.id === selectedTable.id);
          if (updatedSelected) {
            setSelectedTable(updatedSelected);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  }, [selectedTable]);

  useEffect(() => {
    fetchTables();
  }, []);

  // Close context menus on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuTableId(null);
      setActiveMenuFieldId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSaveEditTable = async () => {
    if (!editingTable || !editTableName.trim()) return;

    try {
      const res = await fetch(`/api/metadata/objects/${editingTable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTableName,
          description: editTableDesc
        })
      });

      if (res.ok) {
        setEditingTable(null);
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to update data model');
      }
    } catch (error) {
      console.error('Error updating table:', error);
    }
  };

  const triggerDeleteTable = (table: KlaoTableDefinition) => {
    setDeleteConfirmTarget({
      type: 'table',
      id: table.id,
      name: table.name,
      extra: table.tableName
    });
  };

  const triggerDeleteField = (fieldId: string, fieldName: string) => {
    setDeleteConfirmTarget({
      type: 'field',
      id: fieldId,
      name: fieldName
    });
  };

  const executeDeleteTable = async (tableId: string) => {
    try {
      const res = await fetch(`/api/metadata/objects/${tableId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (selectedTable?.id === tableId) {
          setSelectedTable(null);
          setViewMode('list');
        }
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete table');
      }
    } catch (error) {
      console.error('Error deleting table:', error);
    }
  };

  const executeDeleteField = async (fieldId: string) => {
    try {
      const res = await fetch(`/api/metadata/fields/${fieldId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete field');
      }
    } catch (error) {
      console.error('Error deleting field:', error);
    }
  };

  const handleCreateTable = async () => {
    if (!newTableName || !newTableDbName) return;

    // Validation: System Name must be alphanumeric only
    const dbNameRegex = /^[a-zA-Z0-9]+$/;

    if (!dbNameRegex.test(newTableDbName)) {
      setErrorMsg('System Name must contain only English letters and numbers (no spaces or special characters).');
      return;
    }
    
    try {
      const res = await fetch('/api/metadata/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTableName,
          tableName: newTableDbName,
          description: newTableDesc
        })
      });
      if (res.ok) {
        setIsCreatingTable(false);
        setNewTableName('');
        setNewTableDbName('');
        setNewTableDesc('');
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to create table');
      }
    } catch (error) {
      console.error('Error creating table:', error);
    }
  };

  const handleCreateField = async () => {
    if (!selectedTable || !newFieldName || !newFieldDbName) return;

    // Validation: System Name must be alphanumeric only
    const dbNameRegex = /^[a-zA-Z0-9]+$/;

    if (!dbNameRegex.test(newFieldDbName)) {
      setErrorMsg('System Name must contain only English letters and numbers (no spaces or special characters).');
      return;
    }

    const activeMeta = fieldTypeMetadataList.find(t => t.type === newFieldLogicalType);
    const physicalType = activeMeta?.physicalType || 'text';

    // Process dynamic config values (e.g. convert newline-separated optionsText to options array for custom list)
    const finalConfig: Record<string, any> = { ...dynamicConfigValues };
    if (newFieldLogicalType === 'select') {
      if (finalConfig.sourceType !== 'object') {
        if (typeof finalConfig.optionsText === 'string') {
          const optionsArr = finalConfig.optionsText
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((opt: string) => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '_') }));
          finalConfig.options = optionsArr;
        }
        delete finalConfig.optionsText;
        delete finalConfig.sourceTable;
        delete finalConfig.sourceColumn;
      } else {
        delete finalConfig.optionsText;
        delete finalConfig.options;
      }
    }


    try {
      const res = await fetch('/api/metadata/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          name: newFieldName,
          fieldName: newFieldDbName,
          logicalType: newFieldLogicalType,
          physicalType: physicalType,
          isRequired: newFieldRequired,
          description: newFieldDesc,
          config: finalConfig
        })
      });

      if (res.ok) {
        setIsCreatingField(false);
        resetFieldParams();
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to create field');
      }
    } catch (error) {
      console.error('Error creating field:', error);
    }
  };

  const openEditFieldModal = (field: any) => {
    setEditingField(field);
    setEditFieldWizardStep(1);
    setEditFieldName(field.name);
    setEditFieldDbName(field.fieldName);
    setEditFieldDesc(field.description || '');
    setEditFieldRequired(!!field.isRequired);
    setEditFieldLogicalType(field.logicalType);

    const cfg = field.config || {};
    if (field.logicalType === 'select') {
      if (cfg.sourceType === 'object') {
        setEditDynamicConfigValues({
          sourceType: 'object',
          sourceTable: cfg.sourceTable || '',
          sourceColumn: cfg.sourceColumn || '',
          allowMultiple: !!cfg.allowMultiple
        });
      } else {
        const text = Array.isArray(cfg.options)
          ? cfg.options.map((o: any) => (typeof o === 'string' ? o : o.label || o.value)).join('\n')
          : (cfg.optionsText || '');
        setEditDynamicConfigValues({
          sourceType: 'custom',
          optionsText: text,
          allowMultiple: !!cfg.allowMultiple
        });
      }
    } else {
      setEditDynamicConfigValues({ ...cfg });
    }
  };

  const handleUpdateField = async () => {
    if (!editingField || !editFieldName || !editFieldDbName) return;

    const finalConfig: Record<string, any> = { ...editDynamicConfigValues };
    if (editFieldLogicalType === 'select') {
      if (finalConfig.sourceType !== 'object') {
        if (typeof finalConfig.optionsText === 'string') {
          const optionsArr = finalConfig.optionsText
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((opt: string) => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '_') }));
          finalConfig.options = optionsArr;
        }
        delete finalConfig.optionsText;
        delete finalConfig.sourceTable;
        delete finalConfig.sourceColumn;
      } else {
        delete finalConfig.optionsText;
        delete finalConfig.options;
      }
    }

    try {
      const res = await fetch(`/api/metadata/fields/${editingField.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFieldName,
          fieldName: editFieldDbName,
          description: editFieldDesc,
          isRequired: editFieldRequired,
          logicalType: editFieldLogicalType,
          config: finalConfig
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedField = data.field || {
          ...editingField,
          name: editFieldName,
          fieldName: editFieldDbName,
          description: editFieldDesc,
          isRequired: editFieldRequired,
          logicalType: editFieldLogicalType,
          config: finalConfig
        };

        if (selectedTable) {
          const updatedFields = selectedTable.fields?.map(f => f.id === editingField.id ? updatedField : f) || [];
          const updatedTable = { ...selectedTable, fields: updatedFields };
          setSelectedTable(updatedTable);
          setTables(prev => prev.map(t => t.id === selectedTable.id ? updatedTable : t));
        }

        setEditingField(null);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to update field');
      }
    } catch (error) {
      console.error('Error updating field:', error);
      setErrorMsg('Error updating field');
    }
  };

  // Helper function to highlight search phrase matches
  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    if (!query || !query.trim() || !text) return text;
    const trimmedQuery = query.trim();
    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === trimmedQuery.toLowerCase() ? (
            <mark key={i} className="om-search-highlight">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Filtered tables based on search term (searches across all displayed columns)
  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) return tables;
    const q = searchTerm.trim().toLowerCase();

    return tables.filter(t => {
      const nameMatch = t.name?.toLowerCase().includes(q);
      const dbNameMatch = t.tableName?.toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q);
      
      const fieldsCount = t._count?.fields ?? t.fields?.length ?? 0;
      const fieldsStr = `${fieldsCount} fields`;
      const fieldsMatch = fieldsStr.toLowerCase().includes(q);

      const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '';
      const dateMatch = dateStr.toLowerCase().includes(q);

      return nameMatch || dbNameMatch || descMatch || fieldsMatch || dateMatch;
    });
  }, [tables, searchTerm]);

  // Reset to page 1 when search term or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  // Pagination calculations
  const totalCount = filteredTables.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRange = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalCount);

  const paginatedTables = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTables.slice(start, start + pageSize);
  }, [filteredTables, currentPage, pageSize]);

  // Filtered fields based on fieldSearchTerm
  const filteredFields = useMemo(() => {
    const fields = selectedTable?.fields || [];
    if (!fieldSearchTerm.trim()) return fields;
    const q = fieldSearchTerm.trim().toLowerCase();

    return fields.filter(f => {
      const nameMatch = f.name?.toLowerCase().includes(q);
      const descMatch = f.description?.toLowerCase().includes(q);
      const dbNameMatch = f.fieldName?.toLowerCase().includes(q);
      const logicalTypeMatch = f.logicalType?.toLowerCase().includes(q);
      const physicalTypeMatch = f.physicalType?.toLowerCase().includes(q);
      const reqStr = f.isRequired ? 'required' : 'optional';
      const reqMatch = reqStr.includes(q);

      return nameMatch || descMatch || dbNameMatch || logicalTypeMatch || physicalTypeMatch || reqMatch;
    });
  }, [selectedTable?.fields, fieldSearchTerm]);

  // Reset field page to 1 when search or page size changes
  useEffect(() => {
    setFieldCurrentPage(1);
  }, [fieldSearchTerm, fieldPageSize]);

  // Field pagination calculations
  const totalFieldCount = filteredFields.length;
  const totalFieldPages = Math.ceil(totalFieldCount / fieldPageSize) || 1;
  const fieldStartRange = totalFieldCount === 0 ? 0 : (fieldCurrentPage - 1) * fieldPageSize + 1;
  const fieldEndRange = Math.min(fieldCurrentPage * fieldPageSize, totalFieldCount);

  const paginatedFields = useMemo(() => {
    const start = (fieldCurrentPage - 1) * fieldPageSize;
    return filteredFields.slice(start, start + fieldPageSize);
  }, [filteredFields, fieldCurrentPage, fieldPageSize]);

  // Set header actions dynamically based on viewMode
  const memoizedHeaderActions = useMemo(() => {
    if (viewMode === 'list') {
      return (
        <button 
          className="klao-btn klao-btn--primary" 
          onClick={() => setIsCreatingTable(true)}
        >
          <Plus size={18} />
          <span>Create Table</span>
        </button>
      );
    } else {
      return (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="klao-btn klao-btn--secondary" 
            onClick={() => { setViewMode('list'); setSelectedTable(null); }}
          >
            <ArrowLeft size={18} />
            <span>Back to Data Models</span>
          </button>
          <button 
            className="klao-btn klao-btn--primary" 
            onClick={() => setIsCreatingField(true)}
          >
            <Plus size={18} />
            <span>Add Field</span>
          </button>
        </div>
      );
    }
  }, [viewMode, selectedTable]);

  useEffect(() => {
    setHeaderActions(memoizedHeaderActions);
    return () => setHeaderActions(null);
  }, [setHeaderActions, memoizedHeaderActions]);

  const selectRow = (table: KlaoTableDefinition) => {
    setSelectedTable(table);
    setViewMode('detail');
  };

  return (
    <div className="object-manager-container-full">
      {viewMode === 'list' ? (
        <div className="om-list-view">
          {/* Search bar */}
          <div className="om-toolbar">
            <div className="om-search-wrapper">
              <Search size={18} className="om-search-icon" />
              <input
                type="text"
                placeholder="Search data models by name, description, fields, date..."
                className="om-search-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Master Table Grid */}
          <div className="klao-card om-table-card">
            <table className="om-list-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Description</th>
                  <th>Model Type</th>
                  <th>Fields</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {paginatedTables.map(table => {
                  const fieldsCount = table._count?.fields ?? table.fields?.length ?? 0;
                  const fieldsText = `${fieldsCount} Fields`;
                  const dateText = table.createdAt ? new Date(table.createdAt).toLocaleDateString() : 'N/A';

                  return (
                    <tr key={table.id} className="om-clickable-row" onClick={() => selectRow(table)}>
                      <td>
                        <div className="om-table-cell-name">
                          <div className="om-table-icon-wrapper">
                            <Layers size={18} />
                          </div>
                          <div>
                            <div className="om-name-primary">
                              {renderHighlightedText(table.name, searchTerm)}
                            </div>
                            <div className="om-name-secondary"><code>{renderHighlightedText(table.tableName, searchTerm)}</code></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="om-desc-text">
                          {table.description ? renderHighlightedText(table.description, searchTerm) : 'No description provided.'}
                        </span>
                      </td>
                      <td>
                        {table.isSystem ? (
                          <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            System Model
                          </span>
                        ) : (
                          <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--klao-text-main)', border: '1px solid var(--klao-border-color)' }}>
                            Custom Model
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="om-badge">{renderHighlightedText(fieldsText, searchTerm)}</span>
                      </td>
                      <td>
                        <span className="om-date-cell">
                          <Calendar size={14} style={{ marginRight: '4px' }} />
                          {renderHighlightedText(dateText, searchTerm)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div className="om-action-wrapper">
                          <button 
                            className={`klao-btn klao-btn--ghost ${activeMenuTableId === table.id ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuTableId(activeMenuTableId === table.id ? null : table.id);
                            }} 
                            title="Options" 
                            aria-label="Options"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {activeMenuTableId === table.id && (
                            <div className="om-context-menu" onClick={e => e.stopPropagation()}>
                              <button 
                                className="om-context-item" 
                                onClick={() => {
                                  setActiveMenuTableId(null);
                                  setEditingTable(table);
                                  setEditTableName(table.name);
                                  setEditTableDesc(table.description || '');
                                }}
                              >
                                <Edit2 size={14} />
                                <span>Edit Details</span>
                              </button>

                              <button 
                                className="om-context-item" 
                                onClick={() => {
                                  setActiveMenuTableId(null);
                                  selectRow(table);
                                }}
                              >
                                <Layers size={14} />
                                <span>Manage Fields</span>
                              </button>

                              {!table.isSystem && (
                                <>
                                  <div className="om-context-divider"></div>
                                  <button 
                                    className="om-context-item om-context-item--danger" 
                                    onClick={() => {
                                      setActiveMenuTableId(null);
                                      triggerDeleteTable(table);
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    <span>Remove</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTables.length === 0 && (
                  <tr>
                    <td colSpan={6} className="om-empty-state-row">
                      <Database size={40} className="om-empty-icon" />
                      <h3>No Data Models Found</h3>
                      <p>Create a new database table to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Footer */}
            <div className="klao-user-manager__pagination" style={{ borderTop: '1px solid var(--klao-border-color)' }}>
              <div className="klao-user-manager__pagination-info">
                <span className="klao-user-manager__pagination-range">
                  Showing <strong>{startRange}</strong> to <strong>{endRange}</strong> of <strong>{totalCount}</strong> data models
                </span>
                <div className="klao-user-manager__page-size">
                  <span className="klao-user-manager__page-size-label">Records per page:</span>
                  <CustomSelect
                    size="sm"
                    value={pageSize === totalCount ? 'all' : pageSize}
                    options={[
                      { value: 10, label: '10' },
                      { value: 25, label: '25' },
                      { value: 50, label: '50' },
                      { value: 'all', label: 'ALL' }
                    ]}
                    onChange={(val) => {
                      setPageSize(val === 'all' ? (totalCount || 1000) : Number(val));
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="klao-user-manager__pagination-controls">
                <button
                  className="klao-pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="klao-pagination-pages">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      className={`klao-pagination-page ${currentPage === i + 1 ? 'klao-pagination-page--active' : ''}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  className="klao-pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        selectedTable && (
          <div className="om-detail-view-full animate-fade-in">
            {/* Stats grid */}
            <div className="om-stats-grid-full">
              <div className="klao-card om-stat-card-full">
                <label>Storage Type</label>
                <div className="stat-value">Relational (PostgreSQL)</div>
              </div>
              <div className="klao-card om-stat-card-full">
                <label>Total Fields</label>
                <div className="stat-value">{selectedTable.fields?.length || 0} Columns</div>
              </div>
              <div className="klao-card om-stat-card-full">
                <label>Security Mode</label>
                <div className="stat-value">Row-Level (RLS)</div>
              </div>
            </div>

            {/* Field list section */}
            <div className="om-section-full">
              <div className="om-section-header-full" style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--klao-text-main)', margin: 0 }}>
                  Field Definitions
                </h2>
              </div>

              <div className="om-toolbar" style={{ marginBottom: '16px' }}>
                <div className="om-search-wrapper">
                  <Search size={18} className="om-search-icon" />
                  <input
                    type="text"
                    placeholder="Search fields by name, column name, type, required status..."
                    className="om-search-input"
                    value={fieldSearchTerm}
                    onChange={e => setFieldSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="klao-card om-table-card">
                <table className="om-list-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Required</th>
                      <th style={{ textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFields.map(field => {
                      const fieldTypeMeta = fieldTypeMetadataList.find(t => t.type === field.logicalType);
                      const displayLabel = fieldTypeMeta?.label || field.logicalType.replace('_', ' ').toUpperCase();

                      return (
                        <tr key={field.id} className="om-clickable-row">
                          <td>
                            <div className="om-table-cell-name">
                              <div className="om-table-icon-wrapper">
                                <Settings size={18} />
                              </div>
                              <div>
                                <div className="om-name-primary">
                                  {renderHighlightedText(field.name, fieldSearchTerm)}
                                </div>
                                <div className="om-name-secondary" style={{ fontSize: '0.75rem', color: 'var(--klao-text-muted)', marginTop: '2px' }}>
                                  <code>{renderHighlightedText(field.fieldName, fieldSearchTerm)}</code>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ color: 'var(--klao-text-main)', fontSize: '0.85rem', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={field.description || ''}>
                              {field.description ? renderHighlightedText(field.description, fieldSearchTerm) : <span style={{ color: 'var(--klao-text-muted)', fontStyle: 'italic' }}>No description</span>}
                            </div>
                          </td>
                          <td>
                            <span className="om-badge" style={{ fontSize: '0.85rem' }}>
                              {renderHighlightedText(displayLabel, fieldSearchTerm)}
                            </span>
                          </td>
                          <td>
                            {field.isSystem ? (
                              <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                System Field
                              </span>
                            ) : (
                              <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--klao-text-main)', border: '1px solid var(--klao-border-color)' }}>
                                Custom Field
                              </span>
                            )}
                          </td>
                        <td>
                          {field.isRequired ? (
                            <span className="om-status-tag om-status-tag--required">
                              <CheckCircle2 size={12} />
                              {renderHighlightedText('Required', fieldSearchTerm)}
                            </span>
                          ) : (
                            <span className="om-status-tag om-status-tag--optional">
                              {renderHighlightedText('Optional', fieldSearchTerm)}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div className="om-action-wrapper">
                            <button 
                              className={`klao-btn klao-btn--ghost ${activeMenuFieldId === field.id ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFieldId(activeMenuFieldId === field.id ? null : field.id);
                              }} 
                              title="Options" 
                              aria-label="Options"
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {activeMenuFieldId === field.id && (
                              <div className="om-context-menu" onClick={e => e.stopPropagation()}>
                                {field.isSystem ? (
                                  <div className="om-context-item" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                                    <ShieldAlert size={14} />
                                    <span>System Field (Locked)</span>
                                  </div>
                                ) : (
                                  <>
                                    <button 
                                      className="om-context-item" 
                                      onClick={() => {
                                        setActiveMenuFieldId(null);
                                        openEditFieldModal(field);
                                      }}
                                    >
                                      <Edit2 size={14} />
                                      <span>Edit</span>
                                    </button>

                                    <div className="om-context-divider"></div>

                                    <button 
                                      className="om-context-item om-context-item--danger" 
                                      onClick={() => {
                                        setActiveMenuFieldId(null);
                                        triggerDeleteField(field.id, field.name);
                                      }}
                                    >
                                      <Trash2 size={14} />
                                      <span>Remove Field</span>
                                    </button>
                                  </>
                                )}
                              </div>
                             )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                    {filteredFields.length === 0 && (
                      <tr>
                        <td colSpan={5} className="om-empty-state-row">
                          <Info size={40} className="om-empty-icon" />
                          <h3>No Fields Found</h3>
                          <p>Click "Add Field" to define new column structure.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Field Pagination Footer */}
                <div className="klao-user-manager__pagination" style={{ borderTop: '1px solid var(--klao-border-color)' }}>
                  <div className="klao-user-manager__pagination-info">
                    <span className="klao-user-manager__pagination-range">
                      Showing <strong>{fieldStartRange}</strong> to <strong>{fieldEndRange}</strong> of <strong>{totalFieldCount}</strong> fields
                    </span>
                    <div className="klao-user-manager__page-size">
                      <span className="klao-user-manager__page-size-label">Records per page:</span>
                      <CustomSelect
                        size="sm"
                        value={fieldPageSize === totalFieldCount ? 'all' : fieldPageSize}
                        options={[
                          { value: 10, label: '10' },
                          { value: 25, label: '25' },
                          { value: 50, label: '50' },
                          { value: 'all', label: 'ALL' }
                        ]}
                        onChange={(val) => {
                          setFieldPageSize(val === 'all' ? (totalFieldCount || 1000) : Number(val));
                          setFieldCurrentPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="klao-user-manager__pagination-controls">
                    <button
                      className="klao-pagination-btn"
                      onClick={() => setFieldCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={fieldCurrentPage === 1}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="klao-pagination-pages">
                      {[...Array(totalFieldPages)].map((_, i) => (
                        <button
                          key={i + 1}
                          className={`klao-pagination-page ${fieldCurrentPage === i + 1 ? 'klao-pagination-page--active' : ''}`}
                          onClick={() => setFieldCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      className="klao-pagination-btn"
                      onClick={() => setFieldCurrentPage(prev => Math.min(totalFieldPages, prev + 1))}
                      disabled={fieldCurrentPage === totalFieldPages || totalFieldPages === 0}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Create Data Model Big Modal */}
      {isCreatingTable && createPortal(
        <div className="om-modal-overlay">
          <div className="om-big-modal om-big-modal--md">
            <div className="om-modal-header">
              <div className="om-modal-header-info">
                <div className="om-modal-icon-badge">
                  <Database size={24} />
                </div>
                <div>
                  <h2 className="om-modal-title">Create New Data Model</h2>
                  <p className="om-modal-subtitle">
                    Define a new database table and schema definition for your workspace.
                  </p>
                </div>
              </div>
              <button 
                className="om-modal-close" 
                onClick={() => {
                  setIsCreatingTable(false);
                  setNewTableName('');
                  setNewTableDbName('');
                  setNewTableDesc('');
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-modal-body">
              <div className="om-form-grid-2">
                <div className="om-field-group">
                  <label className="om-field-label">Data Model Name *</label>
                  <input 
                    type="text" 
                    className="klao-input" 
                    placeholder="e.g. Sales Opportunities" 
                    autoFocus 
                    value={newTableName}
                    onChange={e => {
                      const val = e.target.value;
                      setNewTableName(val);
                      setNewTableDbName(val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                    }}
                  />
                </div>

                <div className="om-field-group">
                  <label className="om-field-label">System Name (DB Table) *</label>
                  <input 
                    type="text" 
                    className="klao-input" 
                    placeholder="e.g. opportunities" 
                    value={newTableDbName}
                    onChange={e => setNewTableDbName(e.target.value)}
                  />
                  <span className="om-field-hint">Alphanumeric only (e.g. opportunities).</span>
                </div>
              </div>

              <div className="om-field-group">
                <label className="om-field-label">Description</label>
                <textarea 
                  className="klao-input" 
                  placeholder="Describe the data model's purpose..." 
                  rows={3}
                  value={newTableDesc}
                  onChange={e => setNewTableDesc(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>
            </div>

            <div className="om-modal-footer">
              <button className="klao-btn klao-btn--ghost" onClick={() => setIsCreatingTable(false)}>Cancel</button>
              <button className="klao-btn klao-btn--primary" onClick={handleCreateTable}>Create Model</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Data Model Big Modal */}
      {editingTable && createPortal(
        <div className="om-modal-overlay">
          <div className="om-big-modal om-big-modal--md">
            <div className="om-modal-header">
              <div className="om-modal-header-info">
                <div className="om-modal-icon-badge">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h2 className="om-modal-title">Edit Data Model</h2>
                  <p className="om-modal-subtitle">
                    Update display name and metadata for {editingTable.name}.
                  </p>
                </div>
              </div>
              <button 
                className="om-modal-close" 
                onClick={() => setEditingTable(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-modal-body">
              <div className="om-form-grid-2">
                <div className="om-field-group">
                  <label className="om-field-label">Data Model Name *</label>
                  <input 
                    type="text" 
                    className="klao-input" 
                    autoFocus 
                    value={editTableName}
                    onChange={e => setEditTableName(e.target.value)}
                  />
                </div>

                <div className="om-field-group">
                  <label className="om-field-label">System Name</label>
                  <input 
                    type="text" 
                    className="klao-input" 
                    value={editingTable.tableName}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <span className="om-field-hint">Physical DB names cannot be altered.</span>
                </div>
              </div>

              <div className="om-field-group">
                <label className="om-field-label">Description</label>
                <textarea 
                  className="klao-input" 
                  rows={3}
                  value={editTableDesc}
                  onChange={e => setEditTableDesc(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>
            </div>

            <div className="om-modal-footer">
              <button className="klao-btn klao-btn--ghost" onClick={() => setEditingTable(null)}>Cancel</button>
              <button className="klao-btn klao-btn--primary" onClick={handleSaveEditTable}>Save Changes</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Field Big Modal */}
      {isCreatingField && createPortal(
        <div className="om-modal-overlay">
          <div className="om-big-modal">
            <div className="om-modal-header">
              <div className="om-modal-header-info">
                <div className="om-modal-icon-badge">
                  <Plus size={24} />
                </div>
                <div>
                  <h2 className="om-modal-title">
                    Add New Field {fieldWizardStep === 1 ? '(Step 1 of 2)' : '(Step 2 of 2)'}
                  </h2>
                  <p className="om-modal-subtitle">
                    {fieldWizardStep === 1 
                      ? `Define general info and select field data type for model ${selectedTable?.name}.`
                      : `Configure type parameters and rules for field ${newFieldName} (${newFieldLogicalType.toUpperCase().replace('_', ' ')}).`}
                  </p>
                </div>
              </div>
              <button 
                className="om-modal-close" 
                onClick={() => {
                  setIsCreatingField(false);
                  resetFieldParams();
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-modal-body">
              {fieldWizardStep === 1 ? (
                <>
                  {/* General Information */}
                  <div className="om-form-grid-2">
                    <div className="om-field-group">
                      <label className="om-field-label">Display Name *</label>
                      <input 
                        type="text" 
                        className="klao-input" 
                        placeholder="e.g. Total Amount" 
                        autoFocus 
                        value={newFieldName}
                        onChange={e => {
                          const val = e.target.value;
                          setNewFieldName(val);
                          setNewFieldDbName(val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                        }}
                      />
                    </div>

                    <div className="om-field-group">
                      <label className="om-field-label">System Name (Column Name) *</label>
                      <input 
                        type="text" 
                        className="klao-input" 
                        placeholder="e.g. totalamount" 
                        value={newFieldDbName}
                        onChange={e => setNewFieldDbName(e.target.value)}
                      />
                      <span className="om-field-hint">Alphanumeric only.</span>
                    </div>
                  </div>

                  {/* Required Field Checkbox right under Display Name / System Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={newFieldRequired}
                      onChange={e => setNewFieldRequired(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    <label className="om-field-label" style={{ margin: 0 }}>Required Field (Must not be null)</label>
                  </div>

                  <div className="om-field-group">
                    <label className="om-field-label">Description (Optional)</label>
                    <input 
                      type="text"
                      className="klao-input" 
                      placeholder="Describe the purpose of this field..." 
                      value={newFieldDesc}
                      onChange={e => setNewFieldDesc(e.target.value)}
                    />
                  </div>

                  {/* Logical Type Visual Grid (Dynamic from Registry Schema) */}
                  <div className="om-field-group">
                    <label className="om-field-label">Field Data Type *</label>
                    <div className="om-type-grid">
                      {fieldTypeMetadataList.map(t => {
                        let IconComp = Type;
                        if (t.iconName === 'AlignLeft') IconComp = AlignLeft;
                        if (t.iconName === 'Hash') IconComp = Hash;
                        if (t.iconName === 'DollarSign') IconComp = DollarSign;
                        if (t.iconName === 'ToggleLeft') IconComp = ToggleLeft;
                        if (t.iconName === 'Calendar') IconComp = Calendar;
                        if (t.iconName === 'Mail') IconComp = Mail;
                        if (t.iconName === 'Phone') IconComp = Phone;
                        if (t.iconName === 'List') IconComp = List;
                        if (t.iconName === 'Link') IconComp = Link;

                        const isActive = newFieldLogicalType === t.type;
                        return (
                          <div
                            key={t.type}
                            className={`om-type-card ${isActive ? 'om-type-card--active' : ''}`}
                            onClick={() => setNewFieldLogicalType(t.type)}
                          >
                            <div className="om-type-card-icon">
                              <IconComp size={24} />
                            </div>
                            <span className="om-type-card-label">{t.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>

              ) : (
                <>
                  {/* Step 2: Metadata-Driven Dynamic Field Type Configuration */}
                  {(() => {
                    const activeFieldTypeMeta = fieldTypeMetadataList.find(t => t.type === newFieldLogicalType);

                    return (
                      <div className="om-config-section">
                        <div className="om-config-header">
                          <div className="om-config-title">
                            <Sliders size={16} />
                            <span>Modular Type Parameters</span>
                          </div>
                          <span className="om-config-badge">
                            {activeFieldTypeMeta?.label || newFieldLogicalType.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>

                        {newFieldLogicalType === 'select' ? (
                          <div className="om-form-grid-2">
                            {/* Tab Switcher for Source Type */}
                            <div className="om-field-group om-field-group--full">
                              <label className="om-field-label">Option Value Source *</label>
                              <div className="om-tab-group">
                                <button
                                  type="button"
                                  className={`om-tab-button ${dynamicConfigValues.sourceType !== 'object' ? 'om-tab-button--active' : ''}`}
                                  onClick={() => {
                                    setDynamicConfigValues((prev: Record<string, any>) => {
                                      const next: Record<string, any> = { ...prev, sourceType: 'custom' };
                                      delete next.sourceTable;
                                      delete next.sourceColumn;
                                      return next;
                                    });
                                  }}
                                >
                                  Manual Custom List
                                </button>
                                <button
                                  type="button"
                                  className={`om-tab-button ${dynamicConfigValues.sourceType === 'object' ? 'om-tab-button--active' : ''}`}
                                  onClick={() => {
                                    setDynamicConfigValues((prev: Record<string, any>) => {
                                      const next: Record<string, any> = { ...prev, sourceType: 'object' };
                                      delete next.optionsText;
                                      return next;
                                    });
                                  }}
                                >
                                  Lookup Values from Data Model
                                </button>
                              </div>
                            </div>

                            {dynamicConfigValues.sourceType !== 'object' ? (
                              <div className="om-field-group om-field-group--full">
                                <label className="om-field-label">Custom Options (One Per Line) *</label>
                                <textarea
                                  className="klao-input"
                                  placeholder={'Draft\nIn Review\nApproved\nClosed'}
                                  rows={10}
                                  value={dynamicConfigValues.optionsText || ''}
                                  onChange={e => setDynamicConfigValues(prev => ({ ...prev, optionsText: e.target.value }))}
                                  style={{ resize: 'vertical', minHeight: '220px' }}
                                />
                                <span className="om-field-hint">Enter choices on separate lines (one option per line).</span>
                              </div>
                            ) : (
                              <>
                                <div className="om-field-group">
                                  <label className="om-field-label">Source Data Model *</label>
                                  <CustomSelect
                                    size="md"
                                    value={dynamicConfigValues.sourceTable || ''}
                                    options={tables.map(t => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
                                    onChange={val => setDynamicConfigValues(prev => ({
                                      ...prev,
                                      sourceTable: val,
                                      sourceColumn: '' // Clear selected column when target model changes
                                    }))}
                                    placeholder="Select Source Data Model"
                                  />
                                </div>
                                <div className="om-field-group">
                                  <label className="om-field-label">Source Field / Column *</label>
                                  {(() => {
                                    const selectedTargetTableObj = tables.find(t => t.tableName === dynamicConfigValues.sourceTable);
                                    const fieldOptions = selectedTargetTableObj?.fields
                                      ? selectedTargetTableObj.fields.map(f => ({
                                          value: f.fieldName,
                                          label: `${f.name} (${f.fieldName})`
                                        }))
                                      : [];

                                    return (
                                      <CustomSelect
                                        size="md"
                                        value={dynamicConfigValues.sourceColumn || ''}
                                        options={fieldOptions}
                                        onChange={val => setDynamicConfigValues(prev => ({ ...prev, sourceColumn: val }))}
                                        placeholder={selectedTargetTableObj ? "Select Source Field" : "Select Data Model First"}
                                        disabled={!selectedTargetTableObj}
                                      />
                                    );
                                  })()}
                                </div>
                              </>
                            )}

                            <div className="om-field-group" style={{ gridColumn: 'span 2' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={!!dynamicConfigValues.allowMultiple}
                                  onChange={e => setDynamicConfigValues(prev => ({ ...prev, allowMultiple: e.target.checked }))}
                                  style={{ width: 'auto' }}
                                />
                                <label className="om-field-label" style={{ margin: 0 }}>Allow Multi-Select</label>
                              </div>
                            </div>
                          </div>
                        ) : (!activeFieldTypeMeta?.parametersSchema || activeFieldTypeMeta.parametersSchema.length === 0) ? (
                          <p style={{ color: 'var(--klao-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                            This field type does not require additional parameters.
                          </p>
                        ) : (
                          <div className="om-form-grid-2">
                            {activeFieldTypeMeta.parametersSchema.map((param: FieldParameterDefinition) => {
                              if (param.type === 'select') {
                                return (
                                  <div key={param.name} className="om-field-group">
                                    <label className="om-field-label">{param.label}</label>
                                    <CustomSelect
                                      size="md"
                                      value={dynamicConfigValues[param.name] ?? param.defaultValue ?? ''}
                                      options={param.options || []}
                                      onChange={val => setDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                    />
                                  </div>
                                );
                              }

                              if (param.type === 'boolean') {
                                return (
                                  <div key={param.name} className="om-field-group" style={{ justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                      <input
                                        type="checkbox"
                                        checked={!!dynamicConfigValues[param.name]}
                                        onChange={e => setDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.checked }))}
                                        style={{ width: 'auto' }}
                                      />
                                      <label className="om-field-label" style={{ margin: 0 }}>{param.label}</label>
                                    </div>
                                  </div>
                                );
                              }

                              if (param.type === 'model_select') {
                                return (
                                  <div key={param.name} className="om-field-group">
                                    <label className="om-field-label">{param.label} *</label>
                                    <CustomSelect
                                      size="md"
                                      value={dynamicConfigValues[param.name] || ''}
                                      options={tables.map(t => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
                                      onChange={val => setDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                      placeholder="Select Target Model"
                                    />
                                  </div>
                                );
                              }

                              if (param.type === 'textarea') {
                                return (
                                  <div key={param.name} className="om-field-group om-field-group--full">
                                    <label className="om-field-label">{param.label}</label>
                                    <textarea
                                      className="klao-input"
                                      placeholder={param.placeholder}
                                      rows={4}
                                      value={dynamicConfigValues[param.name] || ''}
                                      onChange={e => setDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                                      style={{ resize: 'vertical' }}
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div key={param.name} className="om-field-group">
                                  <label className="om-field-label">{param.label}</label>
                                  <input
                                    type={param.type === 'number' ? 'number' : 'text'}
                                    className="klao-input"
                                    placeholder={param.placeholder}
                                    min={param.min}
                                    max={param.max}
                                    value={dynamicConfigValues[param.name] ?? ''}
                                    onChange={e => setDynamicConfigValues(prev => ({ 
                                      ...prev, 
                                      [param.name]: param.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value 
                                    }))}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="om-modal-footer">
              {fieldWizardStep === 1 ? (
                <>
                  <button 
                    className="klao-btn klao-btn--ghost" 
                    onClick={() => {
                      setIsCreatingField(false);
                      resetFieldParams();
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="klao-btn klao-btn--primary" 
                    disabled={!newFieldName || !newFieldDbName}
                    onClick={() => setFieldWizardStep(2)}
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="klao-btn klao-btn--ghost" 
                    onClick={() => setFieldWizardStep(1)}
                  >
                    Back
                  </button>
                  <button 
                    className="klao-btn klao-btn--primary" 
                    onClick={handleCreateField}
                  >
                    Create Field
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Field Modal (2-Step Wizard with Locked Field Type) */}
      {editingField && createPortal(
        <div className="om-modal-overlay">
          <div className="om-big-modal">
            <div className="om-modal-header">
              <div className="om-modal-header-info">
                <div className="om-modal-icon-badge">
                  <Sliders size={24} />
                </div>
                <div>
                  <h2 className="om-modal-title">
                    Edit Field: {editingField.name} {editFieldWizardStep === 1 ? '(Step 1 of 2)' : '(Step 2 of 2)'}
                  </h2>
                  <p className="om-modal-subtitle">
                    {editFieldWizardStep === 1 
                      ? `Update general information and required rules for field ${editingField.fieldName}.`
                      : `Modify parameter settings for field type (${editFieldLogicalType.toUpperCase().replace('_', ' ')}).`}
                  </p>
                </div>
              </div>
              <button 
                className="om-modal-close" 
                onClick={() => setEditingField(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-modal-body">
              {editFieldWizardStep === 1 ? (
                <>
                  {/* General Information */}
                  <div className="om-form-grid-2">
                    <div className="om-field-group">
                      <label className="om-field-label">Display Name *</label>
                      <input 
                        type="text" 
                        className="klao-input" 
                        placeholder="e.g. Total Amount" 
                        autoFocus 
                        value={editFieldName}
                        onChange={e => {
                          const val = e.target.value;
                          setEditFieldName(val);
                          setEditFieldDbName(val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                        }}
                      />
                    </div>

                    <div className="om-field-group">
                      <label className="om-field-label">System Name (Column Name) *</label>
                      <input 
                        type="text" 
                        className="klao-input" 
                        placeholder="e.g. totalamount" 
                        value={editFieldDbName}
                        onChange={e => setEditFieldDbName(e.target.value)}
                      />
                      <span className="om-field-hint">Alphanumeric only.</span>
                    </div>
                  </div>

                  {/* Required Field Checkbox right under Display Name / System Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={editFieldRequired}
                      onChange={e => setEditFieldRequired(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    <label className="om-field-label" style={{ margin: 0 }}>Required Field (Must not be null)</label>
                  </div>

                  <div className="om-field-group">
                    <label className="om-field-label">Description (Optional)</label>
                    <input 
                      type="text"
                      className="klao-input" 
                      placeholder="Describe the purpose of this field..." 
                      value={editFieldDesc}
                      onChange={e => setEditFieldDesc(e.target.value)}
                    />
                  </div>

                  {/* Selectable Field Data Type Grid */}
                  <div className="om-field-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="om-field-label">Field Data Type *</label>
                      <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--klao-text-muted)' }}>
                        Pre-save audits validate row data before applying DDL
                      </span>
                    </div>
                    <div className="om-type-grid">
                      {fieldTypeMetadataList.map(t => {
                        let IconComp = Type;
                        if (t.iconName === 'AlignLeft') IconComp = AlignLeft;
                        if (t.iconName === 'Hash') IconComp = Hash;
                        if (t.iconName === 'DollarSign') IconComp = DollarSign;
                        if (t.iconName === 'ToggleLeft') IconComp = ToggleLeft;
                        if (t.iconName === 'Calendar') IconComp = Calendar;
                        if (t.iconName === 'Mail') IconComp = Mail;
                        if (t.iconName === 'Phone') IconComp = Phone;
                        if (t.iconName === 'List') IconComp = List;
                        if (t.iconName === 'Link') IconComp = Link;

                        const isActive = editFieldLogicalType === t.type;
                        return (
                          <div
                            key={t.type}
                            className={`om-type-card ${isActive ? 'om-type-card--active' : ''}`}
                            onClick={() => setEditFieldLogicalType(t.type)}
                          >
                            <div className="om-type-card-icon">
                              <IconComp size={24} />
                            </div>
                            <span className="om-type-card-label">{t.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Metadata-Driven Dynamic Field Type Parameters */}
                  {(() => {
                    const activeFieldTypeMeta = fieldTypeMetadataList.find(t => t.type === editFieldLogicalType);

                    return (
                      <div className="om-config-section">
                        <div className="om-config-header">
                          <div className="om-config-title">
                            <Sliders size={16} />
                            <span>Modular Type Parameters</span>
                          </div>
                          <span className="om-config-badge">
                            {activeFieldTypeMeta?.label || editFieldLogicalType.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>

                        {editFieldLogicalType === 'select' ? (
                          <div className="om-form-grid-2">
                            {/* Tab Switcher for Source Type */}
                            <div className="om-field-group om-field-group--full">
                              <label className="om-field-label">Option Value Source *</label>
                              <div className="om-tab-group">
                                <button
                                  type="button"
                                  className={`om-tab-button ${editDynamicConfigValues.sourceType !== 'object' ? 'om-tab-button--active' : ''}`}
                                  onClick={() => {
                                    setEditDynamicConfigValues((prev: Record<string, any>) => {
                                      const next: Record<string, any> = { ...prev, sourceType: 'custom' };
                                      delete next.sourceTable;
                                      delete next.sourceColumn;
                                      return next;
                                    });
                                  }}
                                >
                                  Manual Custom List
                                </button>
                                <button
                                  type="button"
                                  className={`om-tab-button ${editDynamicConfigValues.sourceType === 'object' ? 'om-tab-button--active' : ''}`}
                                  onClick={() => {
                                    setEditDynamicConfigValues((prev: Record<string, any>) => {
                                      const next: Record<string, any> = { ...prev, sourceType: 'object' };
                                      delete next.optionsText;
                                      return next;
                                    });
                                  }}
                                >
                                  Lookup Values from Data Model
                                </button>
                              </div>
                            </div>

                            {editDynamicConfigValues.sourceType !== 'object' ? (
                              <div className="om-field-group om-field-group--full">
                                <label className="om-field-label">Custom Options (One Per Line) *</label>
                                <textarea
                                  className="klao-input"
                                  placeholder={'Draft\nIn Review\nApproved\nClosed'}
                                  rows={10}
                                  value={editDynamicConfigValues.optionsText || ''}
                                  onChange={e => setEditDynamicConfigValues(prev => ({ ...prev, optionsText: e.target.value }))}
                                  style={{ resize: 'vertical', minHeight: '220px' }}
                                />
                                <span className="om-field-hint">Enter choices on separate lines (one option per line).</span>
                              </div>
                            ) : (
                              <>
                                <div className="om-field-group">
                                  <label className="om-field-label">Source Data Model *</label>
                                  <CustomSelect
                                    size="md"
                                    value={editDynamicConfigValues.sourceTable || ''}
                                    options={tables.map(t => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
                                    onChange={val => setEditDynamicConfigValues(prev => ({
                                      ...prev,
                                      sourceTable: val,
                                      sourceColumn: ''
                                    }))}
                                    placeholder="Select Source Data Model"
                                  />
                                </div>
                                <div className="om-field-group">
                                  <label className="om-field-label">Source Field / Column *</label>
                                  {(() => {
                                    const selectedTargetTableObj = tables.find(t => t.tableName === editDynamicConfigValues.sourceTable);
                                    const fieldOptions = selectedTargetTableObj?.fields
                                      ? selectedTargetTableObj.fields.map(f => ({
                                          value: f.fieldName,
                                          label: `${f.name} (${f.fieldName})`
                                        }))
                                      : [];

                                    return (
                                      <CustomSelect
                                        size="md"
                                        value={editDynamicConfigValues.sourceColumn || ''}
                                        options={fieldOptions}
                                        onChange={val => setEditDynamicConfigValues(prev => ({ ...prev, sourceColumn: val }))}
                                        placeholder={selectedTargetTableObj ? "Select Source Field" : "Select Data Model First"}
                                        disabled={!selectedTargetTableObj}
                                      />
                                    );
                                  })()}
                                </div>
                              </>
                            )}

                            <div className="om-field-group" style={{ gridColumn: 'span 2' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={!!editDynamicConfigValues.allowMultiple}
                                  onChange={e => setEditDynamicConfigValues(prev => ({ ...prev, allowMultiple: e.target.checked }))}
                                  style={{ width: 'auto' }}
                                />
                                <label className="om-field-label" style={{ margin: 0 }}>Allow Multi-Select</label>
                              </div>
                            </div>
                          </div>
                        ) : (!activeFieldTypeMeta?.parametersSchema || activeFieldTypeMeta.parametersSchema.length === 0) ? (
                          <p style={{ color: 'var(--klao-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                            This field type does not require additional parameters.
                          </p>
                        ) : (
                          <div className="om-form-grid-2">
                            {activeFieldTypeMeta.parametersSchema.map((param: FieldParameterDefinition) => {
                              if (param.type === 'select') {
                                return (
                                  <div key={param.name} className="om-field-group">
                                    <label className="om-field-label">{param.label}</label>
                                    <CustomSelect
                                      size="md"
                                      value={editDynamicConfigValues[param.name] ?? param.defaultValue ?? ''}
                                      options={param.options || []}
                                      onChange={val => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                    />
                                  </div>
                                );
                              }

                              if (param.type === 'boolean') {
                                return (
                                  <div key={param.name} className="om-field-group" style={{ justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                      <input
                                        type="checkbox"
                                        checked={!!editDynamicConfigValues[param.name]}
                                        onChange={e => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.checked }))}
                                        style={{ width: 'auto' }}
                                      />
                                      <label className="om-field-label" style={{ margin: 0 }}>{param.label}</label>
                                    </div>
                                  </div>
                                );
                              }

                              if (param.type === 'model_select') {
                                return (
                                  <div key={param.name} className="om-field-group">
                                    <label className="om-field-label">{param.label} *</label>
                                    <CustomSelect
                                      size="md"
                                      value={editDynamicConfigValues[param.name] || ''}
                                      options={tables.map(t => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
                                      onChange={val => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                      placeholder="Select Target Model"
                                    />
                                  </div>
                                );
                              }

                              if (param.type === 'textarea') {
                                return (
                                  <div key={param.name} className="om-field-group om-field-group--full">
                                    <label className="om-field-label">{param.label}</label>
                                    <textarea
                                      className="klao-input"
                                      placeholder={param.placeholder}
                                      rows={4}
                                      value={editDynamicConfigValues[param.name] || ''}
                                      onChange={e => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                                      style={{ resize: 'vertical' }}
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div key={param.name} className="om-field-group">
                                  <label className="om-field-label">{param.label}</label>
                                  <input
                                    type={param.type === 'number' ? 'number' : 'text'}
                                    className="klao-input"
                                    placeholder={param.placeholder}
                                    min={param.min}
                                    max={param.max}
                                    value={editDynamicConfigValues[param.name] ?? ''}
                                    onChange={e => setEditDynamicConfigValues(prev => ({ 
                                      ...prev, 
                                      [param.name]: param.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value 
                                    }))}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="om-modal-footer">
              {editFieldWizardStep === 1 ? (
                <>
                  <button 
                    className="klao-btn klao-btn--ghost" 
                    onClick={() => setEditingField(null)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="klao-btn klao-btn--primary" 
                    disabled={!editFieldName || !editFieldDbName}
                    onClick={() => setEditFieldWizardStep(2)}
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="klao-btn klao-btn--ghost" 
                    onClick={() => setEditFieldWizardStep(1)}
                  >
                    Back
                  </button>
                  <button 
                    className="klao-btn klao-btn--primary" 
                    onClick={handleUpdateField}
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Nice Error Notification Modal */}
      {errorMsg && createPortal(
        <div className="om-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="om-modal glass-morphism animate-fade-in" style={{ width: '400px', textAlign: 'center', padding: '24px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--klao-danger, #ef4444)' }}>
              <XCircle size={48} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px 0', color: 'white' }}>Action Failed</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--klao-text-muted)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="klao-btn klao-btn--primary" 
                onClick={() => setErrorMsg(null)}
                style={{ minWidth: '120px' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmTarget && createPortal(
        <div className="om-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="om-modal glass-morphism animate-fade-in" style={{ width: '440px', padding: '32px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ 
                background: 'rgba(253, 97, 97, 0.15)', 
                color: 'var(--klao-danger, #fd6161)', 
                padding: '12px', 
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 8px 0', color: 'white' }}>
                  {deleteConfirmTarget.type === 'table' ? 'Delete Data Model' : 'Remove Field'}
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--klao-text-muted)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                  {deleteConfirmTarget.type === 'table' ? (
                    <>
                      Are you sure you want to delete the data model <strong>"{deleteConfirmTarget.name}"</strong>? This will physically drop the physical database table <code>{deleteConfirmTarget.extra}</code> and permanently destroy all records. This action cannot be undone.
                    </>
                  ) : (
                    <>
                      Are you sure you want to remove the field <strong>"{deleteConfirmTarget.name}"</strong> from this data model? This will drop the physical column from the database. This action cannot be undone.
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button 
                    className="klao-btn klao-btn--ghost" 
                    onClick={() => setDeleteConfirmTarget(null)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="klao-btn" 
                    onClick={async () => {
                      const { type, id } = deleteConfirmTarget;
                      setDeleteConfirmTarget(null);
                      if (type === 'table') {
                        await executeDeleteTable(id);
                      } else {
                        await executeDeleteField(id);
                      }
                    }}
                    style={{ 
                      background: 'var(--klao-danger, #fd6161)', 
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ObjectManager;
