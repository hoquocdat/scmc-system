import { useEffect } from 'react';

export interface PosShortcutHandlers {
  focusSearch: () => void;
  openCustomer: () => void;
  openPayment: () => void;
  completePayment: () => void;
  newTab: () => void;
  switchTab: (index: number) => void;
  showHelp: () => void;
  openReturn: () => void;
}

/** One place for every POS key binding; shown to the user by ShortcutsHelp. */
export const POS_SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'F2', label: 'Tìm sản phẩm / quét mã' },
  { keys: 'F4', label: 'Chọn khách hàng' },
  { keys: 'F7', label: 'Trả hàng / đổi hàng' },
  { keys: 'F9', label: 'Thanh toán' },
  { keys: 'Ctrl + Enter', label: 'Hoàn tất thanh toán' },
  { keys: 'Ctrl + T', label: 'Đơn mới (tab)' },
  { keys: 'Ctrl + 1…9', label: 'Chuyển tab' },
  { keys: 'F1', label: 'Phím tắt' },
];

export function usePosShortcuts(handlers: PosShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); handlers.focusSearch(); return; }
      if (e.key === 'F4') { e.preventDefault(); handlers.openCustomer(); return; }
      if (e.key === 'F7') { e.preventDefault(); handlers.openReturn(); return; }
      if (e.key === 'F9') { e.preventDefault(); handlers.openPayment(); return; }
      if (e.key === 'F1') { e.preventDefault(); handlers.showHelp(); return; }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handlers.completePayment(); return; }
      if (e.ctrlKey && (e.key === 't' || e.key === 'T')) { e.preventDefault(); handlers.newTab(); return; }
      if (e.ctrlKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); handlers.switchTab(Number(e.key) - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers, enabled]);
}
