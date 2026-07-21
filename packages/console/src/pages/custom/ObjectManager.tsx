import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { KlaoTableDefinition } from '@klao/shared';
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
  Eye,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import './ObjectManager.css';

const ObjectManager: React.FC = () => {
  const [tables, setTables] = useState<KlaoTableDefinition[]>([]);
  const [selectedTable, setSelectedTable] = useState<KlaoTableDefinition | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [isCreatingField, setIsCreatingField] = useState(false);
  
  // Table form state
  const [newTableName, setNewTableName] = useState('');
  const [newTableDbName, setNewTableDbName] = useState('');
  const [newTableDesc, setNewTableDesc] = useState('');
  
  // Field form state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldDbName, setNewFieldDbName] = useState('');
  const [newFieldLogicalType, setNewFieldLogicalType] = useState('short_text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  
  // Custom Error Modal State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { setHeaderActions } = useConsole();

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

  const handleCreateTable = async () => {
    if (!newTableName || !newTableDbName) return;

    // Validation: English and Numbers only
    const nameRegex = /^[a-zA-Z0-9\s]+$/;
    const dbNameRegex = /^[a-zA-Z0-9]+$/;

    if (!nameRegex.test(newTableName)) {
      setErrorMsg('Data Model Name must contain only English letters, numbers, and spaces.');
      return;
    }

    if (!dbNameRegex.test(newTableDbName)) {
      setErrorMsg('Database Table Name must contain only English letters and numbers (no spaces or special characters).');
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

    let physicalType = 'text';
    if (newFieldLogicalType === 'number') physicalType = 'integer';
    if (newFieldLogicalType === 'boolean') physicalType = 'boolean';

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
          config: {}
        })
      });

      if (res.ok) {
        setIsCreatingField(false);
        setNewFieldName('');
        setNewFieldDbName('');
        setNewFieldLogicalType('short_text');
        setNewFieldRequired(false);
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to create field');
      }
    } catch (error) {
      console.error('Error creating field:', error);
    }
  };

  // Filtered tables based on search term
  const filteredTables = useMemo(() => {
    return tables.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.tableName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tables, searchTerm]);

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
                placeholder="Search data models..."
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
                  <th>Fields</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTables.map(table => (
                  <tr key={table.id} className="om-clickable-row" onClick={() => selectRow(table)}>
                    <td>
                      <div className="om-table-cell-name">
                        <div className="om-table-icon-wrapper">
                          <Layers size={18} />
                        </div>
                        <div>
                          <div className="om-name-primary">{table.name}</div>
                          <div className="om-name-secondary"><code>{table.tableName}</code></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="om-desc-text">{table.description || 'No description provided.'}</span>
                    </td>
                    <td>
                      <span className="om-badge">{table._count?.fields || 0} Fields</span>
                    </td>
                    <td>
                      <span className="om-date-cell">
                        <Calendar size={14} style={{ marginRight: '4px' }} />
                        {table.createdAt ? new Date(table.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <button className="klao-btn klao-btn--ghost" onClick={() => selectRow(table)}>
                        <Eye size={16} style={{ marginRight: '6px' }} />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
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
          </div>
        </div>
      ) : (
        selectedTable && (
          <div className="om-detail-view-full animate-fade-in">
            {/* Header info */}
            <div className="om-detail-header-full">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="om-back-btn" onClick={() => { setViewMode('list'); setSelectedTable(null); }}>
                    <ArrowLeft size={20} />
                  </button>
                  <h1 className="om-detail-title-text">{selectedTable.name}</h1>
                </div>
                <div className="om-detail-meta-text">
                  <code>{(selectedTable as any).tenant?.schemaName || 'tenant_schema'}.{selectedTable.tableName}</code> • Schema ID: {selectedTable.id}
                </div>
              </div>
            </div>

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
              <div className="om-section-header-full">
                <h2>Field Definitions</h2>
              </div>

              <div className="klao-card om-fields-table-card">
                <table className="om-data-table">
                  <thead>
                    <tr>
                      <th>Display Name</th>
                      <th>Physical Column Name</th>
                      <th>Logical Type</th>
                      <th>Required</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTable.fields || []).map(field => (
                      <tr key={field.id}>
                        <td>
                          <strong>{field.name}</strong>
                        </td>
                        <td>
                          <code>{field.fieldName}</code>
                        </td>
                        <td>
                          <span className="type-tag">{field.logicalType}</span>
                          <span className="physical-type">({field.physicalType})</span>
                        </td>
                        <td>
                          {field.isRequired ? (
                            <span className="om-status-tag om-status-tag--required">
                              <CheckCircle2 size={12} />
                              Required
                            </span>
                          ) : (
                            <span className="om-status-tag om-status-tag--optional">
                              Optional
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="klao-btn klao-btn--ghost">
                            <Settings size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(selectedTable.fields || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="om-empty-state-row">
                          <Info size={32} className="om-empty-icon" />
                          <h3>No Fields Defined</h3>
                          <p>Click "Add Field" to define structure for this data model.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* Create Table Slide-over Drawer */}
      {isCreatingTable && createPortal(
        <div className="klao-add-drawer" id="klao-table-add-drawer">
          <div className="klao-add-drawer__overlay" onClick={() => setIsCreatingTable(false)}></div>
          <div className="klao-add-drawer__panel">
            <div className="klao-add-drawer__header">
              <div className="klao-add-drawer__header-info">
                <h2 className="klao-add-drawer__title">Create New Data Model</h2>
                <p className="klao-add-drawer__subtitle">
                  Define a new database table and schema definition.
                </p>
              </div>
              <button 
                className="klao-add-drawer__close" 
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

            <div className="klao-add-drawer__body">
              <div className="klao-form-group">
                <label className="klao-label">Data Model Name</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  placeholder="e.g. Sales Opportunities" 
                  autoFocus 
                  value={newTableName}
                  onChange={e => {
                    const val = e.target.value;
                    setNewTableName(val);
                    // Auto-fill Database Table Name by removing spaces and lowercasing
                    setNewTableDbName(val.replace(/\s+/g, '').toLowerCase());
                  }}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Database Table Name</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  placeholder="e.g. opportunities" 
                  value={newTableDbName}
                  onChange={e => setNewTableDbName(e.target.value)}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Description</label>
                <textarea 
                  className="klao-input" 
                  placeholder="Describe the data model's purpose" 
                  rows={4}
                  value={newTableDesc}
                  onChange={e => setNewTableDesc(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>
            </div>

            <div className="klao-add-drawer__footer">
              <button className="klao-btn klao-btn--ghost" onClick={() => setIsCreatingTable(false)}>Cancel</button>
              <button className="klao-btn klao-btn--primary" onClick={handleCreateTable}>Create Table</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create Field Slide-over Drawer */}
      {isCreatingField && createPortal(
        <div className="klao-add-drawer" id="klao-field-add-drawer">
          <div className="klao-add-drawer__overlay" onClick={() => setIsCreatingField(false)}></div>
          <div className="klao-add-drawer__panel">
            <div className="klao-add-drawer__header">
              <div className="klao-add-drawer__header-info">
                <h2 className="klao-add-drawer__title">Add New Field</h2>
                <p className="klao-add-drawer__subtitle">
                  Define a new column structure within this table.
                </p>
              </div>
              <button 
                className="klao-add-drawer__close" 
                onClick={() => {
                  setIsCreatingField(false);
                  setNewFieldName('');
                  setNewFieldDbName('');
                  setNewFieldLogicalType('short_text');
                  setNewFieldRequired(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="klao-add-drawer__body">
              <div className="klao-form-group">
                <label className="klao-label">Display Name</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  placeholder="e.g. Amount" 
                  autoFocus 
                  value={newFieldName}
                  onChange={e => setNewFieldName(e.target.value)}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Database Column Name</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  placeholder="e.g. amount" 
                  value={newFieldDbName}
                  onChange={e => setNewFieldDbName(e.target.value)}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Logical Type</label>
                <select 
                  className="klao-input" 
                  value={newFieldLogicalType} 
                  onChange={e => setNewFieldLogicalType(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px' }}
                >
                  <option value="short_text">Short Text</option>
                  <option value="long_text">Long Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div className="klao-form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <input 
                  type="checkbox" 
                  checked={newFieldRequired}
                  onChange={e => setNewFieldRequired(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <label className="klao-label" style={{ margin: 0 }}>Required Field</label>
              </div>
            </div>

            <div className="klao-add-drawer__footer">
              <button className="klao-btn klao-btn--ghost" onClick={() => setIsCreatingField(false)}>Cancel</button>
              <button className="klao-btn klao-btn--primary" onClick={handleCreateField}>Add Field</button>
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
    </div>
  );
};

export default ObjectManager;
