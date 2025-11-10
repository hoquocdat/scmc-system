import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Motorcycle, Customer } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BikeCell, CustomerCell } from '@/components/table/TableCells';
import { CreateBikeForm } from '@/components/forms/CreateBikeForm';
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

interface BikeWithOwner extends Motorcycle {
  customers?: Customer;
}

export function BikesPage() {
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  // Fetch bikes with useQuery
  const { data: bikesData, isLoading, refetch } = useQuery({
    queryKey: ['bikes'],
    queryFn: async () => {
      const response: any = await apiClient.bikes.getAll(1, 100);
      return response.data || [];
    },
  });

  const bikes: BikeWithOwner[] = bikesData || [];

  const handleBikeCreated = () => {
    setIsSheetOpen(false);
    refetch();
  };

  const columns: ColumnDef<BikeWithOwner>[] = [
    {
      accessorKey: 'bike',
      header: 'Xe',
      cell: ({ row }) => <BikeCell bike={row.original} showYear />,
    },
    {
      accessorKey: 'color',
      header: () => <div className="hidden sm:table-cell">Màu</div>,
      cell: ({ row }) => <div className="hidden sm:table-cell">{row.getValue('color') || '-'}</div>,
    },
    {
      accessorKey: 'owner',
      header: 'Chủ Xe',
      cell: ({ row }) => <CustomerCell customer={row.original.customers} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/bikes/${row.original.id}`)}
          >
            Xem
          </Button>
        );
      },
    },
  ];

  const table = useReactTable({
    data: bikes,
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Xe</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Quản lý xe đã đăng ký và khách hàng
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <Input
          placeholder="Lọc theo hãng, mẫu xe, biển số, hoặc khách hàng..."
          value={(table.getColumn('license_plate')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('license_plate')?.setFilterValue(event.target.value)
          }
          className="w-full sm:max-w-sm"
        />
        <Button onClick={() => setIsSheetOpen(true)} className="w-full sm:w-auto">
          Thêm Xe
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
                  {isLoading ? 'Đang tải...' : 'Không tìm thấy xe.'}
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
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Thêm Xe Mới</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 pt-6">
            <CreateBikeForm
              onSuccess={handleBikeCreated}
              onCancel={() => setIsSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
