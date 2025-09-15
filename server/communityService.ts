import { db } from "./db";
import { 
  communities, 
  communityMembers, 
  sharedMealPlans, 
  mealPlanReviews,
  mealPlanRemixes,
  communityDiscussions,
  communityPosts,
  communityPostComments,
  communityPostLikes,
  communityCommentLikes,
  creatorProfiles,
  creatorFollowers,
  users,
  mealPlans,
  type Community,
  type CommunityMember,
  type SharedMealPlan,
  type MealPlanReview,
  type CommunityPost,
  type CommunityPostComment,
  type InsertCommunity,
  type InsertCommunityMember,
  type InsertSharedMealPlan,
  type InsertMealPlanReview,
  type InsertCommunityPost,
  type InsertCommunityPostComment,
  type InsertCommunityPostLike,
} from "@shared/schema";
import { eq, and, desc, sql, gte, isNull, inArray } from "drizzle-orm";

export class CommunityService {
  // Create a new community
  async createCommunity(userId: string, data: Omit<InsertCommunity, 'creator_id'>): Promise<Community> {
    const [community] = await db.insert(communities).values({
      ...data,
      creator_id: userId,
      member_count: 1,
    }).returning();

    // Automatically add creator as a member with creator role
    await db.insert(communityMembers).values({
      community_id: community.id,
      user_id: userId,
      role: "creator",
      points: 0,
      level: 1,
    });

    return community;
  }

  // Get all communities with optional filtering
  async getCommunities(category?: string, userId?: string) {
    let whereConditions = [];
    
    if (category) {
      whereConditions.push(eq(communities.category, category));
    }

    const allCommunities = await db.select()
      .from(communities)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(communities.member_count));

    // If userId provided, mark which communities the user is a member of
    if (userId) {
      const userMemberships = await db.select()
        .from(communityMembers)
        .where(eq(communityMembers.user_id, userId));
      
      const membershipMap = new Set(userMemberships.map(m => m.community_id));
      
      return allCommunities.map(community => ({
        ...community,
        isMember: membershipMap.has(community.id),
      }));
    }

