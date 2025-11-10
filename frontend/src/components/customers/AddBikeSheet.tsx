import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CreateBikeForm } from '@/components/forms/CreateBikeForm';

interface AddBikeSheetProps {
  ownerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddBikeSheet({ ownerId, isOpen, onClose, onSuccess }: AddBikeSheetProps) {
  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Tạo Xe Mới</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <CreateBikeForm
            ownerId={ownerId}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
