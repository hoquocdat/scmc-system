# Responsive Design - Detailed Implementation Guide

## ✅ Phase 1: COMPLETED - AppLayout

The AppLayout has been updated with:
- Mobile-first sidebar (overlay on mobile, persistent on desktop)
- Hamburger menu button on mobile
- Responsive header with hidden breadcrumbs on mobile
- Responsive padding and spacing
- Dark overlay when mobile menu is open

## 🔄 Phase 2: Table Pages (IN PROGRESS)

### Pattern: Responsive Table Container

For all list pages (Customers, Bikes, ServiceOrders, Parts, Employees, Payments), follow this pattern:

#### 1. Update Page Container Padding

```tsx
// OLD
<div className="p-8">

// NEW
<div className="p-4 sm:p-6 md:p-8">
```

#### 2. Update Page Headers

```tsx
// OLD
<div className="mb-8">
  <h1 className="text-2xl font-bold tracking-tight">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>

// NEW
<div className="mb-4 sm:mb-6 md:mb-8">
  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Title</h1>
  <p className="text-sm sm:text-base text-muted-foreground">Description</p>
</div>
```

#### 3. Update Action Bar (Filters + Buttons)

```tsx
// OLD
<div className="flex items-center justify-between mb-4">
  <Input placeholder="Filter..." className="max-w-sm" />
  <Button>Add New</Button>
</div>

// NEW
<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
  <Input placeholder="Filter..." className="w-full sm:max-w-sm" />
  <Button className="w-full sm:w-auto">Add New</Button>
</div>
```

#### 4. Make Tables Scrollable on Mobile

```tsx
// Wrap table in overflow container
<div className="rounded-md border overflow-x-auto">
  <Table>
    {/* ...table content */}
  </Table>
</div>
```

#### 5. Hide Less Important Columns on Mobile

```tsx
// Example: Hide email column on mobile
<TableHead className="hidden md:table-cell">Email</TableHead>

// Corresponding cell
<TableCell className="hidden md:table-cell">
  {row.getValue('email') || '-'}
</TableCell>
```

#### 6. Update Pagination

```tsx
// OLD
<div className="flex items-center justify-end space-x-2 py-4">
  <div className="flex-1 text-sm text-muted-foreground">
    {selected} / {total} rows selected
  </div>
  <Button>Previous</Button>
  <Button>Next</Button>
</div>

// NEW
<div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-4">
  <div className="text-xs sm:text-sm text-muted-foreground">
    {selected} / {total} rows selected
  </div>
  <div className="flex gap-2">
    <Button variant="outline" size="sm">Previous</Button>
    <Button variant="outline" size="sm">Next</Button>
  </div>
</div>
```

### Specific Page Updates

#### CustomersPage.tsx
```tsx
// Already has BikeCell/CustomerCell - just update container padding
<div className="p-4 sm:p-6 md:p-8">
  // Update headers and action bar as shown above

  // Hide address column on mobile
  <TableHead className="hidden lg:table-cell">Địa Chỉ</TableHead>
  <TableCell className="hidden lg:table-cell">
    {row.getValue('address') || '-'}
  </TableCell>
</div>
```

#### BikesPage.tsx (ALREADY UPDATED - Reference pattern)
- See existing implementation for BikeCell usage
- Note the responsive padding pattern

#### ServiceOrdersPage.tsx
```tsx
// Hide estimated cost and status columns on mobile
<TableHead className="hidden md:table-cell">Ước Tính</TableHead>
<TableHead className="hidden sm:table-cell">Trạng Thái</TableHead>

// Make sure order number and bike info always visible
<TableHead>Số Đơn</TableHead>
<TableHead>Xe Máy</TableHead>
```

#### PartsPage.tsx
```tsx
// Hide stock level, supplier on mobile
<TableHead className="hidden md:table-cell">Stock Level</TableHead>
<TableHead className="hidden lg:table-cell">Supplier</TableHead>

// Always show: Name, Category, Quantity, Actions
```

