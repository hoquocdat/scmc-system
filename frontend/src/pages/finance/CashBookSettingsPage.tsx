import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountsTab } from '@/components/cash-book/settings/AccountsTab';
import { CategoriesTab } from '@/components/cash-book/settings/CategoriesTab';
import { MethodMapTab } from '@/components/cash-book/settings/MethodMapTab';
import { OpeningBalancesTab } from '@/components/cash-book/settings/OpeningBalancesTab';

/** Cài đặt sổ quỹ: accounts, payment-method mapping, categories, opening balances. */
export function CashBookSettingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Về sổ quỹ"><Link to="/cash-book"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Cài đặt sổ quỹ</h1>
          <p className="text-sm text-muted-foreground">Tài khoản tiền của từng chi nhánh, nơi ghi nhận từng phương thức thanh toán và các loại thu chi.</p>
        </div>
      </div>
      <Tabs defaultValue="accounts">
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">Tài khoản</TabsTrigger>
          <TabsTrigger value="methods">Phương thức thanh toán</TabsTrigger>
          <TabsTrigger value="categories">Loại thu chi</TabsTrigger>
          <TabsTrigger value="opening">Số dư đầu kỳ</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="methods"><MethodMapTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="opening"><OpeningBalancesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
