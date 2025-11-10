import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';

interface CashPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirmPayment: (amountPaid: number, change: number) => void;
}

// Quick amount buttons for fast cash payments
const QUICK_AMOUNTS = [
  50000, 100000, 200000, 500000, 1000000, 2000000,
];

export function CashPaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirmPayment,
}: CashPaymentDialogProps) {
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [change, setChange] = useState<number>(0);

  // Calculate change whenever amount paid changes
  useEffect(() => {
    const paid = parseFloat(amountPaid) || 0;
    const changeAmount = paid - totalAmount;
    setChange(changeAmount > 0 ? changeAmount : 0);
  }, [amountPaid, totalAmount]);

  // Handle quick amount button click
  const handleQuickAmount = (amount: number) => {
    setAmountPaid(amount.toString());
  };

  // Handle exact amount
  const handleExactAmount = () => {
    setAmountPaid(totalAmount.toString());
  };

  // Handle payment confirmation
  const handleConfirm = () => {
    const paid = parseFloat(amountPaid) || 0;
    if (paid >= totalAmount) {
      onConfirmPayment(paid, change);
      onOpenChange(false);
      setAmountPaid('');
    }
  };

  // Reset when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAmountPaid('');
      setChange(0);
    }
    onOpenChange(newOpen);
  };

  const isPaidEnough = parseFloat(amountPaid) >= totalAmount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cash Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Amount */}
          <div className="bg-muted rounded-lg p-4">
            <Label className="text-sm text-muted-foreground">Total Amount</Label>
            <div className="text-3xl font-bold text-primary mt-1">
              {formatCurrency(totalAmount)}
            </div>
          </div>

          {/* Amount Paid Input */}
          <div className="space-y-2">
            <Label htmlFor="amount-paid">Amount Paid</Label>
            <Input
              id="amount-paid"
              type="number"
              placeholder="Enter amount..."
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="h-14 text-2xl"
              autoFocus
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="space-y-2">
            <Label>Quick Amounts</Label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => handleQuickAmount(amount)}
                  className="h-12"
                >
                  {formatCurrency(amount)}
                </Button>
              ))}
            </div>
          </div>

          {/* Exact Amount Button */}
          <Button
            variant="secondary"
            onClick={handleExactAmount}
            className="w-full"
          >
            Exact Amount ({formatCurrency(totalAmount)})
          </Button>

          <Separator />

          {/* Change Display */}
          <div className={`rounded-lg p-4 ${change > 0 ? 'bg-green-50 border-2 border-green-200' : 'bg-muted'}`}>
            <Label className="text-sm text-muted-foreground">Change</Label>
            <div className={`text-3xl font-bold mt-1 ${change > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
              {formatCurrency(change)}
            </div>
          </div>

          {/* Validation Message */}
          {amountPaid && !isPaidEnough && (
            <div className="text-sm text-destructive">
              Amount paid is less than the total. Please enter at least {formatCurrency(totalAmount)}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isPaidEnough}
            className="flex-1"
          >
            Complete Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