#### EmployeesPage.tsx
```tsx
// Hide role, phone on mobile
<TableHead className="hidden sm:table-cell">Role</TableHead>
<TableHead className="hidden md:table-cell">Phone</TableHead>

// Always show: Name, Status, Actions
```

#### PaymentsPage.tsx
```tsx
// Hide payment method, received by on mobile
<TableHead className="hidden md:table-cell">Method</TableHead>
<TableHead className="hidden lg:table-cell">Received By</TableHead>

// Always show: Date, Amount, Order Number, Actions
```

## 📝 Phase 3: Detail Pages

### Pattern: Already Implemented in CustomerDetailPage & BikeDetailPage

Reference these files for the complete pattern. Key points:

#### 1. Responsive Container
```tsx
<div className="p-4 sm:p-6 md:p-8">
  <div className="mb-4 sm:mb-6">
    <h1 className="text-xl sm:text-2xl font-bold">Title</h1>
    <p className="text-sm sm:text-base text-muted-foreground">Subtitle</p>
  </div>

  <Tabs defaultValue="info" className="space-y-4 sm:space-y-6">
    {/* tabs */}
  </Tabs>
</div>
```

#### 2. Info Grid Pattern
```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <div className="flex items-start gap-2 sm:gap-3">
    <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs sm:text-sm font-medium text-muted-foreground">Label</p>
      <p className="text-base sm:text-lg truncate">Value</p>
    </div>
  </div>
</div>
```

#### 3. Horizontal Cards (with images)
```tsx
<div className="flex border rounded-lg overflow-hidden hover:shadow-lg">
  <div className="w-24 h-24 sm:w-32 sm:h-28 md:w-48 md:h-32 shrink-0">
    <img className="w-full h-full object-cover" />
  </div>
  <div className="flex-1 p-3 sm:p-4 min-w-0">
    <h3 className="font-semibold text-base sm:text-lg truncate">Title</h3>
    <p className="text-xs sm:text-sm text-muted-foreground">Details</p>
  </div>
</div>
```

### ServiceOrderDetailPage.tsx

This is the most complex detail page. Update structure:

```tsx
<div className="p-4 sm:p-6 md:p-8">
  {/* Header */}
  <div className="mb-4 sm:mb-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Order #{order.order_number}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Created {formatDate(order.created_at)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="w-full sm:w-auto">Action</Button>
      </div>
    </div>
  </div>

  {/* Use Tabs for organization */}
  <Tabs defaultValue="overview">
    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="items">Items</TabsTrigger>
      <TabsTrigger value="parts">Parts</TabsTrigger>
      <TabsTrigger value="payments" className="hidden sm:block">Payments</TabsTrigger>
      <TabsTrigger value="activity" className="hidden sm:block">Activity</TabsTrigger>
    </TabsList>

    {/* Tab Contents */}
  </Tabs>
</div>
```

### EmployeeDetailPage.tsx

Follow the same pattern as CustomerDetailPage:
- Responsive container padding
- Tabs for organization (Info, Assigned Orders, Activity)
- Info grid with responsive sizing
- Horizontal cards for orders

## 📊 Phase 4: Dashboard Pages

### DashboardPage.tsx

#### 1. Stats Cards Grid
```tsx
<div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
      <DollarSign className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl sm:text-3xl font-bold">$45,231.89</div>
      <p className="text-xs text-muted-foreground">+20.1% from last month</p>
    </CardContent>
  </Card>
</div>
```

#### 2. Charts Section
```tsx
<div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
  <Card className="col-span-1">
    <CardHeader>
      <CardTitle className="text-base sm:text-lg">Revenue Chart</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Chart with responsive height */}
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          {/* Chart components */}
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
</div>
```

#### 3. Recent Activity List
```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      {activities.map((activity) => (
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base truncate">{activity.title}</p>
            <p className="text-xs text-muted-foreground">{activity.time}</p>
          </div>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

### ServiceBoardPage.tsx (Kanban)

#### 1. Make Columns Scrollable on Mobile
```tsx
<div className="flex-1 overflow-x-auto">
  <div className="flex gap-4 p-4 sm:p-6 min-w-max">
    {columns.map((column) => (
      <div className="w-80 sm:w-96" key={column.id}>
        {/* Column content */}
      </div>
    ))}
  </div>
