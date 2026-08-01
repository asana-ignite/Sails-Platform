import { FieldTypeMetadata } from './index';

export const FIELD_TYPE_REGISTRY: FieldTypeMetadata[] = [
  {
    type: 'auto_number',
    label: 'Auto Number',
    description: 'Auto-incrementing formatted identifier (supports date tokens: {YYYY}, {YY}, {MM}, {DD})',
    iconName: 'Binary',
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
    label: 'Number (Integer)',
    description: 'Whole number integer value',
    iconName: 'Hash',
    physicalType: 'number',
    parametersSchema: [
      { name: 'min', label: 'Minimum Value', type: 'number', placeholder: 'e.g. 0' },
      { name: 'max', label: 'Maximum Value', type: 'number', placeholder: 'e.g. 1000000' },
      { name: 'defaultValue', label: 'Default Value', type: 'number', placeholder: 'e.g. 0' }
    ]
  },
  {
    type: 'decimal',
    label: 'Decimal',
    description: 'High-precision decimal number',
    iconName: 'Binary',
    physicalType: 'number',
    parametersSchema: [
      { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 4, min: 0, max: 10 },
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
    description: 'Multi-line plain text block or documentation body',
    iconName: 'AlignLeft',
    physicalType: 'text',
    parametersSchema: [
      { name: 'maxLength', label: 'Max Character Length', type: 'number', defaultValue: 2000, min: 1 },
      { name: 'placeholder', label: 'Placeholder Text', type: 'text', placeholder: 'e.g. Provide details...' }
    ]
  },
  {
    type: 'rich_text',
    label: 'Rich Text',
    description: 'Formatted HTML text content with WYSIWYG editor',
    iconName: 'FileText',
    physicalType: 'text',
    parametersSchema: [
      { name: 'placeholder', label: 'Placeholder Text', type: 'text', placeholder: 'e.g. Enter formatted content...' }
    ]
  },
  {
    type: 'select',
    label: 'Selection',
    description: 'Select a single option from a custom list or lookup values from another data model',
    iconName: 'ListFilter',
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
    iconName: 'GitFork',
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
    iconName: 'ToggleRight',
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
    label: 'Date',
    description: 'Calendar date without time component',
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
      { name: 'defaultCurrent', label: 'Default to Today', type: 'boolean', defaultValue: false }
    ]
  },
  {
    type: 'time',
    label: 'Time',
    description: 'Clock time without date component',
    iconName: 'Clock',
    physicalType: 'time',
    parametersSchema: [
      {
        name: 'timeFormat',
        label: 'Display Time Format',
        type: 'select',
        defaultValue: '24h',
        options: [
          { label: '24 Hour (14:30)', value: '24h' },
          { label: '12 Hour AM/PM (2:30 PM)', value: '12h' }
        ]
      },
      { name: 'defaultCurrent', label: 'Default to Current Time', type: 'boolean', defaultValue: false }
    ]
  },
  {
    type: 'datetime',
    label: 'Date / Time',
    description: 'Calendar date and timestamp precision',
    iconName: 'CalendarDays',
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
    iconName: 'Coins',
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
    iconName: 'Percent',
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
    iconName: 'PhoneCall',
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
    iconName: 'Paperclip',
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
    type: 'user',
    label: 'User',
    description: 'Reference to internal platform user (User Manager)',
    iconName: 'UserCheck',
    physicalType: 'relation',
    parametersSchema: [
      {
        name: 'defaultToCurrentUser',
        label: 'Default to Currently Logged-in User',
        type: 'boolean',
        defaultValue: true,
        description: 'Automatically populate with active user when creating new record'
      },
      {
        name: 'roleFilter',
        label: 'Limit Selection by Role',
        type: 'select',
        defaultValue: 'all',
        options: [
          { label: 'All Active Users', value: 'all' },
          { label: 'Admins Only', value: 'ADMIN' },
          { label: 'Tenant Admins Only', value: 'TENANT_ADMIN' },
          { label: 'Standard Users Only', value: 'USER' }
        ]
      },
      {
        name: 'allowMultiple',
        label: 'Allow Multiple User Assignment',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow assigning multiple team members or co-owners'
      }
    ]
  }
];
