import { queryClient } from "./queryClient";

// Posts cache key for temporarily storing last 50 posts per community
export const getPostsCacheKey = (communityId: string | number) => [`/api/communities/${communityId}/posts/cache`];

// Interface for cached community posts
export interface CachedPost {
  id: number;
  user_id: string;
  author_id: string;
  username: string;
  user_avatar?: string;
  content: string;
  post_type: 'meal_share' | 'discussion' | 'question' | 'announcement';
  meal_plan_id?: number;
  meal_title?: string;
  meal_image?: string;
  meal_plan?: any;
  images?: string[];
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  is_liked: boolean;
  created_at: string;
  author?: any;
  isCached: true;
}

// Get current posts cache for a community
export function getCommunityPostsCache(communityId: string | number): CachedPost[] {
  const cached = queryClient.getQueryData(getPostsCacheKey(communityId));
  return cached as CachedPost[] || [];
}

// Add posts to community cache (keeps last 50)
export function addToPostsCache(communityId: string | number, posts: any[]): CachedPost[] {
  const cachedPosts: CachedPost[] = posts.map(post => ({
    ...post,
    isCached: true,
  }));

  const currentCache = getCommunityPostsCache(communityId);
  
  // Merge new posts with existing cache, avoiding duplicates
  const existingIds = new Set(currentCache.map(p => p.id));
  const newPosts = cachedPosts.filter(p => !existingIds.has(p.id));
  
  const updatedCache = [...newPosts, ...currentCache];
  
  // Keep only last 50 posts to prevent memory bloat while ensuring good coverage
  const trimmedCache = updatedCache.slice(0, 50);

  queryClient.setQueryData(getPostsCacheKey(communityId), trimmedCache);
  
  console.log('📦 Posts Cache: Added', newPosts.length, 'new posts for community', communityId);
  console.log('📦 Posts Cache: Total cached posts:', trimmedCache.length);
  
  return trimmedCache;
}

// Update a specific post in cache (for likes, comments count changes)
export function updatePostInCache(communityId: string | number, postId: number, updates: Partial<CachedPost>): void {
  const currentCache = getCommunityPostsCache(communityId);
  const updatedCache = currentCache.map(post => 
    post.id === postId ? { ...post, ...updates } : post
  );
  
  queryClient.setQueryData(getPostsCacheKey(communityId), updatedCache);
  console.log('🔄 Posts Cache: Updated post', postId, 'in community', communityId);
}

// Remove a post from cache
export function removePostFromCache(communityId: string | number, postId: number): void {
  const currentCache = getCommunityPostsCache(communityId);
  const updatedCache = currentCache.filter(post => post.id !== postId);
  
  queryClient.setQueryData(getPostsCacheKey(communityId), updatedCache);
  console.log('🗑️ Posts Cache: Removed post', postId, 'from community', communityId);
}

// Clear posts cache for a community
export function clearCommunityPostsCache(communityId: string | number): void {
  queryClient.setQueryData(getPostsCacheKey(communityId), []);
  console.log('🧹 Posts Cache: Cleared all posts for community', communityId);
}

// Check if posts cache is fresh (less than 5 minutes old)
export function isPostsCacheFresh(communityId: string | number): boolean {
  const cacheData = queryClient.getQueryState(getPostsCacheKey(communityId));
  if (!cacheData?.dataUpdatedAt) return false;
  
  const cacheAge = Date.now() - cacheData.dataUpdatedAt;
  const maxAge = 5 * 60 * 1000; // 5 minutes - longer than meal plans for better persistence
  
  return cacheAge < maxAge;
}

// Initialize posts cache (call on app startup)
export function initializePostsCache(): void {
  // console.log('🔧 Posts Cache: Initialized');
}