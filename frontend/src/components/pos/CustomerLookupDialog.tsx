import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Phone, Mail, UserPlus } from 'lucide-react';
import { customersApi, type Customer } from '@/lib/api/customers';

interface CustomerLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCustomer: (customer: Customer) => void;
}

export function CustomerLookupDialog({
  open,
  onOpenChange,
  onSelectCustomer,
}: CustomerLookupDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers', searchQuery],
    queryFn: () =>
      customersApi.getAll({
        search: searchQuery,
        limit: 10,
      }),
    enabled: open,
  });

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    onOpenChange(false);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Quick Add Button */}
          <Button variant="outline" className="w-full">
            <UserPlus className="mr-2 h-4 w-4" />
            Create New Customer
          </Button>

          {/* Customer List */}
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading customers...
              </div>
            ) : customersData?.data && customersData.data.length > 0 ? (
              customersData.data.map((customer) => (
                <Card
                  key={customer.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base mb-1">
                          {customer.full_name}
                        </h3>
                        <div className="space-y-1">
                          {customer.phone && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Phone className="h-3 w-3 mr-2" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Mail className="h-3 w-3 mr-2" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No customers found</p>
                <p className="text-sm mt-2">Try adjusting your search or create a new customer</p>
              </div>
            )}
          </div>

          {/* Walk-in Customer Option */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onSelectCustomer({
                id: 'walk-in',
                full_name: 'Walk-in Customer',
                phone: '',
                email: '',
                address: '',
                customer_type: 'individual',
                notes: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              onOpenChange(false);
              setSearchQuery('');
            }}
          >
            Continue as Walk-in Customer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