</div>
```

#### 2. Mobile: Stack Columns Vertically (Alternative)
```tsx
{/* Mobile: Single column view with dropdown selector */}
<div className="md:hidden">
  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
    <SelectTrigger>
      <SelectValue placeholder="Select status" />
    </SelectTrigger>
    <SelectContent>
      {columns.map((col) => (
        <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Show only selected column */}
  <div className="mt-4">
    {renderColumn(selectedColumn)}
  </div>
</div>

{/* Desktop: Show all columns */}
<div className="hidden md:flex gap-4">
  {columns.map((column) => renderColumn(column.id))}
</div>
```

#### 3. Card Content
```tsx
<Card className="mb-3 cursor-pointer hover:shadow-md transition-shadow">
  <CardContent className="p-3 sm:p-4">
    <div className="font-medium text-sm sm:text-base truncate mb-2">
      {order.order_number}
    </div>
    <div className="flex items-center gap-2 mb-2">
      <Badge className="text-xs">{order.priority}</Badge>
    </div>
    <div className="text-xs sm:text-sm text-muted-foreground">
      <div className="flex items-center gap-2 truncate">
        <Bike className="h-3 w-3 shrink-0" />
        <span className="truncate">{order.bike.license_plate}</span>
      </div>
    </div>
  </CardContent>
</Card>
```

### EmployeeWorkPage.tsx

Similar to ServiceBoardPage, but with list layout:

```tsx
<div className="p-4 sm:p-6 md:p-8">
  <div className="space-y-3 sm:space-y-4">
    {tasks.map((task) => (
      <Card key={task.id}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base sm:text-lg truncate">
                {task.title}
              </h3>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge>{task.status}</Badge>
              <Button size="sm">View</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
</div>
```

### ReportsPage.tsx

```tsx
<div className="p-4 sm:p-6 md:p-8">
  {/* Filters */}
  <Card className="mb-6">
    <CardContent className="p-4 sm:p-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <div>
          <Label>Date Range</Label>
          <Input type="date" />
        </div>
        {/* More filters */}
      </div>
    </CardContent>
  </Card>

  {/* Report Grid */}
  <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Report Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Report content */}
      </CardContent>
    </Card>
  </div>
</div>
```

## 🧩 Phase 5: Specialized Components

### ServiceItemsManager.tsx

```tsx
// Form fields in responsive grid
<div className="grid gap-4 sm:grid-cols-2">
  <div>
    <Label htmlFor="name">Item Name</Label>
    <Input id="name" />
  </div>
  <div>
    <Label htmlFor="cost">Labor Cost</Label>
    <Input id="cost" type="number" />
  </div>
</div>

// Buttons
<div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
  <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
  <Button className="w-full sm:w-auto">Save</Button>
</div>
```

### PartsUsageManager.tsx

```tsx
// Search + Add button
<div className="flex flex-col sm:flex-row gap-3 mb-4">
  <Input placeholder="Search parts..." className="flex-1" />
  <Button className="w-full sm:w-auto">Add Part</Button>
</div>

// Parts list
<div className="space-y-2">
  {parts.map((part) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{part.name}</p>
        <p className="text-sm text-muted-foreground">Qty: {part.quantity}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="w-20"
          value={part.quantity}
        />
        <Button variant="ghost" size="sm">Remove</Button>
      </div>
    </div>
  ))}
</div>
```

### CommentsSection.tsx

```tsx
<div className="space-y-4">
  {comments.map((comment) => (
    <div className="flex gap-3" key={comment.id}>
      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
        <AvatarFallback>{comment.author[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
          <p className="font-medium text-sm sm:text-base truncate">
            {comment.author}
          </p>
          <span className="text-xs text-muted-foreground">
            {formatDate(comment.created_at)}
          </span>
        </div>
        <p className="text-sm mt-1">{comment.text}</p>
      </div>
    </div>
  ))}

  {/* Comment form */}
  <div className="flex gap-3">
    <Avatar className="h-8 w-8 shrink-0">
      <AvatarFallback>U</AvatarFallback>
    </Avatar>
    <div className="flex-1">
      <Textarea
        placeholder="Add a comment..."
        className="min-h-[80px]"
      />
      <div className="flex justify-end mt-2">
        <Button size="sm" className="w-full sm:w-auto">Post Comment</Button>
      </div>
    </div>
  </div>
</div>
```

### ActivityTimeline.tsx

```tsx
<div className="space-y-4">
  {activities.map((activity, index) => (
    <div className="flex gap-3 sm:gap-4" key={activity.id}>
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        {index < activities.length - 1 && (
          <div className="flex-1 w-0.5 bg-border my-2" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 mb-2">
          <p className="font-medium text-sm sm:text-base truncate">
            {activity.title}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(activity.created_at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{activity.description}</p>
      </div>
    </div>
  ))}
</div>
```

### ImageUpload.tsx

```tsx
<div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
  {images.map((image, index) => (
    <div
      key={index}
      className="aspect-square rounded-lg overflow-hidden border relative group"
    >
      <img
        src={image.url}
        alt={`Upload ${index + 1}`}
        className="w-full h-full object-cover"
      />
      <button
        onClick={() => removeImage(index)}
        className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4 text-white" />
      </button>
    </div>
  ))}

  {/* Upload trigger */}
  <label className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-accent transition-colors">
    <div className="text-center">
      <Upload className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 text-muted-foreground" />
      <p className="text-xs sm:text-sm text-muted-foreground">Upload</p>
    </div>
    <input type="file" className="hidden" accept="image/*" multiple />
  </label>
</div>
```

## 📱 Testing Checklist

After implementing each phase, test on these viewports:

### Mobile (< 640px)
- [ ] Sidebar is hidden by default
- [ ] Hamburger menu works
- [ ] Tables scroll horizontally
- [ ] Forms stack vertically
- [ ] Buttons are full width
- [ ] Text is readable (not too small)
- [ ] No horizontal overflow

### Tablet (640px - 1024px)
- [ ] Sidebar can be toggled
- [ ] Tables show more columns
- [ ] Forms use 2-column grid
- [ ] Cards use 2-column grid
- [ ] Navigation is usable

### Desktop (> 1024px)
- [ ] Sidebar is open by default
- [ ] All table columns visible
- [ ] Multi-column layouts work
- [ ] Optimal use of space

## 🚀 Quick Win Tips

1. **Use `sm:` breakpoint first** - Most changes happen at 640px
2. **Always add `truncate` to text that might overflow**
3. **Always add `shrink-0` to icons/avatars**
4. **Always add `min-w-0` to flex containers with text**
5. **Use `hidden sm:block` to hide on mobile**
6. **Use `w-full sm:w-auto` for responsive button widths**
7. **Test with Chrome DevTools mobile view**
8. **Use `overflow-x-auto` for wide content**

## 🔄 Common Pattern Replacements

### Replace This Pattern:
```tsx
<div className="p-8">
  <div className="mb-8">
    <h1 className="text-2xl">Title</h1>
  </div>
  <div className="flex justify-between mb-4">
    <Input className="max-w-sm" />
    <Button>Action</Button>
  </div>
  <div className="grid grid-cols-3 gap-6">
    {/* cards */}
  </div>
</div>
```

### With This Pattern:
```tsx
<div className="p-4 sm:p-6 md:p-8">
  <div className="mb-4 sm:mb-6 md:mb-8">
    <h1 className="text-xl sm:text-2xl">Title</h1>
  </div>
  <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 mb-4">
    <Input className="w-full sm:max-w-sm" />
    <Button className="w-full sm:w-auto">Action</Button>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
    {/* cards */}
  </div>
</div>
```

This pattern works for 90% of pages!
