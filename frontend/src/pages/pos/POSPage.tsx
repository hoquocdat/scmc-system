import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  CreditCard,
  Banknote,
  Search,
  User,
  Tag,
  Minus,
  Plus,
  Trash2,
  ShoppingCart as ShoppingCartIcon,
} from 'lucide-react';
import { productsApi, type Product } from '@/lib/api/products';
import { type Customer } from '@/lib/api/customers';
import { formatCurrency } from '@/lib/utils';
import { CustomerLookupDialog } from '@/components/pos/CustomerLookupDialog';
import { CashPaymentDialog } from '@/components/pos/CashPaymentDialog';
import { CardPaymentDialog } from '@/components/pos/CardPaymentDialog';
import { EWalletPaymentDialog } from '@/components/pos/EWalletPaymentDialog';
import { ReceiptDialog } from '@/components/pos/ReceiptDialog';
import type { ReceiptData } from '@/components/pos/ReceiptTemplate';
import { generateReceiptNumber } from '@/lib/utils/print';

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  discount?: number;
}

export function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isCashPaymentDialogOpen, setIsCashPaymentDialogOpen] = useState(false);
  const [isCardPaymentDialogOpen, setIsCardPaymentDialogOpen] = useState(false);
  const [isEWalletPaymentDialogOpen, setIsEWalletPaymentDialogOpen] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Fetch products for POS (active products only)
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['pos-products', searchQuery],
    queryFn: () =>
      productsApi.getAll({
        search: searchQuery,
        is_active: true,
        limit: 50,
      }),
  });

  // Add product to cart
  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id);

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      const price = product.sale_price || product.retail_price;
      setCart([...cart, { product, quantity: 1, price, discount: 0 }]);
    }
  };

  // Update quantity
  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  // Calculate totals
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalDiscount = cart.reduce(
    (sum, item) => sum + (item.discount || 0) * item.quantity,
    0
  );
  const vat = (subtotal - totalDiscount) * 0.1; // 10% VAT
  const total = subtotal - totalDiscount + vat;

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
  };

  // Generate receipt and show dialog
  const showReceipt = (paymentMethod: string, paymentDetails: any) => {
    const receipt: ReceiptData = {
      receiptNumber: generateReceiptNumber(),
      date: new Date(),
      customer: selectedCustomer,
      items: cart.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
      })),
      subtotal,
      discount: totalDiscount,
      vat,
      total,
      paymentMethod,
      amountPaid: paymentDetails.amountPaid || total,
      change: paymentDetails.change,
      cashier: 'Current User', // TODO: Get from auth context
      location: 'HCMC Store', // TODO: Get from settings
    };

    setReceiptData(receipt);
    setIsReceiptDialogOpen(true);
  };

  // Handle cash payment
  const handleCashPayment = (amountPaid: number, change: number) => {
    // TODO: Create sales transaction via API
    console.log('Cash payment completed:', {
      total,
      amountPaid,
      change,
      customer: selectedCustomer,
      items: cart,
    });

    // Show receipt
    showReceipt('Tiền mặt', { amountPaid, change });
    clearCart();
  };

  // Handle card payment
  const handleCardPayment = (transactionId: string, last4Digits: string) => {
    // TODO: Create sales transaction via API
    console.log('Card payment completed:', {
      total,
      transactionId,
      last4Digits,
      customer: selectedCustomer,
      items: cart,
    });

    // Show receipt
    showReceipt(`Thẻ ****${last4Digits}`, { amountPaid: total });
    clearCart();
  };

  // Handle e-wallet payment
  const handleEWalletPayment = (provider: string, transactionId: string) => {
    // TODO: Create sales transaction via API
    console.log('E-wallet payment completed:', {
      total,
      provider,
      transactionId,
      customer: selectedCustomer,
      items: cart,
    });

    // Show receipt
    showReceipt(provider.toUpperCase(), { amountPaid: total });
    clearCart();
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">Fast checkout terminal</p>
          </div>
          <div className="flex gap-2">
            {selectedCustomer && (
              <Badge variant="outline" className="py-2 px-3">
                <User className="mr-2 h-4 w-4" />
                {selectedCustomer.full_name}
              </Badge>
            )}
            <Button variant="outline" size="sm">
              <CreditCard className="mr-2 h-4 w-4" />
              Close Session
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">
        {/* Products Section */}
        <div className="lg:col-span-2 border-r overflow-y-auto p-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by product name, SKU, or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
                autoFocus
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {productsLoading ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Loading products...
              </div>
            ) : productsData?.data && productsData.data.length > 0 ? (
              productsData.data.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="aspect-square bg-muted rounded-md mb-3 flex items-center justify-center">
                      <ShoppingCartIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {product.sku}
                    </p>
                    <div className="flex items-baseline gap-2">
                      {product.sale_price && product.sale_price < product.retail_price ? (
                        <>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(product.sale_price)}
                          </span>
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCurrency(product.retail_price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold">
                          {formatCurrency(product.retail_price)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p>No products found</p>
                <p className="text-sm mt-2">
                  Try adjusting your search or add products first
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cart & Checkout Section */}
        <div className="flex flex-col bg-card overflow-hidden">
          {/* Customer Section */}
          <div className="p-4 border-b">
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => setIsCustomerDialogOpen(true)}
            >
              <User className="mr-2 h-5 w-5" />
              {selectedCustomer ? selectedCustomer.full_name : 'Select Customer'}
            </Button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCartIcon className="h-16 w-16 mb-4" />
                <p>Cart is empty</p>
                <p className="text-sm">Add products to start a sale</p>
              </div>
            ) : (
              cart.map((item) => (
                <Card key={item.product.id}>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="font-semibold text-sm line-clamp-1">
                          {item.product.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {item.product.sku}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-12 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(item.price * item.quantity)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(item.price)} ea.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Totals */}
          {cart.length > 0 && (
            <div className="border-t p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span className="font-semibold">
                      -{formatCurrency(totalDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>VAT (10%):</span>
                  <span className="font-semibold">{formatCurrency(vat)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" size="sm">
                <Tag className="mr-2 h-4 w-4" />
                Apply Discount
              </Button>
            </div>
          )}

          {/* Payment Buttons */}
          <div className="p-4 space-y-2 border-t bg-muted/30">
            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => setIsCashPaymentDialogOpen(true)}
            >
              <Banknote className="mr-2 h-5 w-5" />
              Pay Cash
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              disabled={cart.length === 0}
              onClick={() => setIsCardPaymentDialogOpen(true)}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Pay Card
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              disabled={cart.length === 0}
              onClick={() => setIsEWalletPaymentDialogOpen(true)}
            >
              <DollarSign className="mr-2 h-5 w-5" />
              E-Wallet
            </Button>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                className="w-full"
                size="sm"
                onClick={clearCart}
              >
                Clear Cart
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Customer Lookup Dialog */}
      <CustomerLookupDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onSelectCustomer={setSelectedCustomer}
      />

      {/* Cash Payment Dialog */}
      <CashPaymentDialog
        open={isCashPaymentDialogOpen}
        onOpenChange={setIsCashPaymentDialogOpen}
        totalAmount={total}
        onConfirmPayment={handleCashPayment}
      />

      {/* Card Payment Dialog */}
      <CardPaymentDialog
        open={isCardPaymentDialogOpen}
        onOpenChange={setIsCardPaymentDialogOpen}
        totalAmount={total}
        onConfirmPayment={handleCardPayment}
      />

      {/* E-Wallet Payment Dialog */}
      <EWalletPaymentDialog
        open={isEWalletPaymentDialogOpen}
        onOpenChange={setIsEWalletPaymentDialogOpen}
        totalAmount={total}
        onConfirmPayment={handleEWalletPayment}
      />

      {/* Receipt Dialog */}
      {receiptData && (
        <ReceiptDialog
          open={isReceiptDialogOpen}
          onOpenChange={setIsReceiptDialogOpen}
          receiptData={receiptData}
          onNewSale={clearCart}
        />
      )}
    </div>
  );
}
