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
  ChevronLeft,
  Eye,
  MoreHorizontal,
  Edit2,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';
import './ObjectManager.css';

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
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldDbName, setNewFieldDbName] = useState('');
  const [newFieldDesc, setNewFieldDesc] = useState('');
  const [newFieldLogicalType, setNewFieldLogicalType] = useState('short_text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  
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
          description: newFieldDesc,
          config: {}
        })
      });

      if (res.ok) {
        setIsCreatingField(false);
        setNewFieldName('');
        setNewFieldDbName('');
        setNewFieldDesc('');
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
                            <div className="om-name-primary">{renderHighlightedText(table.name, searchTerm)}</div>
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
                      <th>Logical Type</th>
                      <th>Required</th>
                      <th style={{ textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFields.map(field => (
                      <tr key={field.id} className="om-clickable-row">
                        <td>
                          <div className="om-table-cell-name">
                            <div className="om-table-icon-wrapper">
                              <Settings size={18} />
                            </div>
                            <div>
                              <div className="om-name-primary">{renderHighlightedText(field.name, fieldSearchTerm)}</div>
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
                          <span className="om-badge">
                            {renderHighlightedText(field.logicalType, fieldSearchTerm)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--klao-text-muted)', marginLeft: '6px' }}>
                            ({field.physicalType})
                          </span>
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
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
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
                    // Auto-fill System Name by removing non-alphanumeric and lowercasing
                    setNewTableDbName(val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                  }}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">System Name</label>
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

      {/* Edit Table Slide-over Drawer */}
      {editingTable && createPortal(
        <div className="klao-add-drawer" id="klao-table-edit-drawer">
          <div className="klao-add-drawer__overlay" onClick={() => setEditingTable(null)}></div>
          <div className="klao-add-drawer__panel">
            <div className="klao-add-drawer__header">
              <div className="klao-add-drawer__header-info">
                <h2 className="klao-add-drawer__title">Edit Data Model</h2>
                <p className="klao-add-drawer__subtitle">
                  Update display name and description for {editingTable.name}.
                </p>
              </div>
              <button 
                className="klao-add-drawer__close" 
                onClick={() => setEditingTable(null)}
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
                  autoFocus 
                  value={editTableName}
                  onChange={e => setEditTableName(e.target.value)}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">System Name</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  value={editingTable.tableName}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Description</label>
                <textarea 
                  className="klao-input" 
                  rows={4}
                  value={editTableDesc}
                  onChange={e => setEditTableDesc(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>
            </div>

            <div className="klao-add-drawer__footer">
              <button className="klao-btn klao-btn--ghost" onClick={() => setEditingTable(null)}>Cancel</button>
              <button className="klao-btn klao-btn--primary" onClick={handleSaveEditTable}>Save Changes</button>
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
                  onChange={e => {
                    const val = e.target.value;
                    setNewFieldName(val);
                    // Auto-fill System Name by removing space or non-alphanumeric and lowercasing
                    setNewFieldDbName(val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                  }}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">System Name</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  placeholder="e.g. amount" 
                  value={newFieldDbName}
                  onChange={e => setNewFieldDbName(e.target.value)}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Description (Optional)</label>
                <textarea 
                  className="klao-input" 
                  placeholder="Describe the purpose of this field..." 
                  value={newFieldDesc}
                  onChange={e => setNewFieldDesc(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Logical Type</label>
                <CustomSelect 
                  size="md"
                  value={newFieldLogicalType} 
                  options={[
                    { value: 'short_text', label: 'Short Text' },
                    { value: 'long_text', label: 'Long Text' },
                    { value: 'number', label: 'Number' },
                    { value: 'boolean', label: 'Boolean' },
                    { value: 'email', label: 'Email' }
                  ]}
                  onChange={val => setNewFieldLogicalType(val)}
                  style={{ width: '100%' }}
                />
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
