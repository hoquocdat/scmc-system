import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { periodText, statusOf } from '@/components/promotions/datetime';
import { CampaignFormSheet } from '@/components/vouchers/CampaignFormSheet';
import { GenerateCodesDialog } from '@/components/vouchers/GenerateCodesDialog';
import { promotionError } from '@/lib/api/promotions';
import { saveBlob } from '@/lib/api/reports';
import { vouchersApi } from '@/lib/api/vouchers';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { campaignValue } from '@/components/vouchers/campaign-format';

const PAGE = 100;

/** One voucher campaign: settings, usage, codes with generate, search, export. */
export function VoucherCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'used' | 'unused'>('all');
  const [page, setPage] = useState(1);
  const { data: c, isLoading } = useQuery({ queryKey: ['vouchers', id], queryFn: () => vouchersApi.get(id!), enabled: !!id });
  const { data: codes } = useQuery({
    queryKey: ['vouchers', id, 'codes', search, status, page],
    queryFn: () => vouchersApi.codes(id!, { search: search || undefined, status, page, pageSize: PAGE }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
  const onError = (e: unknown) => toast.error(promotionError(e).message);
  const exportCsv = useMutation({ mutationFn: () => vouchersApi.export(id!), onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName), onError });
  const setActive = useMutation({ mutationFn: (v: { codeId: string; on: boolean }) => vouchersApi.setCodeActive(id!, v.codeId, v.on), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['vouchers', id] }), onError });
  const remove = useMutation({ mutationFn: () => vouchersApi.remove(id!), onSuccess: () => { toast.success('Đã xóa'); void queryClient.invalidateQueries({ queryKey: ['vouchers'] }); navigate('/inventory/vouchers'); }, onError });

  if (isLoading || !c) return <Skeleton className="h-64 w-full" />;
  const st = statusOf(c);
  const pages = Math.max(1, Math.ceil((codes?.pagination.total ?? 0) / PAGE));
  const facts: [string, string][] = [
    ['Giá trị', campaignValue(c)],
    ['Đơn tối thiểu', c.min_order_amount ? formatCurrency(c.min_order_amount) : 'Không'],
    ['Thời gian', periodText(c.start_at, c.end_at)],
    ['Giới hạn', `${c.uses_per_code} lượt/mã${c.uses_per_customer ? ` · ${c.uses_per_customer} lượt/khách` : ''}`],
    ['Áp dụng', `${c.all_stores ? 'Mọi chi nhánh' : c.stores.map((s) => s.name).join(', ')}${c.combinable_with_promotions ? '' : ' · không dùng chung khuyến mãi'}`],
    ['Sử dụng', `${c.stats.used_codes}/${c.stats.codes} mã · ${c.stats.uses} lượt · giảm ${formatCurrency(c.stats.discount)}`],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Về danh sách"><Link to="/inventory/vouchers"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div><h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">{c.name} <Badge variant={st.variant}>{st.label}</Badge></h1><p className="font-mono text-sm text-muted-foreground">{c.code}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('vouchers', 'create') && <Button onClick={() => setGenOpen(true)}><Plus className="h-4 w-4" /> Tạo mã</Button>}
          <Button variant="outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}><Download className="h-4 w-4" /> Xuất CSV</Button>
          {can('vouchers', 'update') && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Sửa</Button>}
          {can('vouchers', 'delete') && c.stats.uses === 0 && <Button variant="ghost" size="icon" aria-label="Xóa chương trình" onClick={() => remove.mutate()}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
      <Card><CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">{facts.map(([k, v]) => <div key={k}><div className="text-xs text-muted-foreground">{k}</div><div className="text-sm font-medium">{v}</div></div>)}</CardContent></Card>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Tìm mã" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tất cả mã</SelectItem><SelectItem value="used">Đã dùng</SelectItem><SelectItem value="unused">Chưa dùng</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Mã</TableHead><TableHead className="text-right">Đã dùng</TableHead><TableHead>Tạo lúc</TableHead><TableHead>Dùng được</TableHead></TableRow></TableHeader>
          <TableBody>
            {codes?.data.length === 0 && <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">Chưa có mã</TableCell></TableRow>}
            {codes?.data.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono">{v.code}</TableCell>
                <TableCell className="text-right tabular-nums">{v.used_count} / {c.uses_per_code}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(v.created_at)}</TableCell>
                <TableCell><Switch checked={v.is_active} disabled={!can('vouchers', 'update') || setActive.isPending} aria-label="Dùng được" onCheckedChange={(on) => setActive.mutate({ codeId: v.id, on })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{(codes?.pagination.total ?? 0).toLocaleString('vi-VN')} mã · trang {page}/{pages}</span>
        <Pagination className="mx-0 w-auto"><PaginationContent>
          <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} /></PaginationItem>
          <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < pages) setPage(page + 1); }} /></PaginationItem>
        </PaginationContent></Pagination>
      </div>
      <CampaignFormSheet open={editOpen} onOpenChange={setEditOpen} campaign={c} />
      <GenerateCodesDialog open={genOpen} onOpenChange={setGenOpen} campaignId={c.id} defaultPrefix={c.code} />
    </div>
  );
}
