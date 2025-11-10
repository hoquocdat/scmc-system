import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { apiClient } from '../lib/api-client';
import type { Payment, ServiceOrder } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';

interface PaymentWithDetails extends Payment {
  order_number?: string;
  motorcycle_info?: string;
  owner_name?: string;
}

interface OrderWithPayments extends ServiceOrder {
  total_paid?: number;
  balance?: number;
  motorcycle_info?: string;
  owner_name?: string;
}

interface PaymentFormData {
  amount: string;
  payment_method: 'cash' | 'card' | 'transfer';
  is_deposit: boolean;
  notes?: string;
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isUnderDevelopmentOpen, setIsUnderDevelopmentOpen] = useState(true);
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [outstandingOrders, setOutstandingOrders] = useState<OrderWithPayments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [selectedOrder, setSelectedOrder] = useState<OrderWithPayments | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<PaymentFormData>({
    defaultValues: {
      amount: '',
      payment_method: 'cash',
      is_deposit: false,
      notes: '',
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load recent payments
      const paymentsResponse: any = await apiClient.payments.getAll(1, 100);
      const paymentsWithDetails = (paymentsResponse.data || []).map((p: any) => ({
        ...p,
        order_number: p.order_number || 'N/A',
        motorcycle_info: 'N/A', // TODO: Backend needs to include joined data
        owner_name: 'N/A', // TODO: Backend needs to include joined data
      }));
      setPayments(paymentsWithDetails);

      // Load service orders with outstanding balances
      const outstandingResponse: any = await apiClient.payments.getOutstanding();
      const ordersWithBalances = (outstandingResponse || []).map((order: any) => ({
        ...order,
        motorcycle_info: order.bikes
          ? `${order.bikes.brand} ${order.bikes.model} (${order.bikes.license_plate})`
          : 'N/A',
        owner_name: 'N/A', // TODO: Backend needs to include owner data
      }));
      setOutstandingOrders(ordersWithBalances);
    } catch (err: any) {
      console.error('Error loading data:', err);
      toast.error('Failed to load payment data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (order: OrderWithPayments) => {
    setSelectedOrder(order);
    reset({
      amount: order.balance?.toFixed(2) || '',
      payment_method: 'cash',
      is_deposit: false,
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (!selectedOrder) return;

    try {
      const amount = parseFloat(data.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      if (amount > (selectedOrder.balance || 0)) {
        throw new Error('Amount exceeds outstanding balance');
      }

      await apiClient.payments.create({
        service_order_id: selectedOrder.id,
        amount: amount,
        payment_method: data.payment_method,
        is_deposit: data.is_deposit,
        payment_date: new Date().toISOString(),
        received_by: user?.id,
        notes: data.notes,
      });

      toast.success('Payment recorded successfully');
      setIsDialogOpen(false);
      setSelectedOrder(null);
      reset();
      loadData();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      toast.error(err.message || 'Failed to record payment');
    }
  };

  const getTotalRevenue = (): number => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  const getTotalOutstanding = (): number => {
    return outstandingOrders.reduce((sum, o) => sum + (o.balance || 0), 0);
  };

  const outstandingColumns: ColumnDef<OrderWithPayments>[] = [
    {
      accessorKey: 'order_number',
      header: 'Order #',
      cell: ({ row }) => (
        <div className="font-mono">{row.getValue('order_number')}</div>
      ),
    },
    {
      accessorKey: 'motorcycle_info',
      header: () => <div className="hidden sm:table-cell">Bike</div>,
      cell: ({ row }) => <div className="hidden sm:table-cell">{row.getValue('motorcycle_info')}</div>,
    },
    {
      accessorKey: 'owner_name',
      header: () => <div className="hidden md:table-cell">Owner</div>,
      cell: ({ row }) => <div className="hidden md:table-cell">{row.getValue('owner_name')}</div>,
    },
    {
      id: 'total_cost',
      header: 'Total Cost',
      cell: ({ row }) => {
        const order = row.original;
        return <div>${(order.final_cost || order.estimated_cost || 0).toFixed(2)}</div>;
      },
    },
    {
      id: 'paid',
      header: 'Paid',
      cell: ({ row }) => {
        const order = row.original;
        return <div className="text-green-600">${(order.total_paid || 0).toFixed(2)}</div>;
      },
    },
    {
      id: 'balance',
      header: 'Balance',
      cell: ({ row }) => {
        const order = row.original;
        return <div className="font-bold text-orange-600">${(order.balance || 0).toFixed(2)}</div>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const order = row.original;
        return (
          <Button size="sm" onClick={() => handleOpenDialog(order)}>
            Record Payment
          </Button>
        );
      },
    },
  ];

  const paymentsColumns: ColumnDef<PaymentWithDetails>[] = [
    {
      accessorKey: 'payment_date',
      header: 'Date',
      cell: ({ row }) => {
        const date = row.getValue('payment_date') as string;
        return <div>{new Date(date).toLocaleDateString()}</div>;
      },
    },
    {
      accessorKey: 'order_number',
      header: 'Order #',
      cell: ({ row }) => (
        <div className="font-mono">{row.getValue('order_number')}</div>
      ),
    },
    {
      accessorKey: 'motorcycle_info',
      header: () => <div className="hidden md:table-cell">Bike</div>,
      cell: ({ row }) => <div className="hidden md:table-cell">{row.getValue('motorcycle_info')}</div>,
    },
    {
      accessorKey: 'owner_name',
      header: () => <div className="hidden lg:table-cell">Owner</div>,
      cell: ({ row }) => <div className="hidden lg:table-cell">{row.getValue('owner_name')}</div>,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const amount = row.getValue('amount') as number;
        return <div className="font-bold text-green-600">${amount.toFixed(2)}</div>;
      },
    },
    {
      accessorKey: 'payment_method',
      header: () => <div className="hidden sm:table-cell">Method</div>,
      cell: ({ row }) => {
        const method = row.getValue('payment_method') as string;
        return <div className="hidden sm:table-cell"><Badge variant="secondary">{method}</Badge></div>;
      },
    },
    {
      accessorKey: 'is_deposit',
      header: 'Type',
      cell: ({ row }) => {
        const isDeposit = row.getValue('is_deposit') as boolean;
        return isDeposit ? (
          <Badge variant="default">Deposit</Badge>
        ) : (
          <Badge variant="secondary">Payment</Badge>
        );
      },
    },
  ];

  const outstandingTable = useReactTable({
    data: outstandingOrders,
    columns: outstandingColumns,
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

  const paymentsTable = useReactTable({
    data: payments,
    columns: paymentsColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Payments & Finance</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Track payments, outstanding balances, and financial transactions
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue</div>
          <div className="text-xl sm:text-2xl font-bold text-green-600">${getTotalRevenue().toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">From {payments.length} payments</div>
        </div>
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Outstanding</div>
          <div className="text-xl sm:text-2xl font-bold text-orange-600">${getTotalOutstanding().toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">From {outstandingOrders.length} orders</div>
        </div>
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Pending Invoices</div>
          <div className="text-xl sm:text-2xl font-bold">{outstandingOrders.length}</div>
          <div className="text-xs text-muted-foreground">Require payment</div>
        </div>
      </div>

      {/* Outstanding Balances */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold">Outstanding Balances</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {outstandingOrders.length} order{outstandingOrders.length !== 1 ? 's' : ''} with unpaid balance
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <Input
            placeholder="Filter by order number, motorcycle, or owner..."
            value={(outstandingTable.getColumn('order_number')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              outstandingTable.getColumn('order_number')?.setFilterValue(event.target.value)
            }
            className="w-full sm:max-w-sm"
          />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              {outstandingTable.getHeaderGroups().map((headerGroup) => (
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
              {outstandingTable.getRowModel().rows?.length ? (
                outstandingTable.getRowModel().rows.map((row) => (
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
                    colSpan={outstandingColumns.length}
                    className="h-24 text-center"
                  >
                    {isLoading ? 'Loading...' : 'No outstanding balances.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-4">
          <div className="text-xs sm:text-sm text-muted-foreground">
            {outstandingTable.getFilteredRowModel().rows.length} order(s)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => outstandingTable.previousPage()}
              disabled={!outstandingTable.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => outstandingTable.nextPage()}
              disabled={!outstandingTable.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div>
        <div className="mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold">Recent Payments</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Last 100 payment transactions</p>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              {paymentsTable.getHeaderGroups().map((headerGroup) => (
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
              {paymentsTable.getRowModel().rows?.length ? (
                paymentsTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
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
                    colSpan={paymentsColumns.length}
                    className="h-24 text-center"
                  >
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-4">
          <div className="text-xs sm:text-sm text-muted-foreground">
            {paymentsTable.getFilteredRowModel().rows.length} payment(s)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paymentsTable.previousPage()}
              disabled={!paymentsTable.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => paymentsTable.nextPage()}
              disabled={!paymentsTable.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Record Payment Dialog */}
      {isDialogOpen && selectedOrder && (
        <Dialog open={true} onOpenChange={() => setIsDialogOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="mb-4 p-3 bg-slate-50 rounded">
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Order:</span>{' '}
                  <span className="font-mono">{selectedOrder.order_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Bike:</span>{' '}
                  <span>{selectedOrder.motorcycle_info}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Owner:</span>{' '}
                  <span>{selectedOrder.owner_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Cost:</span>{' '}
                  <span className="font-medium">
                    ${(selectedOrder.final_cost || selectedOrder.estimated_cost || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Already Paid:</span>{' '}
                  <span className="text-green-600 font-medium">
                    ${(selectedOrder.total_paid || 0).toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Outstanding Balance:</span>{' '}
                  <span className="text-orange-600 font-bold text-lg">
                    ${(selectedOrder.balance || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="amount">Payment Amount ($) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...register('amount', {
                    required: 'Amount is required',
                    min: {
                      value: 0.01,
                      message: 'Amount must be greater than 0',
                    },
                    max: {
                      value: selectedOrder.balance || 0,
                      message: 'Amount exceeds outstanding balance',
                    },
                  })}
                />
                {errors.amount && (
                  <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Controller
                  name="payment_method"
                  control={control}
                  rules={{ required: 'Payment method is required' }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.payment_method && (
                  <p className="text-sm text-red-600 mt-1">{errors.payment_method.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_deposit"
                  {...register('is_deposit')}
                  className="rounded"
                />
                <Label htmlFor="is_deposit" className="cursor-pointer">
                  This is a deposit payment
                </Label>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  {...register('notes')}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Record Payment'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

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
              Tính năng thanh toán và tài chính hiện đang trong quá trình phát triển và sẽ sớm được ra mắt.
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
