import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { apiClient } from '../lib/api-client';
import type { Part } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface PartFormData {
  part_number?: string;
  name: string;
  category?: string;
  description?: string;
  quantity_in_stock: string;
  minimum_stock_level: string;
  unit_cost?: string;
  supplier?: string;
}

const PART_CATEGORIES = [
  'Engine Parts',
  'Electrical System',
  'Suspension & Brakes',
  'Transmission',
  'Body & Frame',
  'Fluids & Lubricants',
  'Filters',
  'Tires & Wheels',
  'Other',
];

export function PartsPage() {
  const navigate = useNavigate();
  const [parts, setParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isUnderDevelopmentOpen, setIsUnderDevelopmentOpen] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError: setFormError,
    setValue,
  } = useForm<PartFormData>({
    defaultValues: {
      part_number: '',
      name: '',
      category: '',
      description: '',
      quantity_in_stock: '0',
      minimum_stock_level: '5',
      unit_cost: '',
      supplier: '',
    },
  });

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    try {
      setIsLoading(true);
      const response: any = await apiClient.parts.getAll(1, 100);
      setParts(response.data || []);
    } catch (err: any) {
      console.error('Error fetching parts:', err);
      toast.error('Failed to load parts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSheet = (part?: Part) => {
    if (part) {
      setEditingPart(part);
      setSelectedCategory(part.category || '');
      reset({
        part_number: part.part_number || '',
        name: part.name,
        category: part.category || '',
        description: part.description || '',
        quantity_in_stock: part.quantity_in_stock.toString(),
        minimum_stock_level: part.minimum_stock_level.toString(),
        unit_cost: part.unit_cost?.toString() || '',
        supplier: part.supplier || '',
      });
    } else {
      setEditingPart(null);
      setSelectedCategory('');
      reset({
        part_number: '',
        name: '',
        category: '',
        description: '',
        quantity_in_stock: '0',
        minimum_stock_level: '5',
        unit_cost: '',
        supplier: '',
      });
    }
    setIsSheetOpen(true);
  };

  const onSubmit = async (data: PartFormData) => {
    try {
      const payload: any = {
        part_number: data.part_number,
        name: data.name,
        category: data.category,
        description: data.description,
        quantity_in_stock: parseInt(data.quantity_in_stock) || 0,
        minimum_stock_level: parseInt(data.minimum_stock_level) || 0,
        unit_cost: data.unit_cost ? parseFloat(data.unit_cost) : undefined,
        supplier: data.supplier,
      };

      if (editingPart) {
        await apiClient.parts.update(editingPart.id, payload);
        toast.success('Part updated successfully');
      } else {
        await apiClient.parts.create(payload);
        toast.success('Part added successfully');
      }

      setIsSheetOpen(false);
      setEditingPart(null);
      setSelectedCategory('');
      reset();
      fetchParts();
    } catch (err: any) {
      console.error('Error saving part:', err);
      toast.error(err.message || 'Failed to save part');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this part?')) return;

    try {
      await apiClient.parts.delete(id);
      toast.success('Part deleted successfully');
      fetchParts();
    } catch (err: any) {
      console.error('Error deleting part:', err);
      toast.error('Failed to delete part');
    }
  };

  const handleAdjustStock = async (part: Part, adjustment: number) => {
    try {
      const newStock = part.quantity_in_stock + adjustment;
      if (newStock < 0) {
        toast.error('Stock cannot be negative');
        return;
      }

      await apiClient.parts.update(part.id, { quantity_in_stock: newStock });
      toast.success(`Stock ${adjustment > 0 ? 'increased' : 'decreased'} successfully`);
      fetchParts();
    } catch (err: any) {
      console.error('Error adjusting stock:', err);
      toast.error('Failed to adjust stock');
    }
  };

  const getStockStatus = (part: Part) => {
    if (part.quantity_in_stock === 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const };
    } else if (part.quantity_in_stock <= part.minimum_stock_level) {
      return { label: 'Low Stock', variant: 'default' as const };
    } else {
      return { label: 'In Stock', variant: 'secondary' as const };
    }
  };

  const lowStockParts = parts.filter(p => p.quantity_in_stock <= p.minimum_stock_level);
  const outOfStockParts = parts.filter(p => p.quantity_in_stock === 0);

  const columns: ColumnDef<Part>[] = [
    {
      accessorKey: 'part_number',
      header: () => <div className="hidden md:table-cell">Part Number</div>,
      cell: ({ row }) => (
        <div className="hidden md:table-cell font-mono text-sm">{row.getValue('part_number') || '-'}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const part = row.original;
        return (
          <div>
            <div className="font-medium">{part.name}</div>
            {part.category && (
              <div className="text-xs text-muted-foreground">
                {part.category}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      cell: ({ row }) => {
        const part = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAdjustStock(part, -1)}
              disabled={part.quantity_in_stock === 0}
            >
              -
            </Button>
            <span className="font-medium w-12 text-center">
              {part.quantity_in_stock}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAdjustStock(part, 1)}
            >
              +
            </Button>
            <div className="text-xs text-muted-foreground ml-2">
              Min: {part.minimum_stock_level}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const part = row.original;
        const status = getStockStatus(part);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      accessorKey: 'unit_cost',
      header: () => <div className="hidden sm:table-cell">Unit Cost</div>,
      cell: ({ row }) => {
        const cost = row.getValue('unit_cost') as number;
        return <div className="hidden sm:table-cell">{cost ? `$${cost.toFixed(2)}` : '-'}</div>;
      },
    },
    {
      accessorKey: 'supplier',
      header: () => <div className="hidden md:table-cell">Supplier</div>,
      cell: ({ row }) => <div className="hidden md:table-cell">{row.getValue('supplier') || '-'}</div>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const part = row.original;
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenSheet(part)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(part.id)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: parts,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Parts Inventory</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage parts inventory, stock levels, and suppliers
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Parts</div>
          <div className="text-xl sm:text-2xl font-bold">{parts.length}</div>
          <div className="text-xs text-muted-foreground">In inventory</div>
        </div>
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Low Stock</div>
          <div className="text-xl sm:text-2xl font-bold text-orange-600">{lowStockParts.length}</div>
          <div className="text-xs text-muted-foreground">Below minimum level</div>
        </div>
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Out of Stock</div>
          <div className="text-xl sm:text-2xl font-bold text-red-600">{outOfStockParts.length}</div>
          <div className="text-xs text-muted-foreground">Need restock</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <Input
          placeholder="Filter by name, part number, or supplier..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('name')?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-sm"
        />
        <Button onClick={() => handleOpenSheet()} className="w-full sm:w-auto">
          Add Part
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {isLoading ? 'Loading...' : 'No parts found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-4">
        <div className="text-xs sm:text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="part_number">Part Number</Label>
                  <Input
                    id="part_number"
                    {...register('part_number')}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Part Name *</Label>
                  <Input
                    id="name"
                    {...register('name', {
                      required: 'Part name is required',
                    })}
                    placeholder="e.g., Engine Oil Filter"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value) => {
                    setSelectedCategory(value);
                    setValue('category', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...register('description')}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="quantity_in_stock">Stock Quantity</Label>
                  <Input
                    id="quantity_in_stock"
                    type="number"
                    {...register('quantity_in_stock', {
                      min: {
                        value: 0,
                        message: 'Stock cannot be negative',
                      },
                    })}
                  />
                  {errors.quantity_in_stock && (
                    <p className="text-sm text-red-600 mt-1">{errors.quantity_in_stock.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="minimum_stock_level">Minimum Level</Label>
                  <Input
                    id="minimum_stock_level"
                    type="number"
                    {...register('minimum_stock_level', {
                      min: {
                        value: 0,
                        message: 'Minimum level cannot be negative',
                      },
                    })}
                  />
                  {errors.minimum_stock_level && (
                    <p className="text-sm text-red-600 mt-1">{errors.minimum_stock_level.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="unit_cost">Unit Cost ($)</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    {...register('unit_cost', {
                      min: {
                        value: 0,
                        message: 'Cost cannot be negative',
                      },
                    })}
                    placeholder="0.00"
                  />
                  {errors.unit_cost && (
                    <p className="text-sm text-red-600 mt-1">{errors.unit_cost.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  {...register('supplier')}
                  placeholder="Optional supplier name"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSheetOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part'}
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Under Development Dialog */}
      <Dialog open={isUnderDevelopmentOpen} onOpenChange={(open) => {
        setIsUnderDevelopmentOpen(open);
        if (!open) {
          navigate('/');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tính năng đang phát triển</DialogTitle>
            <DialogDescription>
              Tính năng quản lý phụ tùng hiện đang trong quá trình phát triển và sẽ sớm được ra mắt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => {
              setIsUnderDevelopmentOpen(false);
              navigate('/');
            }}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
