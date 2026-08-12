/**
 * AppLayout — the main app shell: sidebar + topbar + routed content.
 */
import React, { useState } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import WidgetBar from './WidgetBar';
import MobileNav from './MobileNav';
import MobileGlobalBar from './MobileGlobalBar';
import MobileSearchBar from './MobileSearchBar';
import MobileAppSwitcher from './MobileAppSwitcher';
import { useConsole } from '../../contexts/ConsoleContext';
import './AppLayout.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(false);
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  const [isMobileAppSwitcherVisible, setIsMobileAppSwitcherVisible] = useState(false);
  const { widgets, activeApp } = useConsole();

  const showWidgetBar = activeApp?.widgetBarEnabled === true && widgets.length > 0;

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleMobileNav = () => {
    const newState = !isMobileNavVisible;
    setIsMobileNavVisible(newState);
    if (newState) {
      setIsMobileSearchVisible(false);
      setIsMobileAppSwitcherVisible(false);
    }
  };

  const toggleMobileSearch = () => {
    const newState = !isMobileSearchVisible;
    setIsMobileSearchVisible(newState);
    if (newState) {
      setIsMobileNavVisible(false);
      setIsMobileAppSwitcherVisible(false);
    }
  };

  const toggleMobileAppSwitcher = () => {
    const newState = !isMobileAppSwitcherVisible;
    setIsMobileAppSwitcherVisible(newState);
    if (newState) {
      setIsMobileNavVisible(false);
      setIsMobileSearchVisible(false);
    }
  };

  const closeAllMobilePanels = () => {
    setIsMobileNavVisible(false);
    setIsMobileSearchVisible(false);
    setIsMobileAppSwitcherVisible(false);
  };

  return (
    <div className="sails-layout-wrapper">
      <Topbar onMenuToggle={toggleMobileMenu} />
      <div className="sails-layout-wrapper__container">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          onToggle={toggleSidebar} 
          isMobileOpen={isMobileMenuOpen}
        />
        <main className="sails-main-content" onClick={closeAllMobilePanels}>
          {children}
        </main>
      </div>
      {showWidgetBar && <WidgetBar widgets={widgets} />}
      <MobileNav isVisible={isMobileNavVisible} />
      <MobileGlobalBar 
        onMenuToggle={toggleMobileNav} 
        onSearchToggle={toggleMobileSearch}
        onAppSwitcherToggle={toggleMobileAppSwitcher}
      />
      <MobileSearchBar 
        isVisible={isMobileSearchVisible} 
        onClose={toggleMobileSearch} 
      />
      <MobileAppSwitcher 
        isVisible={isMobileAppSwitcherVisible} 
        onClose={toggleMobileAppSwitcher} 
      />
    </div>
  );
};

export default AppLayout;
