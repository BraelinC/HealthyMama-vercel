import { db } from "./db";
import { 
  creatorProfiles, 
  creatorFollowers,
  sharedMealPlans,
  mealPlanReviews,
  users,
  type CreatorProfile,
  type InsertCreatorProfile,
  type CreatorFollower,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export class CreatorService {
  // Create or update creator profile
  async upsertCreatorProfile(
    userId: string, 
    data: Omit<InsertCreatorProfile, 'user_id'>
  ): Promise<CreatorProfile> {
    // Check if profile exists
    const existing = await db.select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.user_id, userId));

    if (existing.length > 0) {
      // Update existing profile
      const [updated] = await db.update(creatorProfiles)
        .set({
          ...data,
          updated_at: new Date(),
        })
        .where(eq(creatorProfiles.user_id, userId))
        .returning();
      return updated;
    } else {
      // Create new profile
      const [created] = await db.insert(creatorProfiles)
        .values({
          ...data,
          user_id: userId,
        })
        .returning();
      return created;
    }
  }

  // Get creator profile with stats
  async getCreatorProfile(creatorId: string, viewerId?: string) {
    const [profile] = await db.select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.user_id, creatorId));

    if (!profile) {
      return null;
    }

    // Get user info
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, creatorId));

    // Check if viewer follows this creator
    let isFollowing = false;
    if (viewerId) {
      const follow = await db.select()
        .from(creatorFollowers)
        .where(and(
          eq(creatorFollowers.creator_id, creatorId),
          eq(creatorFollowers.follower_id, viewerId)
        ));
      isFollowing = follow.length > 0;
    }

    // Get recent shared plans
    const recentPlans = await db.select()
      .from(sharedMealPlans)
      .where(eq(sharedMealPlans.sharer_id, creatorId))
      .orderBy(desc(sharedMealPlans.created_at))
      .limit(6);

    // Calculate average rating from reviews
    const reviews = await db.select()
      .from(mealPlanReviews)
      .innerJoin(
        sharedMealPlans, 
        eq(mealPlanReviews.shared_plan_id, sharedMealPlans.id)
      )
      .where(eq(sharedMealPlans.sharer_id, creatorId));

    let averageRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, r) => sum + r.meal_plan_reviews.rating, 0);
      averageRating = Math.round(totalRating / reviews.length * 10) / 10; // One decimal place
    }

    return {
      ...profile,
      user: {
        id: user.id,
        name: user.full_name || user.firstName || "Creator",
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
      isFollowing,
      recentPlans,
      averageRating,
      totalReviews: reviews.length,
    };
  }

  // Follow a creator
  async followCreator(followerId: string, creatorId: string): Promise<CreatorFollower> {
    // Check if already following
    const existing = await db.select()
      .from(creatorFollowers)
      .where(and(
        eq(creatorFollowers.creator_id, creatorId),
        eq(creatorFollowers.follower_id, followerId)
      ));

    if (existing.length > 0) {
      throw new Error("Already following this creator");
    }

    // Add follower
    const [follower] = await db.insert(creatorFollowers)
      .values({
        creator_id: creatorId,
        follower_id: followerId,
      })
      .returning();

    // Update follower count
    await db.update(creatorProfiles)
      .set({ 
        follower_count: sql`${creatorProfiles.follower_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(creatorProfiles.user_id, creatorId));

    return follower;
  }

  // Unfollow a creator
  async unfollowCreator(followerId: string, creatorId: string): Promise<void> {
    const result = await db.delete(creatorFollowers)
      .where(and(
        eq(creatorFollowers.creator_id, creatorId),
        eq(creatorFollowers.follower_id, followerId)
      ));

    if (result.rowCount === 0) {
      throw new Error("Not following this creator");
    }

    // Update follower count
    await db.update(creatorProfiles)
      .set({ 
        follower_count: sql`${creatorProfiles.follower_count} - 1`,
        updated_at: new Date(),
      })
      .where(eq(creatorProfiles.user_id, creatorId));
  }

  // Get creators followed by a user
  async getFollowedCreators(userId: string) {
    const follows = await db.select()
      .from(creatorFollowers)
      .innerJoin(
        creatorProfiles,
        eq(creatorFollowers.creator_id, creatorProfiles.user_id)
      )
      .innerJoin(
        users,
        eq(creatorProfiles.user_id, users.id)
      )
      .where(eq(creatorFollowers.follower_id, userId))
      .orderBy(desc(creatorFollowers.followed_at));

    return follows.map(f => ({
      profile: f.creator_profiles,
      user: {
        id: f.users.id,
        name: f.users.full_name || f.users.firstName || "Creator",
        email: f.users.email,
        profileImageUrl: f.users.profileImageUrl,
      },
      followedAt: f.creator_followers.followed_at,
    }));
  }

  // Get meal plans from followed creators
  async getFollowedCreatorsMealPlans(userId: string, limit: number = 20) {
    // Get followed creators
    const follows = await db.select()
      .from(creatorFollowers)
      .where(eq(creatorFollowers.follower_id, userId));

    if (follows.length === 0) {
      return [];
    }

    const creatorIds = follows.map(f => f.creator_id);

    // Get recent meal plans from these creators
    const plans = await db.select()
      .from(sharedMealPlans)
      .innerJoin(users, eq(sharedMealPlans.sharer_id, users.id))
      .where(inArray(sharedMealPlans.sharer_id, creatorIds))
      .orderBy(desc(sharedMealPlans.created_at))
      .limit(limit);

    return plans.map(p => ({
      ...p.shared_meal_plans,
      creator: {
        id: p.users.id,
        name: p.users.full_name || p.users.firstName || "Creator",
        profileImageUrl: p.users.profileImageUrl,
      },
    }));
  }

  // Get top creators by various metrics
  async getTopCreators(metric: 'followers' | 'plans' | 'rating' = 'followers', limit: number = 10) {
    console.log(`🔍 [DEBUG] Getting top creators by ${metric}, limit: ${limit}`);
    
    // Check if any creator profiles exist first
    const allProfiles = await db.select().from(creatorProfiles);
    console.log(`📊 [DEBUG] Total creator profiles in database: ${allProfiles.length}`);
    
    if (allProfiles.length === 0) {
      console.log(`⚠️ [DEBUG] No creator profiles found, returning empty array`);
      return [];
    }

    let creators;
    switch (metric) {
      case 'followers':
        creators = await db.select()
          .from(creatorProfiles)
          .innerJoin(users, eq(creatorProfiles.user_id, users.id))
          .orderBy(desc(creatorProfiles.follower_count))
          .limit(limit);
        break;
      case 'plans':
        creators = await db.select()
          .from(creatorProfiles)
          .innerJoin(users, eq(creatorProfiles.user_id, users.id))
          .orderBy(desc(creatorProfiles.total_plans_shared))
          .limit(limit);
        break;
      case 'rating':
        creators = await db.select()
          .from(creatorProfiles)
          .innerJoin(users, eq(creatorProfiles.user_id, users.id))
          .orderBy(desc(creatorProfiles.average_rating))
          .limit(limit);
        break;
      default:
        creators = await db.select()
          .from(creatorProfiles)
          .innerJoin(users, eq(creatorProfiles.user_id, users.id))
          .orderBy(desc(creatorProfiles.follower_count))
          .limit(limit);
    }

    console.log(`✅ [DEBUG] Found ${creators.length} creators for metric: ${metric}`);

    return creators.map(c => ({
      profile: c.creator_profiles,
      user: {
        id: c.users.id,
        name: c.users.full_name || c.users.firstName || "Creator",
        email: c.users.email,
        profileImageUrl: c.users.profileImageUrl,
      },
    }));
  }

  // Update creator stats after sharing a meal plan
  async updateCreatorStats(creatorId: string): Promise<void> {
    // Count total shared plans
    const plans = await db.select()
      .from(sharedMealPlans)
      .where(eq(sharedMealPlans.sharer_id, creatorId));

    // Calculate average rating
    const reviews = await db.select()
      .from(mealPlanReviews)
      .innerJoin(
        sharedMealPlans, 
        eq(mealPlanReviews.shared_plan_id, sharedMealPlans.id)
      )
      .where(eq(sharedMealPlans.sharer_id, creatorId));

    let averageRating = null;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, r) => sum + r.meal_plan_reviews.rating, 0);
      averageRating = Math.round(totalRating / reviews.length);
    }

    await db.update(creatorProfiles)
      .set({
        total_plans_shared: plans.length,
        average_rating: averageRating,
        updated_at: new Date(),
      })
      .where(eq(creatorProfiles.user_id, creatorId));
  }

  // Search creators by specialty
  async searchCreators(query: string, specialties?: string[]) {
    const allCreators = await db.select()
      .from(creatorProfiles)
      .innerJoin(users, eq(creatorProfiles.user_id, users.id));

    // Filter by query in bio or user name
    let filtered = allCreators;
    if (query) {
      filtered = allCreators.filter(c => {
        const name = c.users.full_name || c.users.firstName || "";
        const bio = c.creator_profiles.bio || "";
        return name.toLowerCase().includes(query.toLowerCase()) ||
               bio.toLowerCase().includes(query.toLowerCase());
      });
    }

    // Filter by specialties if provided
    if (specialties && specialties.length > 0) {
      filtered = filtered.filter(c => {
        const creatorSpecialties = c.creator_profiles.specialties as string[];
        return specialties.some(s => creatorSpecialties.includes(s));
      });
    }

    return filtered.map(c => ({
      profile: c.creator_profiles,
      user: {
        id: c.users.id,
        name: c.users.full_name || c.users.firstName || "Creator",
        email: c.users.email,
        profileImageUrl: c.users.profileImageUrl,
      },
    }));
  }
}

export const creatorService = new CreatorService();