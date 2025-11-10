import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { productCategoriesApi } from '@/lib/api/product-categories';
import { toast } from 'sonner';

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

export function ProductCategoryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Fetch all categories for parent selection
  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: productCategoriesApi.getAll,
  });

  // Fetch category details if editing
  const { data: category, isLoading: isCategoryLoading } = useQuery({
    queryKey: ['product-category', id],
    queryFn: () => productCategoriesApi.getOne(id!),
    enabled: isEditing,
  });

  // Filter out current category and its descendants from parent options
  const parentOptions = categories.filter((c) => {
    if (!isEditing) return true;
    return c.id !== id && c.parent_id !== id;
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

  // Reset form when category data is loaded
  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        parent_id: category.parent_id || undefined,
        display_order: category.display_order || 0,
      });
    }
  }, [category, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: productCategoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Tạo danh mục thành công');
      navigate('/inventory/categories');
    },
    onError: () => {
      toast.error('Không thể tạo danh mục');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryFormData }) =>
      productCategoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      queryClient.invalidateQueries({ queryKey: ['product-category', id] });
      toast.success('Cập nhật danh mục thành công');
      navigate('/inventory/categories');
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
      updateMutation.mutate({ id: id!, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isCategoryLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/inventory/categories')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại danh sách
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {isEditing ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới'}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isEditing
              ? 'Cập nhật thông tin danh mục sản phẩm'
              : 'Nhập thông tin danh mục sản phẩm mới'}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin danh mục</CardTitle>
          <CardDescription>
            Điền các thông tin bên dưới để {isEditing ? 'cập nhật' : 'tạo'} danh mục
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
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
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="parent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Danh mục cha</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)}
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn danh mục cha (nếu có)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Không có</SelectItem>
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
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Thứ tự sắp xếp (số nhỏ sẽ hiển thị trước)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Mô tả về danh mục..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/inventory/categories')}
                  disabled={isLoading}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Cập nhật' : 'Tạo danh mục'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
