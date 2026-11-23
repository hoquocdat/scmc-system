import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { POS_SHORTCUTS } from '@/hooks/usePosShortcuts';

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Phím tắt</DialogTitle>
        </DialogHeader>
        <Table>
          <TableBody>
            {POS_SHORTCUTS.map((s) => (
              <TableRow key={s.keys}>
                <TableCell className="py-1.5">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{s.keys}</kbd>
                </TableCell>
                <TableCell className="py-1.5">{s.label}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
