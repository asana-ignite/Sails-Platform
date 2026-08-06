import React from 'react';
import { Search } from 'lucide-react';

export const UiSearchBar: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = 'Search...', className }) => (
  <div className={`ui-search ${className || ''}`}>
    <div className="ui-search__wrapper">
      <Search size={16} className="ui-search__icon" />
      <input
        type="text"
        className="ui-search__input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

export default UiSearchBar;
