import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, Database } from 'lucide-react';
import './RecordPicker.css';

interface RecordPickerProps {
  targetTableName: string;
  targetTableLabel?: string;
  value: string;
  onChange: (recordId: string) => void;
  size?: 'sm' | 'md';
}

interface PickerRecord {
  id: string;
  label: string;
}

/** Pick a label field: prefer display-ish text fields, fall back to recordnumber/name/title/id. */
function pickLabelFields(fields: any[]): string[] {
  const names = (fields || []).map((f: any) => f.fieldName).filter(Boolean);
  const preferred = ['name', 'title', 'recordnumber', 'label', 'code'];
  const hit = preferred.find((p) => names.includes(p));
  if (hit) return [hit];
  const textLike = (fields || []).filter((f: any) =>
    ['text', 'varchar', 'string', 'char', 'email', 'phone'].includes(String(f.type || f.physicalType || '').toLowerCase())
  ).map((f: any) => f.fieldName);
  if (textLike.length > 0) return textLike.slice(0, 2);
  return names.length > 0 ? names.slice(0, 2) : ['id'];
}

function formatRecord(rec: any, labelFields: string[]): string {
  for (const f of labelFields) {
    const v = rec[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return rec.id || '—';
}

export const RecordPicker: React.FC<RecordPickerProps> = ({
  targetTableName,
  targetTableLabel,
  value,
  onChange,
  size = 'sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<PickerRecord[]>([]);
  const [labelFields, setLabelFields] = useState<string[]>(['id']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !targetTableName || fetchedRef.current === targetTableName) return;
    fetchedRef.current = targetTableName;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', '50');
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    fetch(`/api/dynamic/${targetTableName}?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) { setError('Could not load records'); return; }
        const fields = data.fields || [];
        const lf = pickLabelFields(fields);
        setLabelFields(lf);
        setRecords((data.rows || []).map((r: any) => ({ id: r.id, label: formatRecord(r, lf) })));
      })
      .catch(() => setError('Failed to load records'))
      .finally(() => setLoading(false));
  }, [isOpen, targetTableName, searchTerm]);

  const selected = records.find((r) => r.id === value);

  const toggle = () => {
    setIsOpen((v) => !v);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className="rp-wrap" style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        className={`sails-input rp-trigger rp-trigger--${size} ${isOpen ? 'is-open' : ''}`}
        onClick={toggle}
        title={targetTableLabel ? `Pick a record from ${targetTableLabel}` : 'Pick a record'}
      >
        <Database size={12} className="rp-trigger__icon" />
        <span className="rp-trigger__value">{selected ? selected.label : value ? `#${value.slice(0, 12)}…` : 'Select record...'}</span>
        <ChevronDown size={12} className="rp-trigger__chevron" />
      </button>

      {isOpen && (
        <div className="rp-dropdown">
          <div className="rp-dropdown__search">
            <Search size={12} className="rp-dropdown__search-icon" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${targetTableLabel || targetTableName} records...`}
              className="rp-dropdown__search-input"
            />
          </div>
          <div className="rp-dropdown__list">
            {loading ? (
              <div className="rp-dropdown__empty">Loading records...</div>
            ) : error ? (
              <div className="rp-dropdown__empty">{error}</div>
            ) : records.length === 0 ? (
              <div className="rp-dropdown__empty">No records found</div>
            ) : (
              records.map((r) => (
                <div
                  key={r.id}
                  className={`rp-option ${r.id === value ? 'is-selected' : ''}`}
                  onClick={() => { onChange(r.id); setIsOpen(false); }}
                >
                  <span className="rp-option__label">{r.label}</span>
                  <span className="rp-option__id">#{r.id.slice(0, 8)}</span>
                  {r.id === value && <Check size={13} className="rp-option__check" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordPicker;
