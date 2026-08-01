import React, { useState } from 'react';
import {
  Filter, Layers, X, LayoutGrid, Check, Play, RefreshCw,
  Search, ArrowRight, Table, Settings, ArrowLeft
} from 'lucide-react';
import { QueryStudioWidget, MOCK_LEAD_FIELDS, SimpleFilterRule } from './QueryStudioWidget';
import './QueryStudioWidget.css';

export const QueryStudioDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PANEL' | 'DRAWER' | 'MODAL'>('PANEL');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedRules, setAppliedRules] = useState<SimpleFilterRule[] | null>(null);

  const handleApply = (rules: SimpleFilterRule[]) => {
    setAppliedRules(rules);
    setIsDrawerOpen(false);
    setIsModalOpen(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      color: '#0f172a',
      padding: '30px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Top Banner & Context Switcher */}
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto 24px auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '20px 24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{
              background: '#e0f2fe',
              color: '#0369a1',
              border: '1px solid #bae6fd',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              LIGHT MODE MOCKUP
            </span>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>
              LayoutStudio Style Filter Studio Widget
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
            Clean, linear filter row builder using standard SAILS controls (`CustomSelect` + `sails-input`).
          </p>
        </div>

        {/* Display Mode Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('PANEL')}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 500,
              borderRadius: '6px',
              border: '1px solid ' + (activeTab === 'PANEL' ? '#0284c7' : '#cbd5e1'),
              background: activeTab === 'PANEL' ? '#0284c7' : '#ffffff',
              color: activeTab === 'PANEL' ? '#ffffff' : '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LayoutGrid size={14} /> Embedded Panel
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('DRAWER');
              setIsDrawerOpen(true);
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 500,
              borderRadius: '6px',
              border: '1px solid ' + (activeTab === 'DRAWER' ? '#0284c7' : '#cbd5e1'),
              background: activeTab === 'DRAWER' ? '#0284c7' : '#ffffff',
              color: activeTab === 'DRAWER' ? '#ffffff' : '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Filter size={14} /> Drawer
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('MODAL');
              setIsModalOpen(true);
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 500,
              borderRadius: '6px',
              border: '1px solid ' + (activeTab === 'MODAL' ? '#0284c7' : '#cbd5e1'),
              background: activeTab === 'MODAL' ? '#0284c7' : '#ffffff',
              color: activeTab === 'MODAL' ? '#ffffff' : '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Settings size={14} /> Modal
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Scenario 1: Embedded Panel */}
        {activeTab === 'PANEL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <QueryStudioWidget
              fields={MOCK_LEAD_FIELDS}
              onApply={handleApply}
              title="Edit View Filters — Lead Data Model"
            />
          </div>
        )}

        {/* Table Mockup Container showing live filter status */}
        <div style={{
          marginTop: '24px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Table size={16} style={{ color: '#0284c7' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>Record Table Preview (Leads)</h3>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {activeTab === 'DRAWER' && (
                <button
                  type="button"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => setIsDrawerOpen(true)}
                >
                  <Filter size={14} /> Edit Filters (Drawer)
                </button>
              )}
              {activeTab === 'MODAL' && (
                <button
                  type="button"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => setIsModalOpen(true)}
                >
                  <Filter size={14} /> Edit Filters (Modal)
                </button>
              )}
            </div>
          </div>

          {appliedRules && appliedRules.length > 0 ? (
            <div style={{
              background: '#e0f2fe',
              border: '1px solid #bae6fd',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#0369a1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                <strong>{appliedRules.length} Active Filters Applied:</strong>{' '}
                {appliedRules.map((r, i) => {
                  const f = MOCK_LEAD_FIELDS.find((x) => x.id === r.fieldId);
                  return (
                    <span key={r.id}>
                      {i > 0 ? ` ${r.logic.toUpperCase()} ` : ''}
                      <code style={{ background: '#ffffff', padding: '1px 5px', borderRadius: '4px' }}>
                        {f?.name || r.fieldId} {r.operator} {r.value || '—'}
                      </code>
                    </span>
                  );
                })}
              </span>
              <button
                type="button"
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  background: 'transparent',
                  border: '1px solid #0284c7',
                  color: '#0284c7',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => setAppliedRules(null)}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
              No custom filters applied yet. Click "Apply Filters" inside the widget to preview filtering.
            </div>
          )}
        </div>
      </div>

      {/* Scenario 2: Slide-Over Drawer */}
      {isDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '560px',
            maxWidth: '90vw',
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>Filter Drawer</span>
              </div>
              <button
                type="button"
                className="qs-delete-btn"
                onClick={() => setIsDrawerOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <QueryStudioWidget
                fields={MOCK_LEAD_FIELDS}
                onApply={handleApply}
                showHeader={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Scenario 3: Modal Dialog */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '720px',
            maxWidth: '95vw',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} style={{ color: '#7c3aed' }} />
                <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>Filter Modal Dialog</span>
              </div>
              <button
                type="button"
                className="qs-delete-btn"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto' }}>
              <QueryStudioWidget
                fields={MOCK_LEAD_FIELDS}
                onApply={handleApply}
                title="Edit View Filters"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryStudioDemo;
