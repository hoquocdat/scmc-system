import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api-client';
import type { Part, ServicePart } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

interface PartsUsageManagerProps {
  serviceOrderId: string;
}

interface ServicePartWithDetails extends ServicePart {
  part_name?: string;
  part_number?: string;
}

export function PartsUsageManager({ serviceOrderId }: PartsUsageManagerProps) {
  const [serviceParts, setServiceParts] = useState<ServicePartWithDetails[]>([]);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`service-parts-${serviceOrderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_parts',
          filter: `service_order_id=eq.${serviceOrderId}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serviceOrderId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load service parts with part details
      const partsData: any = await apiClient.serviceParts.getAll(serviceOrderId);

      const partsWithDetails = partsData?.map((sp: any) => ({
        ...sp,
        part_name: sp.parts?.name,
        part_number: sp.parts?.part_number,
      })) || [];

      setServiceParts(partsWithDetails);

      // Load available parts from inventory
      const inventoryData: any = await apiClient.parts.getAll(1, 1000);
      const availableParts = inventoryData?.data?.filter((p: Part) => p.quantity_in_stock > 0) || [];
      setAvailableParts(availableParts);
    } catch (error) {
      console.error('Error loading parts data:', error);
      toast.error('Failed to load parts data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPart = async () => {
    if (!selectedPartId || !quantity) {
      toast.error('Please select a part and enter quantity');
      return;
    }

    const selectedPart = availableParts.find(p => p.id === selectedPartId);
    if (!selectedPart) {
      toast.error('Selected part not found');
      return;
    }

    const quantityNum = parseInt(quantity);
    if (quantityNum <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (quantityNum > selectedPart.quantity_in_stock) {
      toast.error(`Only ${selectedPart.quantity_in_stock} units available in stock`);
      return;
    }

    try {
      setSubmitting(true);

      await apiClient.serviceParts.create({
        service_order_id: serviceOrderId,
        part_id: selectedPartId,
        quantity_used: quantityNum,
        unit_cost: selectedPart.unit_cost || 0,
      });

      toast.success('Part added successfully');
      setIsFormOpen(false);
      setSelectedPartId('');
      setQuantity('1');
    } catch (error) {
      console.error('Error adding part:', error);
      toast.error('Failed to add part');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePart = async (id: string) => {
    if (!confirm('Are you sure you want to remove this part?')) return;

    try {
      await apiClient.serviceParts.delete(id);
      toast.success('Part removed successfully');
    } catch (error) {
      console.error('Error deleting part:', error);
      toast.error('Failed to remove part');
    }
  };

  const getTotalCost = (): number => {
    return serviceParts.reduce((sum, sp) => sum + sp.total_cost, 0);
  };

  const selectedPart = availableParts.find(p => p.id === selectedPartId);

  if (loading) {
    return <div>Loading parts...</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold">Parts Used</h3>
          <p className="text-sm text-muted-foreground">
            {serviceParts.length} part{serviceParts.length !== 1 ? 's' : ''} used
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto">
          Add Part
        </Button>
      </div>

      {serviceParts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No parts used yet. Click "Add Part" to record part usage.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {serviceParts.map((sp) => (
              <Card key={sp.id}>
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm sm:text-base">{sp.part_name}</h4>
                        {sp.part_number && (
                          <span className="text-xs text-muted-foreground font-mono">
                            #{sp.part_number}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>{' '}
                          <span className="font-medium">{sp.quantity_used}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Unit Cost:</span>{' '}
                          <span className="font-medium">${sp.unit_cost.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>{' '}
                          <span className="font-medium">${sp.total_cost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePart(sp.id)}
                      className="w-full sm:w-auto"
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Parts Cost Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Parts Cost:</span>
                <span>${getTotalCost().toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Part Dialog */}
      {isFormOpen && (
        <Dialog open={true} onOpenChange={() => setIsFormOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Part</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="part">Select Part</Label>
                <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a part..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableParts.map((part) => (
                      <SelectItem key={part.id} value={part.id}>
                        {part.name} {part.part_number && `(#${part.part_number})`} - Stock: {part.quantity_in_stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPart && (
                <div className="p-3 bg-slate-50 rounded text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Available:</span>{' '}
                    <span className="font-medium">{selectedPart.quantity_in_stock} units</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unit Cost:</span>{' '}
                    <span className="font-medium">${selectedPart.unit_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedPart?.quantity_in_stock || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {selectedPart && quantity && parseInt(quantity) > 0 && (
                <div className="p-3 bg-blue-50 rounded text-sm">
                  <div className="font-semibold">Total Cost:</div>
                  <div className="text-lg">
                    ${((selectedPart.unit_cost || 0) * parseInt(quantity)).toFixed(2)}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddPart}
                  disabled={!selectedPartId || !quantity || submitting}
                >
                  {submitting ? 'Adding...' : 'Add Part'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
