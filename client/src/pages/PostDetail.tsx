import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, Pin, ThumbsUp, Share2, MoreHorizontal, Bell, Trash2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CommentsSection } from "@/components/CommentsSection";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RecipeDisplay from "@/components/RecipeDisplay";

interface CommunityPost {
  id: number;
  user_id: string;
  author_id: string; // Add author_id for checking post ownership
  username: string;
  user_avatar?: string;
  content: string;
  post_type: 'meal_share' | 'discussion' | 'question' | 'announcement';
  meal_plan_id?: number;
  meal_title?: string;
  meal_image?: string;
  meal_plan?: any; // Full meal plan data for meal_share posts
  images?: string[];
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  is_liked: boolean;
  created_at: string;
}

interface Community {
  id: number;
  name: string;
  description: string;
  creator_id: string;
  member_count: number;
  category: string;
  is_public: boolean;
  created_at: string;
  cover_image?: string;
}

export default function PostDetail() {
  const { communityId, postId } = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);

  // Fetch community details
  const { data: community } = useQuery({
    queryKey: ["/api/communities", communityId],
    queryFn: () => apiRequest(`/api/communities/${communityId}`),
    enabled: !!communityId && isAuthenticated,
  });

  // Fetch specific post details
  const { data: post, isLoading } = useQuery({
    queryKey: [`/api/communities/${communityId}/posts`, postId],
    queryFn: async () => {
      const posts = await apiRequest(`/api/communities/${communityId}/posts`);
      return posts.find((p: CommunityPost) => p.id === parseInt(postId!));
    },
    enabled: !!communityId && !!postId && isAuthenticated,
  });

  const getPostTypeBadge = (type: string) => {
    const badges = {
      meal_share: <Badge className="bg-green-600 text-white">Meal Share</Badge>,
      discussion: <Badge className="bg-blue-600 text-white">Discussion</Badge>,
      question: <Badge className="bg-yellow-600 text-white">Question</Badge>,
      announcement: <Badge className="bg-purple-600 text-white">Announcement</Badge>,
    };
    return badges[type as keyof typeof badges] || badges.discussion;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const handleBackNavigation = () => {
    setLocation(`/community/${communityId}`);
  };

  // Check if user is the creator of the community
  const isCreator = community?.creator_id === (user as any)?.user?.id || community?.creator_id === (user as any)?.id;

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      console.log('🔍 Deleting post:', postId, 'from community:', communityId);
      return apiRequest(`/api/communities/${communityId}/posts/${postId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      // Invalidate queries and navigate back to community
      queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/posts`] });
      
      // Navigate back to community feed
      setLocation(`/community/${communityId}`);
      
      // Close the dialog and reset state
      setShowDeleteDialog(false);
      setPostToDelete(null);
      
      toast({
        title: "Post Deleted",
        description: "The post has been removed from the community.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle delete post confirmation
  const handleDeletePost = (postId: number) => {
    setPostToDelete(postId);
    setShowDeleteDialog(true);
  };

  const confirmDeletePost = () => {
    if (postToDelete) {
      deletePostMutation.mutate(postToDelete);
    }
  };

  if (isLoading || !post) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-[100] overflow-y-auto">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-[101]">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackNavigation}
              className="text-gray-400 hover:text-white p-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            {community && (
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8 bg-purple-600">
                  <AvatarFallback className="bg-purple-600 text-white text-sm">
                    {community.name[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white font-medium">{community.name}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-gray-400 p-1">
              <Bell className="w-5 h-5" />
            </Button>
            {/* Creator-only dropdown menu */}
            {isCreator ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-700" align="end">
                  <DropdownMenuItem
                    className="text-red-400 hover:text-red-300 hover:bg-gray-700 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePost(post.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" className="text-gray-400 p-1">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Post Content */}
      <div className="p-4">
        <Card className="bg-gray-800 border-gray-700 mb-4">
          <CardContent className="p-4">
            {/* Post Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-emerald-500 text-white font-semibold">
                    {post.username[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white">{post.username}</h3>
                    {getPostTypeBadge(post.post_type)}
                  </div>
                  <p className="text-sm text-gray-400">{formatDate(post.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {post.is_pinned && <Pin className="w-4 h-4 text-purple-400" />}
              </div>
            </div>

            {/* Post Title (for discussions/questions) */}
            {(post.post_type === 'discussion' || post.post_type === 'question') && (
              <h1 className="text-xl font-semibold text-white mb-4">
                {post.content.split('\n')[0]}
              </h1>
            )}

            {/* Post Content */}
            <div className="mb-4">
              {/* Show tabs for meal_share posts, regular content for others */}
              {post.post_type === 'meal_share' ? (
                <Tabs defaultValue="message" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-600">
                    <TabsTrigger value="message" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">Message</TabsTrigger>
                    <TabsTrigger value="meal" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">Meal</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="message" className="p-4">
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </TabsContent>
                  
                  <TabsContent value="meal" className="p-4">
                    {post.meal_plan ? (
                      <RecipeDisplay
                        recipe={(() => {
                          // Extract the first recipe from the meal plan
                          const mealPlan = post.meal_plan?.meal_plan;
                          const firstDay = mealPlan?.day_1 || mealPlan?.days?.day1;
                          const firstMeal = firstDay?.breakfast || firstDay?.lunch || firstDay?.dinner;
                          
                          if (!firstMeal) {
                            return {
                              id: post.meal_plan?.id,
                              title: post.meal_plan?.name || 'Shared Recipe',
                              description: post.meal_plan?.description || '',
                              image_url: '/api/placeholder/400/300',
                              ingredients: [],
                              instructions: [],
                              time_minutes: 30,
                              cuisine: '',
                              diet: ''
                            };
                          }
                          
                          return {
                            id: post.meal_plan?.id,
                            title: firstMeal.name || post.meal_plan?.name || 'Shared Recipe',
                            description: firstMeal.description || post.meal_plan?.description || '',
                            image_url: firstMeal.image_url || '/api/placeholder/400/300',
                            ingredients: firstMeal.ingredients || [],
                            instructions: firstMeal.instructions || [],
                            nutrition_info: firstMeal.nutrition || null,
                            time_minutes: firstMeal.prep_time || 30,
                            cuisine: firstMeal.cuisine || '',
                            diet: firstMeal.diet || '',
                            video_id: firstMeal.video_id || null,
                            video_title: firstMeal.video_title || null,
                            video_channel: firstMeal.video_channel || null
                          };
                        })()}
                        onRegenerateClick={() => {}}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-400">Meal details coming soon...</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <>
                  <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {post.post_type === 'discussion' || post.post_type === 'question' 
                      ? post.content.split('\n').slice(1).join('\n')
                      : post.content
                    }
                  </p>
                  
                  {/* Post Images */}
                  {post.images && post.images.length > 0 && (
                    <div className={`grid gap-3 mt-4 ${
                      post.images.length === 1 ? 'grid-cols-1' :
                      post.images.length === 2 ? 'grid-cols-2' :
                      'grid-cols-2'
                    }`}>
                      {post.images.map((imageUrl: string, index: number) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Post image ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg bg-gray-700"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Post Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div className="flex items-center gap-6">
                {/* Only show like button for other users' posts */}
                {user?.id !== post.author_id ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`text-gray-400 hover:text-white p-1 ${
                      post.is_liked ? 'text-purple-400' : ''
                    }`}
                  >
                    <ThumbsUp className="w-5 h-5 mr-2" />
                    <span className="text-sm">Like</span>
                    <span className="ml-1 text-sm">{post.likes_count}</span>
                  </Button>
                ) : (
                  // Show likes count only for own posts (if > 0)
                  post.likes_count > 0 && (
                    <div className="text-gray-400 text-sm flex items-center">
                      <ThumbsUp className="w-5 h-5 mr-2" />
                      <span className="text-sm">{post.likes_count} likes</span>
                    </div>
                  )
                )}
                
                <span className="text-gray-400 text-sm">
                  {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
                </span>
              </div>
              
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white p-1">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <CommentsSection
          postId={post.id}
          communityId={parseInt(communityId!)}
          commentsCount={post.comments_count}
          isExpanded={true}
          onToggle={() => {}} // Not needed in detail view
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-800 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Post</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-gray-700 text-white hover:bg-gray-600"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeletePost}
              disabled={deletePostMutation.isPending}
            >
              {deletePostMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
