import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import type { Supplier } from '../types';
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

interface SupplierFormData {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SupplierFormData>({
    defaultValues: {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    },
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setIsLoading(true);
      const data: any = await apiClient.suppliers.getAll();
      setSuppliers(data || []);
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSheet = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      reset({
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        notes: supplier.notes || '',
      });
    } else {
      setEditingSupplier(null);
      reset({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
      });
    }
    setIsSheetOpen(true);
  };

  const onSubmit = async (data: SupplierFormData) => {
    try {
      const payload: any = {
        name: data.name,
        contact_person: data.contact_person || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      };

      if (editingSupplier) {
        await apiClient.suppliers.update(editingSupplier.id, payload);
        toast.success('Supplier updated successfully');
      } else {
        await apiClient.suppliers.create(payload);
        toast.success('Supplier created successfully');
      }

      setIsSheetOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      toast.error(err.message || 'Failed to save supplier');
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Are you sure you want to delete "${supplier.name}"?`)) return;

    try {
      await apiClient.suppliers.delete(supplier.id);
      toast.success('Supplier deleted successfully');
      fetchSuppliers();
    } catch (err: any) {
      console.error('Error deleting supplier:', err);
      toast.error('Failed to delete supplier');
    }
  };

  const columns: ColumnDef<Supplier>[] = [
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
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div
            className="font-medium text-blue-600 hover:underline cursor-pointer"
            onClick={() => navigate(`/suppliers/${supplier.id}`)}
          >
            {row.getValue('name')}
          </div>
        );
      },
    },
    {
      accessorKey: 'contact_person',
      header: 'Contact Person',
      cell: ({ row }) => <div>{row.getValue('contact_person') || '-'}</div>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <div>{row.getValue('phone') || '-'}</div>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <div className="truncate max-w-[200px]">{row.getValue('email') || '-'}</div>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/suppliers/${supplier.id}`)}
            >
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenSheet(supplier)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(supplier)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: suppliers,
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
          <h1 className="text-2xl sm:text-3xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your parts suppliers
          </p>
        </div>
        <Button onClick={() => handleOpenSheet()} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Filter suppliers..."
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
                  No suppliers found.
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
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
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
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                {...register('contact_person')}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...register('address')}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
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
                {isSubmitting ? 'Saving...' : editingSupplier ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