    return allCommunities;
  }

  // Get community details with member info
  async getCommunityDetails(communityId: number, userId?: string) {
    const [community] = await db.select()
      .from(communities)
      .where(eq(communities.id, communityId));

    if (!community) {
      throw new Error("Community not found");
    }

    // Get member info if userId provided
    let memberInfo = null;
    if (userId) {
      const [member] = await db.select()
        .from(communityMembers)
        .where(and(
          eq(communityMembers.community_id, communityId),
          eq(communityMembers.user_id, userId)
        ));
      memberInfo = member;
    }

    // Get top contributors
    const topContributors = await db.select()
      .from(communityMembers)
      .where(eq(communityMembers.community_id, communityId))
      .orderBy(desc(communityMembers.points))
      .limit(10);

    return {
      ...community,
      memberInfo,
      topContributors,
    };
  }

  // Join a community
  async joinCommunity(userId: string, communityId: number): Promise<CommunityMember> {
    // Check if already a member
    const existing = await db.select()
      .from(communityMembers)
      .where(and(
        eq(communityMembers.community_id, communityId),
        eq(communityMembers.user_id, userId)
      ));

    if (existing.length > 0) {
      throw new Error("Already a member of this community");
    }

    // Add member
    const [member] = await db.insert(communityMembers).values({
      community_id: communityId,
      user_id: userId,
      role: "member",
      points: 0,
      level: 1,
    }).returning();

    // Update member count
    await db.update(communities)
      .set({ 
        member_count: sql`${communities.member_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(communities.id, communityId));

    return member;
  }

  // Leave a community
  async leaveCommunity(userId: string, communityId: number): Promise<void> {
    // Check if member and not creator
    const [member] = await db.select()
      .from(communityMembers)
      .where(and(
        eq(communityMembers.community_id, communityId),
        eq(communityMembers.user_id, userId)
      ));

    if (!member) {
      throw new Error("Not a member of this community");
    }

    if (member.role === "creator") {
      throw new Error("Creator cannot leave their own community");
    }

    // Remove member
    await db.delete(communityMembers)
      .where(and(
        eq(communityMembers.community_id, communityId),
        eq(communityMembers.user_id, userId)
      ));

    // Update member count
    await db.update(communities)
      .set({ 
        member_count: sql`${communities.member_count} - 1`,
        updated_at: new Date(),
      })
      .where(eq(communities.id, communityId));
  }

  // Share a meal plan to community
  async shareMealPlan(
    userId: string, 
    communityId: number, 
    mealPlanId: number,
    data: Omit<InsertSharedMealPlan, 'community_id' | 'meal_plan_id' | 'sharer_id'>
  ): Promise<SharedMealPlan> {
    // Verify user is a member
    const member = await this.verifyMembership(userId, communityId);

    // Share the meal plan
    const [sharedPlan] = await db.insert(sharedMealPlans).values({
      ...data,
      community_id: communityId,
      meal_plan_id: mealPlanId,
      sharer_id: userId,
    }).returning();

    // Award points for sharing
    await this.awardPoints(userId, communityId, 25, "shared_meal_plan");

    return sharedPlan;
  }

  // Get shared meal plans for a community
  async getCommunityMealPlans(communityId: number, filter?: {
    featured?: boolean;
    minRating?: number;
    tags?: string[];
  }) {
    let whereConditions = [eq(sharedMealPlans.community_id, communityId)];

    if (filter?.featured) {
      whereConditions.push(eq(sharedMealPlans.is_featured, true));
    }

    const plans = await db.select()
      .from(sharedMealPlans)
      .where(and(...whereConditions))
      .orderBy(desc(sharedMealPlans.created_at));

    // Filter by tags if provided
    if (filter?.tags && filter.tags.length > 0) {
      return plans.filter(plan => {
        const planTags = plan.tags as string[];
        return filter.tags!.some(tag => planTags.includes(tag));
      });
    }

    return plans;
  }

  // Add a review to a shared meal plan
  async reviewMealPlan(
    userId: string,
    sharedPlanId: number,
    review: Omit<InsertMealPlanReview, 'shared_plan_id' | 'reviewer_id'>
  ): Promise<MealPlanReview> {
    // Check if already reviewed
    const existing = await db.select()
      .from(mealPlanReviews)
      .where(and(
        eq(mealPlanReviews.shared_plan_id, sharedPlanId),
        eq(mealPlanReviews.reviewer_id, userId)
      ));

    if (existing.length > 0) {
      throw new Error("You have already reviewed this meal plan");
    }

    // Add review
    const [newReview] = await db.insert(mealPlanReviews).values({
      ...review,
      shared_plan_id: sharedPlanId,
      reviewer_id: userId,
    }).returning();

    // Update success rate if they tried it
    if (review.tried_it) {
      await this.updatePlanSuccessRate(sharedPlanId);
    }

    // Award points for reviewing
    const [sharedPlan] = await db.select()
      .from(sharedMealPlans)
      .where(eq(sharedMealPlans.id, sharedPlanId));
    
    if (sharedPlan) {
      await this.awardPoints(userId, sharedPlan.community_id, 10, "reviewed_meal_plan");
    }

    return newReview;
  }

  // Mark a meal plan as tried
  async markPlanAsTried(userId: string, sharedPlanId: number): Promise<void> {
    // Update tries count
    await db.update(sharedMealPlans)
      .set({ 
        tries: sql`${sharedMealPlans.tries} + 1`,
      })
      .where(eq(sharedMealPlans.id, sharedPlanId));

    // Award points
    const [sharedPlan] = await db.select()
      .from(sharedMealPlans)
      .where(eq(sharedMealPlans.id, sharedPlanId));
    
    if (sharedPlan) {
      await this.awardPoints(userId, sharedPlan.community_id, 15, "tried_meal_plan");
    }
  }

  // Get trending meal plans across all communities
  async getTrendingMealPlans(limit: number = 10) {
    // Get plans from the last 7 days with high engagement
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trending = await db.select()
      .from(sharedMealPlans)
      .where(gte(sharedMealPlans.created_at, sevenDaysAgo))
      .orderBy(
        desc(sql`${sharedMealPlans.likes} + ${sharedMealPlans.tries} * 2`)
      )
      .limit(limit);

    return trending;
  }

  // Private helper methods
  private async verifyMembership(userId: string, communityId: number): Promise<CommunityMember> {
    const [member] = await db.select()
      .from(communityMembers)
      .where(and(
        eq(communityMembers.community_id, communityId),
        eq(communityMembers.user_id, userId)
      ));

    if (!member) {
      throw new Error("You must be a member to perform this action");
    }

    return member;
  }

  private async awardPoints(
    userId: string, 
    communityId: number, 
    points: number, 
    reason: string
  ): Promise<void> {
    await db.update(communityMembers)
      .set({ 
        points: sql`${communityMembers.points} + ${points}`,
        level: sql`CASE 
          WHEN ${communityMembers.points} + ${points} >= 500 THEN 5
          WHEN ${communityMembers.points} + ${points} >= 300 THEN 4
          WHEN ${communityMembers.points} + ${points} >= 150 THEN 3
          WHEN ${communityMembers.points} + ${points} >= 50 THEN 2
          ELSE 1
        END`,
      })
      .where(and(
        eq(communityMembers.community_id, communityId),
        eq(communityMembers.user_id, userId)
      ));
  }

  private async updatePlanSuccessRate(sharedPlanId: number): Promise<void> {
    // Calculate success rate based on reviews
    const reviews = await db.select()
      .from(mealPlanReviews)
      .where(and(
        eq(mealPlanReviews.shared_plan_id, sharedPlanId),
        eq(mealPlanReviews.tried_it, true)
      ));

    if (reviews.length > 0) {
      const positiveReviews = reviews.filter(r => r.rating >= 4).length;
      const successRate = Math.round((positiveReviews / reviews.length) * 100);

      await db.update(sharedMealPlans)
        .set({ success_rate: successRate })
        .where(eq(sharedMealPlans.id, sharedPlanId));
    }
  }

  // ============================================
  // COMMUNITY POSTS METHODS
  // ============================================

  // Create a new community post
  async createCommunityPost(
    userId: string, 
    communityId: number, 
    data: Omit<InsertCommunityPost, 'author_id' | 'community_id'>
  ): Promise<CommunityPost & { author: any }> {
    // Verify membership
    await this.verifyMembership(userId, communityId);

    console.log('Creating post with data:', JSON.stringify(data, null, 2));

    // Handle images properly for PostgreSQL - store as JSON string  
    let imagesForDB = null;
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      imagesForDB = JSON.stringify(data.images);
    }

    console.log('Images for DB (JSON string):', imagesForDB);

    const [post] = await db.insert(communityPosts).values({
      content: data.content,
      post_type: data.post_type || 'discussion',
      meal_plan_id: data.meal_plan_id || null,
      images: imagesForDB,
      author_id: userId,
      community_id: communityId,
    }).returning();

    // Get author info
    const [author] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      full_name: users.full_name,
    }).from(users).where(eq(users.id, userId));

    // Award points for posting
    await this.awardPoints(userId, communityId, 10, "created_post");

    return {
      ...post,
      images: post.images ? JSON.parse(post.images) : [], // Parse JSON string back to array
      author: author || { id: userId, firstName: null, lastName: null, profileImageUrl: null, full_name: null }
    };
  }

  // Delete a community post
  async deletePost(postId: number, communityId: number): Promise<boolean> {
    try {
      // First delete all related data (likes, comments, etc.)
      await db.delete(communityPostLikes)
        .where(eq(communityPostLikes.post_id, postId));

      await db.delete(communityPostComments)
        .where(eq(communityPostComments.post_id, postId));

      // Delete the post itself
      const [deletedPost] = await db.delete(communityPosts)
        .where(and(
          eq(communityPosts.id, postId),
          eq(communityPosts.community_id, communityId)
        ))
        .returning();

      return !!deletedPost;
    } catch (error) {
      console.error('Error deleting post:', error);
      return false;
    }
  }

  // Get community posts with pagination and filtering
  async getCommunityPosts(
    communityId: number, 
    options: {
      limit?: number;
      offset?: number;
      type?: string;
      userId?: string;
    } = {}
  ) {
    const { limit = 20, offset = 0, type, userId } = options;

    let whereConditions = [eq(communityPosts.community_id, communityId)];

    if (type) {
      whereConditions.push(eq(communityPosts.post_type, type));
    }

    const posts = await db.select({
      post: communityPosts,
      author: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        full_name: users.full_name,
      }
    })
    .from(communityPosts)
    .leftJoin(users, eq(communityPosts.author_id, users.id))
    .where(and(...whereConditions))
    .orderBy(desc(communityPosts.is_pinned), desc(communityPosts.created_at))
    .limit(limit)
    .offset(offset);

    // Get user's liked posts if userId provided
    let userLikedPosts = new Set<number>();
    if (userId) {
      const likedPosts = await db.select({ post_id: communityPostLikes.post_id })
        .from(communityPostLikes)
        .where(eq(communityPostLikes.user_id, userId));
      userLikedPosts = new Set(likedPosts.map(like => like.post_id).filter((id): id is number => id !== null));
    }

    // Fetch meal plan data for meal_share posts
    const mealPlanIds = posts
      .filter(({ post }) => post.post_type === 'meal_share' && post.meal_plan_id)
      .map(({ post }) => post.meal_plan_id!);

    let mealPlansMap = new Map<number, any>();
    if (mealPlanIds.length > 0) {
      const mealPlansData = await db.select()
        .from(mealPlans)
        .where(inArray(mealPlans.id, mealPlanIds));
      
      mealPlansMap = new Map(mealPlansData.map((plan: any) => [plan.id, plan]));
    }

    // Return posts with proper formatting for frontend
    return posts.map(({ post, author }) => {
      // Parse images data which may contain temporary meal plan data
      let parsedImages = [];
      let tempMealPlan = null;
      
      if (post.images) {
        try {
          const imageData = JSON.parse(post.images);
          if (imageData && typeof imageData === 'object') {
            // Check if it's the new format with temp_meal_plan
            if (imageData.temp_meal_plan) {
              parsedImages = imageData.images || [];
              tempMealPlan = imageData.temp_meal_plan;
              // Log for debugging
              console.log('Found temp_meal_plan in post', post.id, ':', tempMealPlan);
            } else if (Array.isArray(imageData)) {
              // Old format - just an array of images
              parsedImages = imageData;
            } else {
              // Unknown format, try to handle gracefully
              parsedImages = [];
            }
          }
        } catch (e) {
          console.error('Error parsing images for post', post.id, ':', e);
          // If parsing fails, assume it's an old format or malformed data
          parsedImages = [];
        }
      }

      // Determine meal plan data - check recipe_data first, then temp meal plan, then look up by ID
      let mealPlanData = null;
      if (post.post_type === 'meal_share') {
        // First check if recipe_data contains meal plan structure
        if (post.recipe_data) {
          try {
            mealPlanData = JSON.parse(post.recipe_data);
            console.log('Found meal plan in recipe_data for post', post.id, ':', mealPlanData);
          } catch (e) {
            console.error('Error parsing recipe_data for post', post.id, ':', e);
          }
        }
        // Fallback to temp meal plan from images (legacy)
        if (!mealPlanData && tempMealPlan) {
          mealPlanData = tempMealPlan;
        } 
        // Final fallback to meal plan by ID
        else if (!mealPlanData && post.meal_plan_id) {
          mealPlanData = mealPlansMap.get(post.meal_plan_id);
        }
      }

      return {
        ...post,
        images: parsedImages,
        username: author?.full_name || author?.firstName || 'Anonymous',
        likes_count: post.likes,
        author: author || { id: post.author_id, firstName: null, lastName: null, profileImageUrl: null, full_name: null },
        isLiked: userLikedPosts.has(post.id),
        is_liked: userLikedPosts.has(post.id),
        created_at: post.created_at ? new Date(post.created_at).toLocaleString() : new Date().toLocaleString(),
        // Include meal plan data for meal_share posts (from DB or temp data)
        meal_plan: mealPlanData
      };
    });
  }

  // Like/unlike a community post
  async togglePostLike(userId: string, postId: number, communityId?: number): Promise<{ liked: boolean, likesCount: number }> {
    // Verify post exists and get community info
    const [post] = await db.select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));

    if (!post) {
      throw new Error("Post not found");
    }

    // Prevent users from liking their own posts
    if (post.author_id === userId) {
      throw new Error("Cannot like your own post");
    }

    // If communityId provided, verify user is member
    if (communityId && communityId !== post.community_id) {
      throw new Error("Post not found");
    }

    // Verify user is a member of the community
    await this.verifyMembership(userId, post.community_id);

    // Check if already liked
    const [existingLike] = await db.select()
      .from(communityPostLikes)
      .where(and(
        eq(communityPostLikes.post_id, postId),
        eq(communityPostLikes.user_id, userId)
      ));

    if (existingLike) {
      // Unlike - remove like and decrement count
      await db.delete(communityPostLikes)
        .where(and(
          eq(communityPostLikes.post_id, postId),
          eq(communityPostLikes.user_id, userId)
        ));

      await db.update(communityPosts)
        .set({ likes: sql`${communityPosts.likes} - 1` })
        .where(eq(communityPosts.id, postId));

      const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId));
      return { liked: false, likesCount: post.likes || 0 };
    } else {
      // Like - add like and increment count
      await db.insert(communityPostLikes).values({
        post_id: postId,
        user_id: userId,
      });

      await db.update(communityPosts)
        .set({ likes: sql`${communityPosts.likes} + 1` })
        .where(eq(communityPosts.id, postId));

      const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId));
      return { liked: true, likesCount: post.likes || 0 };
    }
  }

  // Like/unlike a community comment
  async toggleCommentLike(userId: string, commentId: number): Promise<{ liked: boolean, likesCount: number }> {
    // Verify comment exists
    const [comment] = await db.select()
      .from(communityPostComments)
      .where(eq(communityPostComments.id, commentId));

    if (!comment) {
      throw new Error("Comment not found");
    }

    // Prevent users from liking their own comments
    if (comment.author_id === userId) {
      throw new Error("Cannot like your own comment");
    }

    // Verify user is a member of the community (through the post)
    const [post] = await db.select()
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.post_id));

    if (!post) {
      throw new Error("Post not found");
    }

    await this.verifyMembership(userId, post.community_id);

    // Check if already liked using the dedicated comment likes table
    const [existingLike] = await db.select()
      .from(communityCommentLikes)
      .where(and(
        eq(communityCommentLikes.comment_id, commentId),
        eq(communityCommentLikes.user_id, userId)
      ));

    if (existingLike) {
      // Unlike - remove like and decrement count
      await db.delete(communityCommentLikes)
        .where(and(
          eq(communityCommentLikes.comment_id, commentId),
          eq(communityCommentLikes.user_id, userId)
        ));

      await db.update(communityPostComments)
        .set({ likes: sql`${communityPostComments.likes} - 1` })
        .where(eq(communityPostComments.id, commentId));

      const [updatedComment] = await db.select().from(communityPostComments).where(eq(communityPostComments.id, commentId));
      return { liked: false, likesCount: updatedComment.likes || 0 };
    } else {
      // Like - add like and increment count
      await db.insert(communityCommentLikes).values({
        comment_id: commentId,
        user_id: userId,
      });

      await db.update(communityPostComments)
        .set({ likes: sql`${communityPostComments.likes} + 1` })
        .where(eq(communityPostComments.id, commentId));

      const [updatedComment] = await db.select().from(communityPostComments).where(eq(communityPostComments.id, commentId));
      return { liked: true, likesCount: updatedComment.likes || 0 };
    }
  }

  // Add a comment to a community post
  async addPostComment(
    userId: string, 
    postId: number, 
    content: string, 
    parentId?: number
  ): Promise<CommunityPostComment & { author: any }> {
    const [comment] = await db.insert(communityPostComments).values({
      post_id: postId,
      author_id: userId,
      content,
      parent_id: parentId,
    }).returning();

    // Increment comments count on post
    await db.update(communityPosts)
      .set({ comments_count: sql`${communityPosts.comments_count} + 1` })
      .where(eq(communityPosts.id, postId));

    // Get author info
    const [author] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
      full_name: users.full_name,
    }).from(users).where(eq(users.id, userId));

    return {
      ...comment,
      author: author || { id: userId, firstName: null, lastName: null, profileImageUrl: null, full_name: null }
    };
  }

  // Get comments for a post
  async getPostComments(postId: number, userId?: string) {
    const comments = await db.select({
      comment: communityPostComments,
      author: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        full_name: users.full_name,
      }
    })
    .from(communityPostComments)
    .leftJoin(users, eq(communityPostComments.author_id, users.id))
    .where(eq(communityPostComments.post_id, postId))
    .orderBy(communityPostComments.created_at);

    // If no userId provided, just return comments without like status
    if (!userId) {
      return comments.map(({ comment, author }) => ({
        ...comment,
        images: comment.images ? JSON.parse(comment.images) : [],
        author: author || { id: comment.author_id, firstName: null, lastName: null, profileImageUrl: null, full_name: null },
        isLiked: false
      }));
    }

    // Get all comment likes for this user for these comments
    const commentIds = comments.map(({ comment }) => comment.id);
    const userLikes = commentIds.length > 0 ? await db.select()
      .from(communityCommentLikes)
      .where(and(
        eq(communityCommentLikes.user_id, userId),
        sql`${communityCommentLikes.comment_id} IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})`
      )) : [];

    const likedCommentIds = new Set(userLikes.map(like => like.comment_id));

    return comments.map(({ comment, author }) => ({
      ...comment,
      images: comment.images ? JSON.parse(comment.images) : [],
      author: author || { id: comment.author_id, firstName: null, lastName: null, profileImageUrl: null, full_name: null },
      isLiked: likedCommentIds.has(comment.id)
    }));
  }

  // Get user membership for a community
  async getUserMembership(userId: string, communityId: number) {
    const [membership] = await db.select()
      .from(communityMembers)
      .where(and(
        eq(communityMembers.user_id, userId),
        eq(communityMembers.community_id, communityId)
      ));
    
    return membership;
  }


  // Create community meal plan
  async createCommunityMealPlan(userId: string, communityId: number, mealPlanData: any) {
    // For now, return mock data until we create proper meal plan storage
    // This will be enhanced with actual database storage
    return {
      id: Date.now(),
      title: mealPlanData.title,
      description: mealPlanData.description,
      image_url: mealPlanData.image_url,
      youtube_video_id: mealPlanData.youtube_video_id,
      ingredients: mealPlanData.ingredients,
      instructions: mealPlanData.instructions,
      prep_time: mealPlanData.prep_time,
      cook_time: mealPlanData.cook_time,
      servings: mealPlanData.servings,
      creator_name: "Community Creator",
      created_at: new Date().toISOString(),
      likes_count: 0,
      is_liked: false
    };
  }
}

export const communityService = new CommunityService();