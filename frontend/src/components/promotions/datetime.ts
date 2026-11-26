/** `YYYY-MM-DDTHH:mm` in local time for datetime-local inputs. */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const fmt = (iso: string) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export function periodText(start: string | null, end: string | null) {
  if (!start && !end) return 'Không thời hạn';
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return start ? `Từ ${fmt(start)}` : `Đến ${fmt(end!)}`;
}

export function statusOf(x: { is_active: boolean; start_at: string | null; end_at: string | null }, now = new Date()) {
  if (!x.is_active) return { label: 'Ngừng', variant: 'outline' as const };
  if (x.start_at && new Date(x.start_at) > now) return { label: 'Sắp diễn ra', variant: 'secondary' as const };
  if (x.end_at && new Date(x.end_at) < now) return { label: 'Đã kết thúc', variant: 'outline' as const };
  return { label: 'Đang chạy', variant: 'default' as const };
}
