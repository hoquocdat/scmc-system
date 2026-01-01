import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  loyaltyAdminApi,
  loyaltyApi,
  type LoyaltyTier,
  type CreateTierDto,
  type UpdateTierDto,
  type CreateRuleVersionDto,
  formatPoints,
} from '@/lib/api/loyalty';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { toast } from 'sonner';
import {
  Gift,
  Star,
  Plus,
  Pencil,
  Trash2,
  Users,
  TrendingUp,
  Award,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function LoyaltySettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Tier dialog state
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);

  // Rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

  // Fetch data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['loyaltyStats'],
    queryFn: () => loyaltyAdminApi.getStats(),
  });

  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['loyaltyTiers'],
    queryFn: () => loyaltyApi.getTiers(),
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['loyaltyRules'],
    queryFn: () => loyaltyAdminApi.getRuleVersions(),
  });

  // Mutations
  const createTierMutation = useMutation({
    mutationFn: (data: CreateTierDto) => loyaltyAdminApi.createTier(data),
    onSuccess: () => {
      toast.success('Tạo hạng thành viên thành công');
      queryClient.invalidateQueries({ queryKey: ['loyaltyTiers'] });
      setTierDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể tạo hạng thành viên');
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTierDto }) =>
      loyaltyAdminApi.updateTier(id, data),
    onSuccess: () => {
      toast.success('Cập nhật hạng thành viên thành công');
      queryClient.invalidateQueries({ queryKey: ['loyaltyTiers'] });
      setTierDialogOpen(false);
      setEditingTier(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật hạng thành viên');
    },
  });

  const deleteTierMutation = useMutation({
    mutationFn: (id: string) => loyaltyAdminApi.deleteTier(id),
    onSuccess: () => {
      toast.success('Đã vô hiệu hóa hạng thành viên');
      queryClient.invalidateQueries({ queryKey: ['loyaltyTiers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể xóa hạng thành viên');
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: CreateRuleVersionDto) => loyaltyAdminApi.createRuleVersion(data),
    onSuccess: () => {
      toast.success('Tạo phiên bản quy tắc mới thành công');
      queryClient.invalidateQueries({ queryKey: ['loyaltyRules'] });
      setRuleDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể tạo quy tắc');
    },
  });

  const activateRuleMutation = useMutation({
    mutationFn: (id: string) => loyaltyAdminApi.activateRuleVersion(id),
    onSuccess: () => {
      toast.success('Kích hoạt quy tắc thành công');
      queryClient.invalidateQueries({ queryKey: ['loyaltyRules'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể kích hoạt quy tắc');
    },
  });

  const handleEditTier = (tier: LoyaltyTier) => {
    setEditingTier(tier);
    setTierDialogOpen(true);
  };

  const handleCloseTierDialog = () => {
    setTierDialogOpen(false);
    setEditingTier(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6" />
            Chương trình khách hàng thân thiết
          </h1>
          <p className="text-muted-foreground">
            Quản lý hạng thành viên, điểm thưởng và quy tắc tích lũy
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="tiers">Hạng thành viên</TabsTrigger>
          <TabsTrigger value="rules">Quy tắc tích lũy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {statsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Tổng thành viên
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      <span className="text-2xl font-bold">
                        {stats.totalMembers.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Điểm đã phát hành
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <span className="text-2xl font-bold">
                        {formatPoints(stats.totalPointsIssued)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Điểm đã đổi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-orange-500" />
                      <span className="text-2xl font-bold">
                        {formatPoints(stats.totalPointsRedeemed)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Điểm chưa sử dụng
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      <span className="text-2xl font-bold">
                        {formatPoints(stats.totalPointsBalance)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Phân bổ thành viên theo hạng</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.membersByTier.map((item) => {
                      const percent =
                        stats.totalMembers > 0
                          ? (item.count / stats.totalMembers) * 100
                          : 0;
                      return (
                        <div key={item.tierName} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{item.tierName}</span>
                            <span className="text-muted-foreground">
                              {item.count.toLocaleString()} ({percent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="tiers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Quản lý hạng thành viên</h2>
            <Button onClick={() => setTierDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm hạng mới
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thứ tự</TableHead>
                  <TableHead>Hạng</TableHead>
                  <TableHead>Điểm tối thiểu</TableHead>
                  <TableHead>Hệ số điểm</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiersLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : tiers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Chưa có hạng thành viên nào
                    </TableCell>
                  </TableRow>
                ) : (
                  tiers?.map((tier: any) => (
                    <TableRow key={tier.id}>
                      <TableCell>{tier.display_order}</TableCell>
                      <TableCell>
                        <TierBadge tierCode={tier.code} tierName={tier.name} />
                      </TableCell>
                      <TableCell>{formatPoints(tier.min_points)} điểm</TableCell>
                      <TableCell>x{Number(tier.points_multiplier).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                          {tier.is_active ? 'Đang hoạt động' : 'Đã vô hiệu'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTier(tier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTierMutation.mutate(tier.id)}
                            disabled={!tier.is_active}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Quy tắc tích lũy và đổi điểm</h2>
            <Button onClick={() => setRuleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo phiên bản mới
            </Button>
          </div>

          <div className="space-y-4">
            {rulesLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)
            ) : rules?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Chưa có quy tắc nào
                </CardContent>
              </Card>
            ) : (
              rules?.map((rule: any) => (
                <Card key={rule.id} className={rule.is_active ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">
                          Phiên bản {rule.version_number}
                        </CardTitle>
                        {rule.is_active && (
                          <Badge variant="default" className="bg-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Đang áp dụng
                          </Badge>
                        )}
                      </div>
                      {!rule.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => activateRuleMutation.mutate(rule.id)}
                        >
                          Kích hoạt
                        </Button>
                      )}
                    </div>
                    <CardDescription>
                      Có hiệu lực từ:{' '}
                      {format(new Date(rule.effective_from), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Tỷ lệ tích điểm</Label>
                        <p className="font-medium">
                          1 điểm / {(1 / Number(rule.points_per_currency)).toLocaleString()} ₫
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Giá trị đổi điểm</Label>
                        <p className="font-medium">
                          1 điểm = {Number(rule.redemption_rate).toLocaleString()} ₫
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Đổi tối đa</Label>
                        <p className="font-medium">{rule.max_redemption_percent}% đơn hàng</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Điểm tối thiểu để đổi</Label>
                        <p className="font-medium">{rule.min_redemption_points} điểm</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Cho phép giảm hạng</Label>
                        <p className="font-medium">
                          {rule.allow_tier_downgrade ? 'Có' : 'Không'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Đánh giá hạng dựa trên</Label>
                        <p className="font-medium">
                          {rule.tier_evaluation_basis === 'lifetime_points'
                            ? 'Điểm tích lũy'
                            : 'Tổng chi tiêu'}
                        </p>
                      </div>
                    </div>
                    {rule.notes && (
                      <p className="mt-4 text-sm text-muted-foreground">{rule.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tier Dialog */}
      <TierFormDialog
        open={tierDialogOpen}
        onClose={handleCloseTierDialog}
        tier={editingTier}
        onSubmit={(data) => {
          if (editingTier) {
            updateTierMutation.mutate({ id: editingTier.id, data });
          } else {
            createTierMutation.mutate(data as CreateTierDto);
          }
        }}
        isLoading={createTierMutation.isPending || updateTierMutation.isPending}
      />

      {/* Rule Dialog */}
      <RuleFormDialog
        open={ruleDialogOpen}
        onClose={() => setRuleDialogOpen(false)}
        onSubmit={(data) => createRuleMutation.mutate(data)}
        isLoading={createRuleMutation.isPending}
      />
    </div>
  );
}

// Tier Form Dialog Component
function TierFormDialog({
  open,
  onClose,
  tier,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  tier: LoyaltyTier | null;
  onSubmit: (data: CreateTierDto | UpdateTierDto) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateTierDto>({
    code: '',
    name: '',
    displayOrder: 0,
    minPoints: 0,
    pointsMultiplier: 1,
    isActive: true,
  });

  // Update form when tier changes
  useState(() => {
    if (tier) {
      setFormData({
        code: tier.code,
        name: tier.name,
        displayOrder: tier.displayOrder,
        minPoints: tier.minPoints,
        pointsMultiplier: tier.pointsMultiplier,
        isActive: tier.isActive,
      });
    } else {
      setFormData({
        code: '',
        name: '',
        displayOrder: 0,
        minPoints: 0,
        pointsMultiplier: 1,
        isActive: true,
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tier ? 'Sửa hạng thành viên' : 'Thêm hạng thành viên mới'}</DialogTitle>
          <DialogDescription>
            Cấu hình thông tin hạng thành viên trong chương trình khách hàng thân thiết
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Mã hạng</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="vd: gold"
                disabled={!!tier}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Tên hạng</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="vd: Golden Legend"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayOrder">Thứ tự hiển thị</Label>
              <Input
                id="displayOrder"
                type="number"
                min={0}
                value={formData.displayOrder}
                onChange={(e) =>
                  setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minPoints">Điểm tối thiểu</Label>
              <Input
                id="minPoints"
                type="number"
                min={0}
                value={formData.minPoints}
                onChange={(e) =>
                  setFormData({ ...formData, minPoints: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pointsMultiplier">Hệ số điểm thưởng</Label>
              <Input
                id="pointsMultiplier"
                type="number"
                min={1}
                max={10}
                step={0.25}
                value={formData.pointsMultiplier}
                onChange={(e) =>
                  setFormData({ ...formData, pointsMultiplier: parseFloat(e.target.value) || 1 })
                }
              />
            </div>
            <div className="space-y-2 flex items-center gap-2 pt-6">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Kích hoạt</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang lưu...' : tier ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Rule Form Dialog Component
function RuleFormDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRuleVersionDto) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateRuleVersionDto>({
    pointsPerCurrency: 0.0001,
    redemptionRate: 1000,
    maxRedemptionPercent: 50,
    minRedemptionPoints: 100,
    allowTierDowngrade: false,
    tierEvaluationBasis: 'lifetime_points',
    isActive: true,
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo phiên bản quy tắc mới</DialogTitle>
          <DialogDescription>
            Cấu hình quy tắc tích lũy và đổi điểm thưởng. Phiên bản mới sẽ tự động kích hoạt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tỷ lệ tích điểm</Label>
              <div className="flex items-center gap-2">
                <span>1 điểm /</span>
                <Input
                  type="number"
                  min={1000}
                  step={1000}
                  value={Math.round(1 / formData.pointsPerCurrency)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pointsPerCurrency: 1 / (parseInt(e.target.value) || 10000),
                    })
                  }
                  className="w-32"
                />
                <span>₫</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Giá trị đổi điểm</Label>
              <div className="flex items-center gap-2">
                <span>1 điểm =</span>
                <Input
                  type="number"
                  min={1}
                  value={formData.redemptionRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      redemptionRate: parseInt(e.target.value) || 1000,
                    })
                  }
                  className="w-32"
                />
                <span>₫</span>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Đổi tối đa (% đơn hàng)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formData.maxRedemptionPercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxRedemptionPercent: parseInt(e.target.value) || 50,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Điểm tối thiểu để đổi</Label>
              <Input
                type="number"
                min={1}
                value={formData.minRedemptionPoints}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minRedemptionPoints: parseInt(e.target.value) || 100,
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 flex items-center gap-2">
              <Switch
                checked={formData.allowTierDowngrade}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allowTierDowngrade: checked })
                }
              />
              <Label>Cho phép giảm hạng khi điểm giảm</Label>
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Kích hoạt ngay</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Mô tả thay đổi trong phiên bản này..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang tạo...' : 'Tạo phiên bản'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
