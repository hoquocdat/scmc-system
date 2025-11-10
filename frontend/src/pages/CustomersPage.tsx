import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { apiClient } from '../lib/api-client';
import type { Customer } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PhoneInput from 'react-phone-number-input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CustomerCell } from '@/components/table/TableCells';
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

interface CustomerFormData {
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  facebook?: string;
  instagram?: string;
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  // Fetch customers with useQuery
  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response: any = await apiClient.customers.getAll(1, 100);
      return response.data || [];
    },
  });

  const customers: Customer[] = customersData || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError: setFormError,
    control,
  } = useForm<CustomerFormData>({
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      facebook: '',
      instagram: '',
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    try {
      // Remove empty email to avoid validation errors
      const payload = {
        ...data,
        email: data.email?.trim() || undefined,
      };

      await apiClient.customers.create(payload);

      reset();
      setIsSheetOpen(false);
      refetch();
    } catch (err: any) {
      // Check if it's a phone duplicate error
      if (err.message?.includes('số điện thoại') || err.message?.includes('phone')) {
        setFormError('phone', {
          message: err.message || 'Số điện thoại này đã được sử dụng',
        });
      } else {
        setFormError('root', {
          message: err.message || 'Failed to create customer',
        });
      }
    }
  };

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'customer',
      header: 'Khách Hàng',
      cell: ({ row }) => <CustomerCell customer={row.original} />,
    },
    {
      accessorKey: 'email',
      header: () => <div className="hidden sm:table-cell">Email</div>,
      cell: ({ row }) => <div className="hidden sm:table-cell">{row.getValue('email') || '-'}</div>,
    },
    {
      accessorKey: 'address',
      header: () => <div className="hidden lg:table-cell">Địa Chỉ</div>,
      cell: ({ row }) => (
        <div className="hidden lg:table-cell max-w-xs truncate">{row.getValue('address') || '-'}</div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/customers/${row.original.id}`)}
          >
            Xem
          </Button>
        );
      },
    },
  ];

  const table = useReactTable({
    data: customers,
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Khách Hàng</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Quản lý chủ xe và khách hàng
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <Input
          placeholder="Lọc theo tên, số điện thoại, email..."
          value={(table.getColumn('customer')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('customer')?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-sm"
        />
        <Button onClick={() => setIsSheetOpen(true)} className="w-full sm:w-auto">
          Thêm Khách Hàng
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
                  {isLoading ? 'Đang tải...' : 'Không tìm thấy khách hàng.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-4">
        <div className="text-xs sm:text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} /{' '}
          {table.getFilteredRowModel().rows.length} hàng được chọn.
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Sau
          </Button>
        </div>
      </div>

      {/* Add Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Thêm Khách Hàng Mới</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errors.root && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {errors.root.message}
              </div>
            )}

            {/* Customer Fields */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Họ Tên *</Label>
              <Input
                id="full_name"
                {...register('full_name', {
                  required: 'Vui lòng nhập họ tên',
                })}
              />
              {errors.full_name && (
                <p className="text-sm text-red-600">{errors.full_name.message}</p>
              )}
            </div>

            {/* Contact Fields */}
            <div className="space-y-2">
              <Label htmlFor="phone">Số Điện Thoại *</Label>
              <Controller
                name="phone"
                control={control}
                rules={{
                  required: 'Vui lòng nhập số điện thoại',
                  validate: async (value) => {
                    if (!value) return true;
                    try {
                      const result: any = await apiClient.customers.checkPhone(value);
                      return result.available || 'Số điện thoại này đã được sử dụng';
                    } catch (error) {
                      console.error('Error checking phone:', error);
                      return true; // Allow submission if check fails
                    }
                  },
                }}
                render={({ field }) => (
                  <PhoneInput
                    {...field}
                    defaultCountry="VN"
                    placeholder="Nhập số điện thoại"
                    international
                    className="PhoneInput"
                  />
                )}
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email', {
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Địa chỉ email không hợp lệ',
                  },
                })}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                placeholder="Facebook username hoặc URL"
                {...register('facebook')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                placeholder="Instagram username hoặc URL"
                {...register('instagram')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Địa Chỉ</Label>
              <Textarea
                id="address"
                {...register('address')}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Ghi Chú</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                className="min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSheetOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Đang lưu...' : 'Lưu Khách Hàng'}
              </Button>
            </div>
          </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
