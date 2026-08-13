/**
 * IconPicker — searchable Lucide icon chooser for apps/menus.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { Search, X } from 'lucide-react';
import DynamicIcon from './DynamicIcon';
import './IconPicker.css';

const ICON_NAMES = [
  'Activity', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
  'Award', 'BarChart', 'BarChart3', 'Bell', 'Blocks',
  'Book', 'BookOpen', 'Bookmark', 'Box', 'Briefcase',
  'Building', 'Calendar', 'Camera', 'CheckCircle', 'ChevronDown',
  'ChevronLeft', 'ChevronRight', 'ChevronUp', 'Circle', 'Clipboard',
  'ClipboardCheck', 'Clock', 'Cloud', 'Code', 'Code2',
  'Columns', 'Command', 'Compass', 'Copy', 'CreditCard',
  'Crop', 'Crosshair', 'Crown', 'Boxes', 'Database',
  'Disc', 'DollarSign', 'Download', 'Droplets', 'Edit',
  'Edit3', 'ExternalLink', 'Eye', 'EyeOff', 'FastForward',
  'File', 'FileClock', 'FileDigit', 'FileText', 'Flag',
  'Folder', 'FolderOpen', 'Frown', 'Gauge', 'Gift',
  'GitBranch', 'GitCommit', 'GitFork', 'GitMerge', 'GitPullRequest',
  'Globe', 'Grid', 'GripVertical', 'Hammer', 'HardDrive',
  'Hash', 'Headphones', 'Heart', 'HelpCircle', 'Home',
  'Image', 'Inbox', 'Info', 'Key', 'Layers',
  'Layout', 'LayoutDashboard', 'LayoutGrid', 'LayoutPanelTop', 'LayoutTemplate',
  'Library', 'LifeBuoy', 'Lightbulb', 'LineChart', 'Link',
  'List', 'Loader', 'Lock', 'LogIn', 'LogOut',
  'Mail', 'Map', 'MapPin', 'Maximize', 'Megaphone',
  'Menu', 'MessageCircle', 'MessageSquare', 'Mic', 'Minimize',
  'Minus', 'Monitor', 'Moon', 'MoreHorizontal', 'MoreVertical',
  'Move', 'Music', 'Network', 'Newspaper', 'Nut',
  'Package', 'Palette', 'Paperclip', 'Pause', 'Pen',
  'Pencil', 'Percent', 'Phone', 'PieChart', 'Pin',
  'Play', 'Plug', 'Plus', 'PlusCircle', 'Podcast',
  'Power', 'Printer', 'Radio', 'RefreshCw', 'Reply',
  'Rocket', 'RotateCw', 'Rss', 'Save', 'Scissors',
  'Search', 'Send', 'Server', 'Settings', 'Share',
  'Share2', 'Shield', 'ShieldCheck', 'ShieldOff', 'Ship',
  'ShoppingBag', 'ShoppingCart', 'Shuffle', 'Sigma', 'Slack',
  'Sliders', 'Smartphone', 'Smile', 'SortAsc', 'SortDesc',
  'Speaker', 'Star', 'StopCircle', 'Sun', 'Table',
  'Table2', 'Tablet', 'Tag', 'Target', 'Terminal',
  'Text', 'ThumbsDown', 'ThumbsUp', 'Timer', 'ToggleLeft',
  'ToggleRight', 'Cog', 'Trash', 'Trash2', 'TrendingDown',
  'TrendingUp', 'Triangle', 'Truck', 'Tv', 'Type',
  'Umbrella', 'Underline', 'Undo', 'Unlink', 'Unlock',
  'Upload', 'User', 'UserCheck', 'UserMinus', 'UserPlus',
  'UserSquare', 'UserX', 'Users', 'Verified', 'Video',
  'Voicemail', 'Volume', 'Volume1', 'Volume2', 'VolumeX',
  'Wallet', 'Wand', 'Watch', 'Webhook', 'Wifi',
  'Wind', 'Wrench', 'X', 'XCircle', 'XSquare',
  'Zap', 'ZoomIn', 'ZoomOut',
];

/**
 * Filter against the actual lucide exports at module load — covers deprecated
 * aliases (e.g. 'CheckCircle' → CircleCheckBig) and drops any entry a future
 * lucide upgrade renames/removes, so the picker can never offer a broken icon.
 * Note: lucide components are forwardRef objects (not functions), so check for
 * presence rather than typeof === 'function'.
 */
const ICONS = ICON_NAMES.filter((name) => (LucideIcons as any)[name] != null);

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
  /** Curated subset to offer instead of the full catalog (e.g. action buttons). */
  icons?: string[];
}

const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, disabled, icons }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Subset mode: filter the provided list the same way as the full catalog and
  // dedupe; falls back to the full catalog when no subset is given.
  const available = React.useMemo(() => {
    const pool = icons || ICONS;
    const seen = new Set<string>();
    return pool.filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return (LucideIcons as any)[name] != null;
    });
  }, [icons]);

  const [filtered, setFiltered] = useState(available);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFiltered(available);
  }, [available]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? available.filter(name => name.toLowerCase().includes(q)) : available
    );
  }, [search, available]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="sails-icon-picker">
      <button
        type="button"
        className="sails-icon-picker__trigger"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <DynamicIcon name={value || 'Circle'} size={20} />
        <span className="sails-icon-picker__name">{value || 'Select icon'}</span>
        <span className="sails-icon-picker__chevron">▼</span>
      </button>

      {isOpen && createPortal(
        <div className="sails-icon-picker__overlay" onClick={() => setIsOpen(false)}>
          <div className="sails-icon-picker__modal" onClick={e => e.stopPropagation()}>
            <div className="sails-icon-picker__header">
              <h3>Select Icon</h3>
              <button type="button" className="sails-icon-picker__close" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="sails-icon-picker__search">
              <Search size={16} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search icons..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="sails-icon-picker__clear" onClick={() => setSearch('')}>
                  <X size={16} />
                </button>
              )}
            </div>
            <div className={`sails-icon-picker__grid ${icons ? 'sails-icon-picker__grid--curated' : ''}`}>
              {filtered.length === 0 ? (
                <div className="sails-icon-picker__empty">No icons found</div>
              ) : (
                filtered.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={`sails-icon-picker__item ${name === value ? 'sails-icon-picker__item--active' : ''}`}
                    onClick={() => handleSelect(name)}
                    title={name}
                  >
                    <DynamicIcon name={name} size={24} />
                    <span>{name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default IconPicker;
