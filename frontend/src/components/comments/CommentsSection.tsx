import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { MessageSquare, Trash2, Edit2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CommentImages } from './CommentImages';
import { ImageUploadButton, type UploadFile } from '../common/ImageUploadButton';
import { useUploadImages } from '@/hooks/useImages';

interface Comment {
  id: string;
  service_order_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
  user_profiles: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

interface CommentsSectionProps {
  serviceOrderId: string;
  currentUserId?: string;
}

export function CommentsSection({ serviceOrderId, currentUserId }: CommentsSectionProps) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
  }, [serviceOrderId]);

  // Upload images after comment is created
  useEffect(() => {
    const uploadPendingImages = async () => {
      if (pendingCommentId && pendingImages.length > 0) {
        try {
          await apiClient.images.upload('comment', pendingCommentId, pendingImages);
          toast.success(t('comments.addedSuccessfully'));
        } catch (error) {
          console.error('Error uploading images:', error);
          toast.error('Lỗi khi tải lên hình ảnh');
        } finally {
          setNewComment('');
          setPendingImages([]);
          setPendingCommentId(null);
          fetchComments();
        }
      }
    };

    uploadPendingImages();
  }, [pendingCommentId, pendingImages, t]);

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const data: any = await apiClient.comments.getByServiceOrder(serviceOrderId);
      setComments(data || []);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      toast.error(t('comments.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setIsSubmitting(true);
      const result: any = await apiClient.comments.create({
        service_order_id: serviceOrderId,
        comment_text: newComment.trim(),
      });

      // If there are pending images, store the comment ID to upload them
      if (pendingImages.length > 0 && result?.id) {
        setPendingCommentId(result.id);
      } else {
        setNewComment('');
        setPendingImages([]);
        toast.success(t('comments.addedSuccessfully'));
        fetchComments();
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(t('comments.failedToAdd'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle image selection for new comment
  const handleSelectImages = useCallback(async (files: File[]) => {
    setPendingImages(prev => [...prev, ...files]);
  }, []);

  // Remove a pending image
  const handleRemovePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.comment_text);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;

    try {
      await apiClient.comments.update(commentId, {
        comment_text: editText.trim(),
      });
      toast.success(t('comments.updatedSuccessfully'));
      setEditingId(null);
      setEditText('');
      fetchComments();
    } catch (error: any) {
      console.error('Error updating comment:', error);
      toast.error(t('comments.failedToUpdate'));
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t('comments.confirmDelete'))) return;

    try {
      await apiClient.comments.delete(commentId);
      toast.success(t('comments.deletedSuccessfully'));
      fetchComments();
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast.error(t('comments.failedToDelete'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('comments.justNow');
    if (diffMins < 60) return t('comments.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('comments.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('comments.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
          {t('comments.title')} ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add new comment */}
        <div className="space-y-3 mb-4 sm:mb-6">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('comments.placeholder')}
            className="min-h-[80px]"
            disabled={isSubmitting}
          />

          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingImages.map((file, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="h-20 w-20 object-cover rounded border"
                  />
                  <button
                    onClick={() => handleRemovePendingImage(index)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center gap-2">
            <ImageUploadButton
              onUpload={handleSelectImages}
              maxFiles={5}
              maxSizeMB={5}
              size="sm"
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || isSubmitting}
              className="w-auto"
            >
              {isSubmitting ? t('common.saving') : t('comments.addComment')}
            </Button>
          </div>
        </div>

        {/* Comments list */}
        <div className="space-y-3 sm:space-y-4">
          {isLoading ? (
            <div className="text-center py-6 sm:py-8 text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-sm text-muted-foreground">
              {t('comments.noComments')}
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3"
              >
                {/* Comment header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {comment.user_profiles.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate">
                        {comment.user_profiles.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(comment.created_at)}
                        {comment.updated_at !== comment.created_at && (
                          <span> • {t('comments.edited')}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons - only show for own comments */}
                  {currentUserId && comment.user_id === currentUserId && (
                    <div className="flex items-center gap-1 flex-shrink-0 self-start">
                      {editingId === comment.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleSaveEdit(comment.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleStartEdit(comment)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(comment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Comment content */}
                {editingId === comment.id ? (
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                ) : (
                  <>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">
                      {comment.comment_text}
                    </p>
                    {/* Comment Images */}
                    <CommentImages
                      commentId={comment.id}
                      isOwner={currentUserId === comment.user_id}
                    />
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
