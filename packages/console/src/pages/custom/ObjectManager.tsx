import React, { useState } from 'react';
import { KlaoTableDefinition } from '@klao/shared';
import './ObjectManager.css';

// Mock data for demonstration
const MOCK_TABLES: KlaoTableDefinition[] = [
  {
    id: 't1',
    tenantId: '1',
    name: 'Sales Leads',
    tableName: 'leads',
    description: 'Potential customers from various marketing channels.',
    createdAt: new Date().toISOString(),
    _count: { fields: 8 },
    fields: [
      { id: 'f1', tableId: 't1', name: 'Full Name', fieldName: 'name', physicalType: 'text', logicalType: 'short_text', isRequired: true, createdAt: '' },
      { id: 'f2', tableId: 't1', name: 'Email Address', fieldName: 'email', physicalType: 'text', logicalType: 'email', isRequired: true, createdAt: '' },
    ]
  },
  {
    id: 't2',
    tenantId: '1',
    name: 'Invoices',
    tableName: 'invoices',
    description: 'Billing records and payment statuses.',
    createdAt: new Date().toISOString(),
    _count: { fields: 12 }
  }
];

const ObjectManager: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<KlaoTableDefinition | null>(MOCK_TABLES[0]);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="object-manager-container">
      {/* Sidebar: Object List */}
      <div className="om-sidebar glass-morphism">
        <div className="om-sidebar-header">
          <h3>Data Models</h3>
          <button className="icon-btn" onClick={() => setIsCreating(true)}>
            <span className="mdi mdi-plus"></span>
          </button>
        </div>
        <div className="om-object-list">
          {MOCK_TABLES.map(table => (
            <div 
              key={table.id} 
              className={`om-object-item ${selectedTable?.id === table.id ? 'active' : ''}`}
              onClick={() => setSelectedTable(table)}
            >
              <div className="om-item-icon">
                <span className="mdi mdi-database-outline"></span>
              </div>
              <div className="om-item-content">
                <div className="om-item-name">{table.name}</div>
                <div className="om-item-meta">{table._count?.fields} Fields • {table.tableName}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Object Detail */}
      <div className="om-main">
        {selectedTable ? (
          <div className="om-detail-view">
            <div className="om-detail-header">
              <div className="om-detail-title">
                <h1>{selectedTable.name}</h1>
                <code>tenant_schema.{selectedTable.tableName}</code>
              </div>
              <div className="om-detail-actions">
                <button className="btn-secondary">Settings</button>
                <button className="btn-primary">Add Field</button>
              </div>
            </div>

            <div className="om-stats-grid">
              <div className="om-stat-card glass-morphism">
                <label>Storage Type</label>
                <div className="stat-value">Relational (PostgreSQL)</div>
              </div>
              <div className="om-stat-card glass-morphism">
                <label>Total Records</label>
                <div className="stat-value">1,248</div>
              </div>
              <div className="om-stat-card glass-morphism">
                <label>Security Mode</label>
                <div className="stat-value">Row-Level (RLS)</div>
              </div>
            </div>

            <div className="om-section">
              <div className="section-header">
                <h2>Field Definitions</h2>
                <div className="section-actions">
                  <input type="text" placeholder="Filter fields..." className="filter-input" />
                </div>
              </div>

              <div className="om-fields-table glass-morphism">
                <table className="om-data-table">
                  <thead>
                    <tr>
                      <th>Display Name</th>
                      <th>Physical Name</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTable.fields || []).map(field => (
                      <tr key={field.id}>
                        <td><strong>{field.name}</strong></td>
                        <td><code>{field.fieldName}</code></td>
                        <td>
                          <span className="type-tag">{field.logicalType}</span>
                          <span className="physical-type">({field.physicalType})</span>
                        </td>
                        <td>{field.isRequired ? 'Yes' : 'No'}</td>
                        <td>
                          <button className="icon-btn"><span className="mdi mdi-pencil"></span></button>
                        </td>
                      </tr>
                    ))}
                    {/* Placeholder for empty fields in mock */}
                    {(selectedTable.fields || []).length === 0 && (
                       <tr>
                         <td colSpan={5} className="empty-row">No fields defined yet.</td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="om-empty-state">
            <span className="mdi mdi-database-off-outline"></span>
            <h2>Select a Data Model</h2>
            <p>Choose an object from the sidebar to manage its schema and permissions.</p>
          </div>
        )}
      </div>

      {/* Create Modal Overlay */}
      {isCreating && (
        <div className="om-modal-overlay">
          <div className="om-modal glass-morphism">
            <h2>Create New Data Model</h2>
            <div className="form-group">
              <label>Object Name</label>
              <input type="text" placeholder="e.g. Sales Opportunities" />
            </div>
            <div className="form-group">
              <label>Database Table Name</label>
              <input type="text" placeholder="e.g. opportunities" />
            </div>
            <div className="om-modal-footer">
              <button className="btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
              <button className="btn-primary">Create Table</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObjectManager;
