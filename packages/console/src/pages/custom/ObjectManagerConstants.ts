import { FieldTypeMetadata } from '@sails/shared';

export const DEFAULT_FIELD_TYPES: FieldTypeMetadata[] = [
  {
    type: 'auto_number',
    label: 'Auto Number',
    description: 'Auto-incrementing formatted identifier (supports date tokens: {YYYY}, {YY}, {MM}, {DD})',
    iconName: 'Hash',
    physicalType: 'text',
    parametersSchema: [
      {
        name: 'prefix',
        label: 'Format Pattern',
        type: 'text',
        placeholder: 'e.g. INV-0000 or INV-{yyyy}0000',
        description: 'Format pattern using zeroes (e.g. 0000 = 4 digits padding) and date tokens ({yyyy}, {mm}, {dd})'
      },
      {
        name: 'startingNumber',
        label: 'Starting Number',
        type: 'number',
        defaultValue: 1,
        min: 1,
        description: 'First sequence number for new records'
      }
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
    type: 'phone',
    label: 'Phone Number',
    description: 'Telephone or mobile phone number',
    iconName: 'Phone',
    physicalType: 'text',
    parametersSchema: [
      { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. +1 555-0199' }
    ]
  },
  {
    type: 'address',
    label: 'Address',
    description: 'Physical location and postal address',
    iconName: 'MapPin',
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
  }
];
