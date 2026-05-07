import React from 'react';
import { useConsole } from '../../contexts/ConsoleContext';
import DynamicIcon from '../common/DynamicIcon';
import './MobileAppSwitcher.css';

interface MobileAppSwitcherProps {
  isVisible: boolean;
  onClose: () => void;
}

const MobileAppSwitcher: React.FC<MobileAppSwitcherProps> = ({ isVisible, onClose }) => {
  const { apps, activeApp, setActiveApp, isLoading } = useConsole();

  const handleAppClick = (appId: string) => {
    setActiveApp(appId);
    onClose();
  };

  return (
    <div className={`klao-mobile-app-switcher ${isVisible ? 'klao-mobile-app-switcher--visible' : ''}`}>
      {isLoading ? (
        <div className="klao-mobile-app-switcher__loading">Loading...</div>
      ) : (
        <div className="klao-mobile-app-switcher__grid">
          {apps.map((app) => (
            <div 
              key={app.id} 
              className={`klao-mobile-app-switcher__item ${activeApp?.id === app.id ? 'klao-mobile-app-switcher__item--active' : ''}`}
              onClick={() => handleAppClick(app.id)}
            >
              <div className="klao-mobile-app-switcher__icon-wrapper">
                <DynamicIcon name={app.icon || 'Box'} size={24} />
              </div>
              <span className="klao-mobile-app-switcher__name">{app.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileAppSwitcher;
