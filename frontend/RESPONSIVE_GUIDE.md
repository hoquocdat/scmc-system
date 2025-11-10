# Frontend Responsive Design Guide

## Overview
This guide outlines the responsive design strategy for the SCMC Workshop Management System frontend.

## Breakpoints
We use Tailwind CSS default breakpoints:
- **Mobile**: < 640px (base/default)
- **Tablet (sm)**: ≥ 640px
- **Desktop (md)**: ≥ 768px
- **Large Desktop (lg)**: ≥ 1024px
- **Extra Large (xl)**: ≥ 1280px

## Design Principles

### 1. Mobile-First Approach
- Start with mobile styles (no prefix)
- Add complexity as screen size increases
- Use `sm:`, `md:`, `lg:`, `xl:` prefixes progressively

### 2. Key Responsive Patterns

#### Spacing
```tsx
// Page padding
className="p-4 sm:p-6 md:p-8"

// Section margins
className="mb-4 sm:mb-6"

// Gap between items
className="gap-3 sm:gap-4 md:gap-6"
```

#### Typography
```tsx
// Headers
className="text-xl sm:text-2xl md:text-3xl"

// Body text
className="text-sm sm:text-base"

// Small text
className="text-xs sm:text-sm"
```

#### Grids and Layouts
```tsx
// Single to multi-column
className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"

// Responsive flex direction
className="flex flex-col sm:flex-row"

// Card layouts
className="grid grid-cols-1 md:grid-cols-2 gap-4"
```

#### Images and Icons
```tsx
// Responsive image sizes
className="w-24 h-24 sm:w-32 sm:h-28 md:w-48 md:h-32"

// Responsive icons
className="h-4 w-4 sm:h-5 sm:w-5"
```

### 3. Component-Specific Patterns

#### Tables
- Hide less important columns on mobile
- Use horizontal scroll for complex tables
- Consider card layout alternative for mobile

```tsx
// Hide column on mobile
<TableHead className="hidden sm:table-cell">Email</TableHead>

// Scroll container
<div className="overflow-x-auto">
  <Table />
</div>
```

#### Forms
```tsx
// Stack on mobile, side-by-side on desktop
<div className="grid gap-4 sm:grid-cols-2">
  <Input />
  <Input />
</div>
```

#### Buttons
```tsx
// Responsive button sizes
<Button size="sm" className="sm:size-default">

// Full width on mobile
<Button className="w-full sm:w-auto">
```

#### Navigation
- Hamburger menu on mobile
- Full sidebar on desktop
- Collapsible sidebar on tablet

### 4. Utility Classes to Use

#### Overflow Handling
- `truncate` - Single line ellipsis
- `line-clamp-2` - Multi-line ellipsis
- `overflow-x-auto` - Horizontal scroll
- `min-w-0` - Allow flex items to shrink

#### Flex/Grid Utilities
- `shrink-0` - Prevent shrinking
- `flex-1` - Take remaining space
- `grow` - Allow growing
- `basis-full sm:basis-1/2` - Responsive flex basis

## Implementation Checklist

### Layout Components
- [x] AppLayout - Mobile hamburger menu
- [x] Sidebar - Hide/show on mobile
- [ ] Header - Responsive navbar
- [ ] Breadcrumbs - Truncate on mobile

### Pages

#### List Pages
- [ ] CustomersPage - Responsive table/cards
- [ ] BikesPage - Responsive table/cards
- [ ] ServiceOrdersPage - Responsive table
- [ ] PartsPage - Responsive table
- [ ] EmployeesPage - Responsive table
- [ ] PaymentsPage - Responsive table

#### Detail Pages
- [x] CustomerDetailPage - Tabs, cards, info
- [x] BikeDetailPage - Tabs, owner card
- [ ] ServiceOrderDetailPage - Complex layout
- [ ] EmployeeDetailPage - Info layout

#### Dashboard Pages
- [ ] DashboardPage - Stats cards, charts
- [ ] ServiceBoardPage - Kanban columns
- [ ] EmployeeWorkPage - Task list
- [ ] ReportsPage - Reports grid

### Components
- [ ] ServiceItemsManager - Form layout
- [ ] PartsUsageManager - Form/list hybrid
- [ ] CommentsSection - Comment cards
- [ ] ActivityTimeline - Timeline layout
- [ ] ImageUpload - Upload area

## Testing Guidelines

### Devices to Test
1. **Mobile**: iPhone SE (375px), iPhone 12 (390px)
2. **Tablet**: iPad (768px), iPad Pro (1024px)
3. **Desktop**: 1366px, 1920px

### Key Things to Check
- [ ] Text doesn't overflow
- [ ] Images scale properly
- [ ] Forms are usable
- [ ] Tables scroll or adapt
- [ ] Navigation works
- [ ] Touch targets are 44x44px minimum
- [ ] No horizontal scrolling (except intentional)

## Common Patterns Reference

### Horizontal Card (with image)
```tsx
<div className="flex border rounded-lg overflow-hidden">
  <div className="w-24 h-24 sm:w-32 sm:h-28 md:w-48 md:h-32 shrink-0">
    <img className="w-full h-full object-cover" />
  </div>
  <div className="flex-1 p-3 sm:p-4 min-w-0">
    <h3 className="font-semibold text-base sm:text-lg truncate">Title</h3>
    <p className="text-xs sm:text-sm text-muted-foreground">Detail</p>
  </div>
</div>
```

### Info Grid
```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <div className="flex items-start gap-2 sm:gap-3">
    <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs sm:text-sm text-muted-foreground">Label</p>
      <p className="text-base sm:text-lg truncate">Value</p>
    </div>
  </div>
</div>
```

### Responsive Page Container
```tsx
<div className="p-4 sm:p-6 md:p-8">
  <div className="mb-4 sm:mb-6">
    <h1 className="text-xl sm:text-2xl font-bold">Title</h1>
    <p className="text-sm sm:text-base text-muted-foreground">Description</p>
  </div>
  {/* Content */}
</div>
```

## Next Steps
1. Update AppLayout with mobile menu
2. Update all list pages with responsive tables
3. Update remaining detail pages
4. Update dashboard and board views
5. Test on all breakpoints
6. Optimize touch interactions
