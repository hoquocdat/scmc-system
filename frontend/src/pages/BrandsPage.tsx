import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiClient } from '../lib/api-client';
import type { Brand } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { ArrowUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface BrandFormData {
  name: string;
  country_of_origin?: string;
  description?: string;
}

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<BrandFormData>({
    defaultValues: {
      name: '',
      country_of_origin: '',
      description: '',
    },
  });

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setIsLoading(true);
      const data: any = await apiClient.brands.getAll();
      setBrands(data || []);
    } catch (err: any) {
      console.error('Error fetching brands:', err);
      toast.error('Failed to load brands');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSheet = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      reset({
        name: brand.name,
        country_of_origin: brand.country_of_origin || '',
        description: brand.description || '',
      });
    } else {
      setEditingBrand(null);
      reset({
        name: '',
        country_of_origin: '',
        description: '',
      });
    }
    setIsSheetOpen(true);
  };

  const onSubmit = async (data: BrandFormData) => {
    try {
      const payload: any = {
        name: data.name,
        country_of_origin: data.country_of_origin || undefined,
        description: data.description || undefined,
      };

      if (editingBrand) {
        await apiClient.brands.update(editingBrand.id, payload);
        toast.success('Brand updated successfully');
      } else {
        await apiClient.brands.create(payload);
        toast.success('Brand created successfully');
      }

      setIsSheetOpen(false);
      fetchBrands();
    } catch (err: any) {
      console.error('Error saving brand:', err);
      toast.error(err.message || 'Failed to save brand');
    }
  };

  const handleDelete = async (brand: Brand) => {
    if (!confirm(`Are you sure you want to delete "${brand.name}"?`)) return;

    try {
      await apiClient.brands.delete(brand.id);
      toast.success('Brand deleted successfully');
      fetchBrands();
    } catch (err: any) {
      console.error('Error deleting brand:', err);
      toast.error('Failed to delete brand');
    }
  };

  const columns: ColumnDef<Brand>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
    },
    {
      accessorKey: 'country_of_origin',
      header: 'Country',
      cell: ({ row }) => <div>{row.getValue('country_of_origin') || '-'}</div>,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <div className="truncate max-w-[300px]">{row.getValue('description') || '-'}</div>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const brand = row.original;
        return (
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenSheet(brand)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(brand)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: brands,
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Brands</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage motorcycle and parts brands
          </p>
        </div>
        <Button onClick={() => handleOpenSheet()} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Brand
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Filter brands..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('name')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No brands found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
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

      {/* Form Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingBrand ? 'Edit Brand' : 'Add New Brand'}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="country_of_origin">Country of Origin</Label>
              <Input
                id="country_of_origin"
                {...register('country_of_origin')}
                placeholder="e.g., Japan, Italy, Germany"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Brief description of the brand"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSheetOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Saving...' : editingBrand ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
