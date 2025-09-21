import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUploader } from '@/components/ImageUploader';
// Advanced composer overlay is used for main post composer, not here
import ImageLightbox from '@/components/ImageLightbox';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, ThumbsUp, Reply, Send, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Comment {
  id: number;
  post_id: number;
  author_id: string;
  content: string;
  parent_id?: number;
  images?: string[];
  likes: number;
  isLiked?: boolean;
  created_at: string;
  updated_at: string;
  author: {
    firstName: string | null;
    lastName: string | null;
  };
  children?: Comment[];
}

interface CommentsSectionProps {
  postId: number;
  communityId: number;
  commentsCount?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function CommentItem({ comment, communityId, onReply, onImageClick }: { 
  comment: Comment; 
  communityId: number; 
  onReply: (commentId: number) => void;
  onImageClick: (comment: Comment, imageUrl: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const hasReplies = comment.children && comment.children.length > 0;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Check if current user is the comment author
  const isOwnComment = (user as any)?.id === comment.author_id;

  const commentLikeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/communities/${communityId}/posts/${comment.post_id}/comments/${comment.id}/like`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      // Update the comment in cache optimistically
      queryClient.setQueryData([`/api/communities/${communityId}/posts/${comment.post_id}/comments`], (oldComments: Comment[] | undefined) => {
        if (!oldComments) return oldComments;
        
        const updateComment = (comments: Comment[]): Comment[] => {
          return comments.map((c) => {
            if (c.id === comment.id) {
              return {
                ...c,
                likes: data.likesCount,
                isLiked: data.liked,
              };
            }
            // Update nested children recursively
            if (c.children) {
              return {
                ...c,
                children: updateComment(c.children),
              };
            }
            return c;
          });
        };
        
        return updateComment(oldComments);
      });
    },
    onError: (error) => {
      console.error('Failed to toggle comment like:', error);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="text-sm bg-gradient-to-br from-purple-500 to-emerald-500 text-white font-semibold">
            {comment.author?.firstName?.[0] || (comment.author as any)?.full_name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-white text-sm">
                {comment.author?.firstName || (comment.author as any)?.full_name || 'Unknown User'}
              </span>
              <span className="text-gray-400 text-xs">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
            
            <p className="text-white text-sm leading-relaxed mb-2">
              {comment.content}
            </p>
            
            {/* Comment Images */}
            {comment.images && comment.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {comment.images.map((image, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onImageClick(comment, image)}
                    className="block text-left"
                  >
                    <img
                      src={image}
                      alt={`Comment image ${index + 1}`}
                      className="rounded-lg w-full h-24 object-cover cursor-zoom-in"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Comment Actions */}
          <div className="flex items-center gap-4 mt-2 px-1">
            {/* Only show like button for comments not made by current user */}
            {!isOwnComment && (
              <Button
                variant="ghost"
                size="sm"
                className={`p-1 h-auto transition-colors ${
                  comment.isLiked 
                    ? 'text-purple-400 hover:text-purple-300' 
                    : 'text-gray-400 hover:text-purple-400'
                }`}
                onClick={() => commentLikeMutation.mutate()}
                disabled={commentLikeMutation.isPending}
              >
                <ThumbsUp 
                  className={`w-4 h-4 mr-1 ${comment.isLiked ? 'fill-current' : ''}`}
                />
                <span className="text-xs">{comment.likes}</span>
              </Button>
            )}
            
            {/* Show likes count without button for own comments */}
            {isOwnComment && comment.likes > 0 && (
              <div className="flex items-center text-gray-400 p-1">
                <ThumbsUp className="w-4 h-4 mr-1" />
                <span className="text-xs">{comment.likes}</span>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-blue-400 p-1 h-auto"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="w-4 h-4 mr-1" />
              <span className="text-xs">Reply</span>
            </Button>
            
            {hasReplies && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white p-1 h-auto"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? (
                  <ChevronUp className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 mr-1" />
                )}
                <span className="text-xs">
                  {comment.children?.length} {comment.children?.length === 1 ? 'reply' : 'replies'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Nested Replies */}
      {hasReplies && showReplies && (
        <div className="ml-8 space-y-3 border-l border-gray-700 pl-4">
          {comment.children?.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              communityId={communityId}
              onReply={onReply}
              onImageClick={onImageClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentForm({ 
  postId, 
  communityId, 
  parentId, 
  onSuccess, 
  onCancel,
  placeholder = "Write a comment..."
}: {
  postId: number;
  communityId: number;
  parentId?: number;
  onSuccess: () => void;
  onCancel?: () => void;
  placeholder?: string;
}) {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const createCommentMutation = useMutation({
    mutationFn: async (data: { content: string; parent_id?: number; images?: string[] }) => {
      return apiRequest(`/api/communities/${communityId}/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/communities/${communityId}/posts/${postId}/comments`] 
      });
      setContent('');
      setImages([]);
      onSuccess();
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) return;

    createCommentMutation.mutate({
      content: content.trim(),
      parent_id: parentId,
      images: images.length > 0 ? images : undefined,
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg px-3 py-4 space-y-3">
      <Textarea
        placeholder={placeholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none min-h-[80px]"
      />
      
      <div className="flex items-center justify-between">
        <ImageUploader 
          onImagesChange={setImages}
          maxImages={2}
        />
        
        <div className="flex gap-2">
          {onCancel && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              className="text-gray-400"
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || createCommentMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {createCommentMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                {parentId ? 'Reply' : 'Comment'}
              </>
            )}
          </Button>
        </div>
      </div>

    </div>
  );
}

export function CommentsSection({ 
  postId, 
  communityId, 
  commentsCount = 0, 
  isExpanded = false, 
  onToggle 
}: CommentsSectionProps) {
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxComment, setLightboxComment] = useState<Comment | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: [`/api/communities/${communityId}/posts/${postId}/comments`],
    queryFn: () => apiRequest(`/api/communities/${communityId}/posts/${postId}/comments?nested=true`),
    enabled: isExpanded,
  });

  const handleReply = (commentId: number) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
  };

  const handleImageClick = (comment: Comment, imageUrl: string) => {
    setLightboxComment(comment);
    setLightboxSrc(imageUrl);
    setLightboxOpen(true);
  };

  if (!isExpanded) {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-gray-400 hover:text-white p-2 h-auto w-full justify-start"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">Add a comment</span>
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700 mt-4">
      <CardContent className="p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">
              {commentsCount === 0 ? 'Comments' : `${commentsCount} ${commentsCount === 1 ? 'Comment' : 'Comments'}`}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-gray-400 hover:text-white p-1"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>

          {/* Comment Form */}
          <CommentForm
            postId={postId}
            communityId={communityId}
            onSuccess={() => {}}
          />

          {/* Comments List */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment: Comment) => (
                <div key={comment.id}>
                  <CommentItem
                    comment={comment}
                    communityId={communityId}
                    onReply={handleReply}
                    onImageClick={handleImageClick}
                  />
                  
                  {/* Reply Form */}
                  {replyingTo === comment.id && (
                    <div className="ml-8 mt-3">
                      <CommentForm
                        postId={postId}
                        communityId={communityId}
                        parentId={comment.id}
                        placeholder={`Reply to ${comment.author.firstName || 'this comment'}...`}
                        onSuccess={() => setReplyingTo(null)}
                        onCancel={() => setReplyingTo(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      {/* Messaging-style overlay for comment images */}
      <ImageLightbox
        src={lightboxSrc || ''}
        alt={lightboxSrc || undefined}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={lightboxComment ? `${(lightboxComment.author as any)?.full_name || lightboxComment.author?.firstName || 'User'} — ${new Date(lightboxComment.created_at).toLocaleString()}` : undefined}
      >
        {lightboxComment && (
          <CommentForm
            postId={postId}
            communityId={communityId}
            parentId={lightboxComment.id}
            placeholder="Write a comment..."
            onSuccess={() => setLightboxOpen(false)}
          />
        )}
      </ImageLightbox>
    </Card>
  );
}
