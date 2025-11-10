import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { brandsApi, type Brand } from '@/lib/api/brands';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const brandFormSchema = z.object({
  name: z.string().min(1, 'Tên thương hiệu là bắt buộc'),
  country_of_origin: z.string().optional(),
  description: z.string().optional(),
});

type BrandFormData = z.infer<typeof brandFormSchema>;

interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: Brand;
}

export function BrandFormDialog({
  open,
  onOpenChange,
  brand,
}: BrandFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!brand;

  const form = useForm<BrandFormData>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      name: '',
      country_of_origin: '',
      description: '',
    },
  });

  // Reset form when brand changes
  useEffect(() => {
    if (brand) {
      form.reset({
        name: brand.name,
        country_of_origin: brand.country_of_origin || '',
        description: brand.description || '',
      });
    } else {
      form.reset({
        name: '',
        country_of_origin: '',
        description: '',
      });
    }
  }, [brand, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: brandsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Thêm thương hiệu thành công');
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast.error('Không thể thêm thương hiệu');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BrandFormData }) =>
      brandsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Cập nhật thương hiệu thành công');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Không thể cập nhật thương hiệu');
    },
  });

  const onSubmit = (data: BrandFormData) => {
    if (isEditing) {
      updateMutation.mutate({ id: brand.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>
            {isEditing ? 'Chỉnh sửa Thương hiệu' : 'Thêm Thương hiệu mới'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Cập nhật thông tin thương hiệu'
              : 'Nhập thông tin thương hiệu mới'}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên thương hiệu *</FormLabel>
                    <FormControl>
                      <Input placeholder="Honda, Yamaha, Suzuki..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country_of_origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quốc gia xuất xứ</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhật Bản, Trung Quốc..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Quốc gia nơi thương hiệu có nguồn gốc
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Thông tin về thương hiệu..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SheetFooter className="px-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Cập nhật' : 'Thêm mới'}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
