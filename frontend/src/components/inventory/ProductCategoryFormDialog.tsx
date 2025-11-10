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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { productCategoriesApi, type ProductCategory } from '@/lib/api/product-categories';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const categoryFormSchema = z.object({
  name: z.string().min(1, 'Tên danh mục là bắt buộc'),
  slug: z
    .string()
    .min(1, 'Slug là bắt buộc')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ chứa chữ thường, số và dấu gạch ngang'),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  display_order: z.number().int().min(0).optional(),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface ProductCategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: ProductCategory;
  categories: ProductCategory[];
}

export function ProductCategoryFormDialog({
  open,
  onOpenChange,
  category,
  categories,
}: ProductCategoryFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!category;

  // Filter out the current category and its descendants from parent options
  const parentOptions = categories.filter((c) => {
    if (!isEditing) return true;
    return c.id !== category?.id && c.parent_id !== category?.id;
  });

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      parent_id: undefined,
      display_order: 0,
    },
  });

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName) {
      const slug = watchName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      form.setValue('slug', slug);
    }
  }, [watchName, isEditing, form]);

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        parent_id: category.parent_id || undefined,
        display_order: category.display_order || 0,
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        description: '',
        parent_id: undefined,
        display_order: 0,
      });
    }
  }, [category, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: productCategoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Thêm danh mục thành công');
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast.error('Không thể thêm danh mục');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryFormData }) =>
      productCategoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Cập nhật danh mục thành công');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Không thể cập nhật danh mục');
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    // Clean up empty parent_id
    const submitData = {
      ...data,
      parent_id: data.parent_id || undefined,
    };

    if (isEditing) {
      updateMutation.mutate({ id: category.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>
            {isEditing ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục mới'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Cập nhật thông tin danh mục sản phẩm'
              : 'Nhập thông tin danh mục sản phẩm mới'}
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
                  <FormLabel>Tên danh mục *</FormLabel>
                  <FormControl>
                    <Input placeholder="Phụ tùng động cơ, Đèn xe..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl>
                    <Input placeholder="phu-tung-dong-co" {...field} />
                  </FormControl>
                  <FormDescription>
                    URL-friendly identifier (tự động tạo từ tên)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Danh mục cha</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn danh mục cha (nếu có)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parentOptions.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Để tạo danh mục con trong danh mục khác
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="display_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thứ tự hiển thị</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormDescription>
                    Thứ tự sắp xếp (số nhỏ sẽ hiển thị trước)
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
                      placeholder="Mô tả về danh mục..."
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
