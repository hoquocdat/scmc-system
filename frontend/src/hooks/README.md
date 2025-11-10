# Custom Hooks Documentation

## useUrlTabs

A reusable hook for managing tab state through URL query parameters. This hook provides URL-based tab persistence, making tabs shareable, bookmarkable, and respecting browser history.

### Features

- **URL Persistence**: Tab state is stored in URL query parameters
- **Browser History**: Back/forward buttons work with tab navigation
- **Shareable**: Copy and share URLs with specific tabs selected
- **Bookmarkable**: Users can bookmark specific tabs
- **Clean URLs**: Default tab doesn't clutter the URL
- **Other Params Preserved**: Keeps other query parameters intact

### Import

```tsx
import { useUrlTabs } from '@/hooks/useUrlTabs';
```

### API

```tsx
const { activeTab, setActiveTab } = useUrlTabs(defaultTab, paramName?);
```

#### Parameters

- `defaultTab: string` - The default tab to show when no tab is specified in URL
- `paramName?: string` - (Optional) The URL parameter name. Default: `'tab'`

#### Returns

An object with:
- `activeTab: string` - The currently active tab value
- `setActiveTab: (tab: string) => void` - Function to change the active tab

### Basic Usage

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlTabs } from '@/hooks/useUrlTabs';

function MyComponent() {
  const { activeTab, setActiveTab } = useUrlTabs('info');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="info">
        <p>Info content</p>
      </TabsContent>

      <TabsContent value="settings">
        <p>Settings content</p>
      </TabsContent>

      <TabsContent value="history">
        <p>History content</p>
      </TabsContent>
    </Tabs>
  );
}
```

### Advanced Usage

#### Custom URL Parameter Name

```tsx
// Use a different parameter name
const { activeTab, setActiveTab } = useUrlTabs('overview', 'view');

// URL will be: /page?view=overview
```

#### Multiple Tab Groups

```tsx
function MyComponent() {
  // Main tabs
  const { activeTab: mainTab, setActiveTab: setMainTab } = useUrlTabs('info', 'main');

  // Sub tabs
  const { activeTab: subTab, setActiveTab: setSubTab } = useUrlTabs('details', 'sub');

  // URL will be: /page?main=info&sub=details
}
```

#### Programmatic Tab Changes

```tsx
function MyComponent() {
  const { activeTab, setActiveTab } = useUrlTabs('info');

  const handleComplete = () => {
    // Change to success tab after completing action
    setActiveTab('success');
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* tabs */}
      </Tabs>
      <button onClick={handleComplete}>Complete</button>
    </div>
  );
}
```

### Real-World Example

From CustomerDetailPage:

```tsx
export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeTab, setActiveTab } = useUrlTabs('info');

  return (
    <div>
      <h1>Customer Details</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">Customer Info</TabsTrigger>
          <TabsTrigger value="bikes">Bikes Owned</TabsTrigger>
          <TabsTrigger value="service-history">Service History</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          {/* Customer information */}
        </TabsContent>

        <TabsContent value="bikes">
          {/* List of bikes */}
        </TabsContent>

        <TabsContent value="service-history">
          {/* Service order history */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### URL Examples

With `useUrlTabs('info')`:

- `/customers/123` → Shows "info" tab (default)
- `/customers/123?tab=info` → Shows "info" tab
- `/customers/123?tab=bikes` → Shows "bikes" tab
- `/customers/123?tab=service-history` → Shows "service-history" tab

### Benefits

1. **User Experience**
   - Refresh page → Stay on same tab
   - Browser back → Return to previous tab
   - Share URL → Colleague sees same tab

2. **Developer Experience**
   - Single line of code to add tab persistence
   - Works with any tab component
   - Type-safe with TypeScript

3. **Clean Architecture**
   - Default tab doesn't add query parameter
   - Other query parameters are preserved
   - No localStorage needed

### Best Practices

1. **Choose meaningful default tabs**: Use the most commonly accessed tab as default
   ```tsx
   const { activeTab, setActiveTab } = useUrlTabs('overview'); // Good default
   ```

2. **Use descriptive parameter names for multiple tab groups**:
   ```tsx
   const { activeTab: mainTab } = useUrlTabs('info', 'main-tab');
   const { activeTab: detailTab } = useUrlTabs('basic', 'detail-tab');
   ```

3. **Validate tab values** if accepting dynamic tabs:
   ```tsx
   const validTabs = ['info', 'bikes', 'history'];
   const { activeTab, setActiveTab } = useUrlTabs('info');

   // Ensure tab is valid
   const safeTab = validTabs.includes(activeTab) ? activeTab : 'info';
   ```

### Troubleshooting

**Q: My tabs don't sync with URL**
- Make sure you're passing `value={activeTab}` to the `Tabs` component
- Ensure `onValueChange={setActiveTab}` is set on the `Tabs` component

**Q: Other query parameters are being removed**
- This shouldn't happen - the hook preserves other params. Check if something else is modifying the URL.

**Q: Tab resets when navigating to a different page**
- This is expected behavior. Each route manages its own tab state. Use different `paramName` if you need separate tab states.

### Related Hooks

- `useSearchParams` - React Router hook for managing URL search params (used internally)
- `useNavigate` - For programmatic navigation
- `useLocation` - For reading current location
