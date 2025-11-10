import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * Custom hook for managing tab state through URL query parameters
 *
 * @example
 * ```tsx
 * // In your component
 * const { activeTab, setActiveTab } = useUrlTabs('info');
 *
 * return (
 *   <Tabs value={activeTab} onValueChange={setActiveTab}>
 *     <TabsList>
 *       <TabsTrigger value="info">Info</TabsTrigger>
 *       <TabsTrigger value="settings">Settings</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="info">Info content</TabsContent>
 *     <TabsContent value="settings">Settings content</TabsContent>
 *   </Tabs>
 * );
 * ```
 *
 * @param defaultTab - The default tab to show if no tab is specified in URL
 * @param paramName - The URL parameter name (default: 'tab')
 * @returns Object with activeTab and setActiveTab function
 */
export function useUrlTabs(defaultTab: string, paramName: string = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active tab from URL or use default
  const activeTab = useMemo(() => {
    return searchParams.get(paramName) || defaultTab;
  }, [searchParams, paramName, defaultTab]);

  // Update tab and preserve other query parameters
  const setActiveTab = useCallback(
    (tab: string) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);

        // If setting to default tab, remove the parameter to keep URL clean
        if (tab === defaultTab) {
          newParams.delete(paramName);
        } else {
          newParams.set(paramName, tab);
        }

        return newParams;
      });
    },
    [setSearchParams, paramName, defaultTab]
  );

  return {
    activeTab,
    setActiveTab,
  };
}
