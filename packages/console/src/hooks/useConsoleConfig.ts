import { useState, useEffect } from 'react';
import { ConsoleApp, ConsoleMenu } from '@inidos/shared';



interface ConsoleConfig {
  apps: ConsoleApp[];
}

/**
 * Hook to fetch and manage the Console configuration (Apps and Menus).
 */
export const useConsoleConfig = () => {
  const [config, setConfig] = useState<ConsoleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/console/config');
        if (!response.ok) {
          throw new Error('Failed to fetch console configuration');
        }
        const result = await response.json();
        if (result.success) {
          setConfig(result.data);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Helper to get menus for the current active app (defaulting to the first one for now)
  const activeApp = config?.apps[0] || null;
  const navigationItems = activeApp?.menus || [];

  return {
    apps: config?.apps || [],
    navigationItems,
    activeApp,
    isLoading,
    error
  };
};
