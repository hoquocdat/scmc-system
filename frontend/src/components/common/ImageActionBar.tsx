import { Button } from '@/components/ui/button';
import { CheckCircle2, Download as DownloadIcon, Trash2 } from 'lucide-react';

interface ImageActionBarProps {
  isSelectMode: boolean;
  selectedCount: number;
  onSelectMode: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onDelete: () => void;
  uploadButton: React.ReactNode;
}

export function ImageActionBar({
  isSelectMode,
  selectedCount,
  onSelectMode,
  onCancel,
  onDownload,
  onDelete,
  uploadButton
}: ImageActionBarProps) {
  return (
    <div className="flex justify-end items-center gap-2">
      {!isSelectMode ? (
        <Button
          type="button"
          variant="outline"
          onClick={onSelectMode}
          className="sm:w-auto gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Select
        </Button>
      ) : (
        <>
          <span className="text-sm font-medium text-gray-700">
            {selectedCount} selected
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="sm:w-auto gap-2"
          >
            Cancel
          </Button>
          {selectedCount > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onDownload}
                className="sm:w-auto gap-2"
              >
                <DownloadIcon className="h-4 w-4" />
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                className="sm:w-auto gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </>
      )}
      {uploadButton}
    </div>
  );
}
