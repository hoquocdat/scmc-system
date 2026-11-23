import { useAuthStore } from '@/store/authStore';
import { PosShiftGate } from '@/components/pos/PosShiftGate';
import { PosTerminal } from '@/components/pos/PosTerminal';

/** /pos: the terminal is available only inside the cashier's open shift. */
export function POSPage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <PosShiftGate userId={user.id}>
      {(shift) => <PosTerminal key={shift.id} shift={shift} userId={user.id} />}
    </PosShiftGate>
  );
}
