import React from 'react';
import { Search, X } from 'lucide-react';
import './MobileSearchBar.css';

interface MobileSearchBarProps {
  isVisible: boolean;
  onClose: () => void;
}

const MobileSearchBar: React.FC<MobileSearchBarProps> = ({ isVisible, onClose }) => {
  return (
    <div className={`inidos-mobile-search-bar ${isVisible ? 'inidos-mobile-search-bar--visible' : ''}`}>
      <div className="inidos-mobile-search-bar__inner">
        <Search className="inidos-mobile-search-bar__icon" size={20} />
        <input 
          type="text" 
          className="inidos-mobile-search-bar__input" 
          placeholder="Search leads, contacts..."
          autoFocus={isVisible}
        />
        <button className="inidos-mobile-search-bar__close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default MobileSearchBar;
