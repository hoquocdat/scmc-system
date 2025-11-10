import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { ServiceItem, ServiceStatus } from '../../types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { XCircle } from 'lucide-react';
import { PhotoGallery } from '@/components/common/PhotoGallery';
import { ImageUploadButton, type UploadFile } from '@/components/common/ImageUploadButton';
import { useEntityImages, useUploadImages, useDeleteImage } from '@/hooks/useImages';
import { EmptyPhoto } from '../common/EmptyPhoto';

interface ServiceItemFormProps {
  serviceOrderId: string;
  item?: ServiceItem | null;
  onClose: () => void;
}

interface FormData {
  name: string;
  description: string;
  status: ServiceStatus;
  labor_cost: string;
  hours_worked: string;
  assigned_employee_id: string;
}

const statusOptions: { value: ServiceStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_parts', label: 'Waiting Parts' },
  { value: 'waiting_approval', label: 'Waiting Approval' },
  { value: 'quality_check', label: 'Quality Check' },
  { value: 'completed', label: 'Completed' },
];

export function ServiceItemForm({ serviceOrderId, item, onClose }: ServiceItemFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    status: 'pending',
    labor_cost: '0',
    hours_worked: '0',
    assigned_employee_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // Files selected during creation

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response: any = await apiClient.users.getEmployees();
      return response || [];
    },
  });

  // Fetch images if editing existing item
  const { data: imageRecords } = useEntityImages('service_item', item?.id || '', !!item?.id);

  // Upload mutation
  const uploadMutation = useUploadImages('service_item', item?.id || '');

  // Delete mutation
  const deleteMutation = useDeleteImage('service_item', item?.id || '');

  // Extract image URLs
  const images = useMemo(() => {
    if (imageRecords && imageRecords.length > 0) {
      const sorted = [...imageRecords].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return sorted.map(img => img.public_url);
    }
    return [];
  }, [imageRecords]);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || '',
        status: item.status,
        labor_cost: item.labor_cost.toString(),
        hours_worked: item.hours_worked.toString(),
        assigned_employee_id: item.assigned_employee_id || '',
      });
    }
  }, [item]);

  // Handle file selection during creation (before task exists)
  const handlePendingFileSelect = useCallback((files: File[]) => {
    setPendingFiles(prev => [...prev, ...files]);
    toast.success(`Đã chọn ${files.length} hình ảnh. Hình ảnh sẽ được tải lên sau khi lưu công việc.`);
  }, []);

  // Remove pending file
  const handleRemovePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle file upload with progress tracking
  const handleUpload = useCallback(async (files: File[]) => {
    if (!item?.id) {
      // If creating new task, add to pending files
      handlePendingFileSelect(files);
      return;
    }

    // Create upload file objects with previews
    const newUploadFiles: UploadFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadingFiles(newUploadFiles);

    try {
      // Update status to uploading
      setUploadingFiles((prev) =>
        prev.map((uf) => ({ ...uf, status: 'uploading' as const }))
      );

      // Simulate progress
      for (let i = 0; i <= 90; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setUploadingFiles((prev) =>
          prev.map((uf) => ({ ...uf, progress: i }))
        );
      }

      // Actual upload
      await uploadMutation.mutateAsync(files);

      // Mark as success
      setUploadingFiles((prev) =>
        prev.map((uf) => ({ ...uf, status: 'success' as const, progress: 100 }))
      );

      // Clear after 2 seconds
      setTimeout(() => {
        setUploadingFiles([]);
      }, 2000);
    } catch (error) {
      // Mark as error
      setUploadingFiles((prev) =>
        prev.map((uf) => ({
          ...uf,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Upload failed',
        }))
      );
    }
  }, [item?.id, uploadMutation]);

  // Handle image deletion
  const handleDeleteImages = async (imageUrls: string[]) => {
    if (!imageRecords) return;

    // Find image IDs from URLs
    const imageIdsToDelete = imageRecords
      .filter(img => imageUrls.includes(img.public_url))
      .map(img => img.id);

    if (imageIdsToDelete.length === 0) {
      toast.error('Không tìm thấy hình ảnh để xóa');
      return;
    }

    // Delete each image
    for (const imageId of imageIdsToDelete) {
      await deleteMutation.mutateAsync(imageId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        service_order_id: serviceOrderId,
        name: formData.name,
        description: formData.description || null,
        status: formData.status,
        labor_cost: parseFloat(formData.labor_cost) || 0,
        hours_worked: parseFloat(formData.hours_worked) || 0,
        assigned_employee_id: formData.assigned_employee_id || null,
      };

      let taskId = item?.id;

      if (item) {
        // Update existing
        await apiClient.serviceItems.update(item.id, payload);
        toast.success('Task updated successfully');
      } else {
        // Create new
        const newTask: any = await apiClient.serviceItems.create(payload);
        taskId = newTask.id;
        toast.success('Task added successfully');

        // Upload pending images if any
        if (pendingFiles.length > 0 && taskId) {
          toast.info(`Đang tải lên ${pendingFiles.length} hình ảnh...`);
          try {
            // Upload images using API client
            const formData = new FormData();
            formData.append('entity_type', 'service_item');
            formData.append('entity_id', taskId);
            pendingFiles.forEach((file) => {
              formData.append('files', file);
            });

            await apiClient.images.upload(formData);
            toast.success('Hình ảnh đã được tải lên thành công');
          } catch (uploadError) {
            console.error('Error uploading images:', uploadError);
            toast.error('Không thể tải hình ảnh lên. Vui lòng thử lại sau.');
          }
        }
      }

      onClose();
    } catch (error) {
      console.error('Error saving service item:', error);
      toast.error('Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose} modal={true}>
      <SheetContent className="overflow-y-auto sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <SheetHeader className="px-6">
          <SheetTitle>{item ? 'Edit Task' : 'Add Task'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <Label htmlFor="name">Task Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Oil Change"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              className="min-h-[80px]"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the task details..."
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: ServiceStatus) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="assigned_employee">Assigned Employee</Label>
            <Select
              value={formData.assigned_employee_id || 'none'}
              onValueChange={(value: string) =>
                setFormData({ ...formData, assigned_employee_id: value === 'none' ? '' : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {employees.map((employee: any) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hours_worked">Hours</Label>
              <Input
                id="hours_worked"
                type="number"
                step="0.1"
                min="0"
                value={formData.hours_worked}
                onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="labor_cost">Labor ($)</Label>
              <Input
                id="labor_cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.labor_cost}
                onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
              />
            </div>
          </div>

          {/* Images Section */}
          <div className="space-y-3">
            <Label>Hình Ảnh</Label>

            {/* Show pending files preview when creating new task */}
            {!item?.id && pendingFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Đã chọn {pendingFiles.length} hình ảnh (sẽ tải lên sau khi lưu)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {pendingFiles.map((file, index) => (
                    <div key={index} className="relative aspect-square rounded border overflow-hidden group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePendingFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload button for new tasks or existing tasks with no images */}
            {(!item?.id || images.length === 0) && (
              <div className="flex justify-center">
                <ImageUploadButton onUpload={handleUpload} maxFiles={5} maxSizeMB={5} />
              </div>
            )}

            {/* Show existing images when editing */}
            {item?.id && images.length > 0 && (
              <PhotoGallery
                images={images}
                altPrefix={`Task ${item.name}`}
                uploadingFiles={uploadingFiles}
                onDeleteImages={handleDeleteImages}
                uploadButton={<ImageUploadButton onUpload={handleUpload} maxFiles={5} maxSizeMB={5} />}
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : item ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
