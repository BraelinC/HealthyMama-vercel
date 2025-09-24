import { communityPostComments, communityPosts, users, type CommunityPostComment, type InsertCommunityPostComment } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql } from "drizzle-orm";

export class CommunityCommentsService {
  
  // Get all comments for a specific post
  async getPostComments(postId: number): Promise<Array<CommunityPostComment & { author: { firstName: string | null, lastName: string | null } | null }>> {
    const comments = await db
      .select({
        id: communityPostComments.id,
        post_id: communityPostComments.post_id,
        author_id: communityPostComments.author_id,
        content: communityPostComments.content,
        parent_id: communityPostComments.parent_id,
        images: communityPostComments.images,
        likes: communityPostComments.likes,
        created_at: communityPostComments.created_at,
        updated_at: communityPostComments.updated_at,
        author: {
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(communityPostComments)
      .leftJoin(users, eq(communityPostComments.author_id, users.id))
      .where(eq(communityPostComments.post_id, postId))
      .orderBy(asc(communityPostComments.created_at));

    // Parse images from JSON strings to arrays
    return comments.map(comment => ({
      ...comment,
      images: comment.images ? JSON.parse(comment.images) : []
    }));
  }

  // Create a new comment
  async createComment(commentData: {
    post_id: number;
    author_id: string;
    content: string;
    parent_id?: number;
    images?: string[];
  }): Promise<CommunityPostComment> {
    // Convert images array to JSON string (same as posts)
    const imagesString = commentData.images && commentData.images.length > 0 
      ? JSON.stringify(commentData.images) 
      : null;

    const [comment] = await db
      .insert(communityPostComments)
      .values({
        post_id: commentData.post_id,
        author_id: commentData.author_id,
        content: commentData.content,
        parent_id: commentData.parent_id || null,
        images: imagesString,
      })
      .returning();

    // Update comments count on the post
    await this.updatePostCommentsCount(commentData.post_id);

    return {
      ...comment,
      images: comment.images ? JSON.parse(comment.images) : []
    };
  }

  // Update comment content
  async updateComment(commentId: number, userId: string, data: {
    content: string;
    images?: string[];
  }): Promise<CommunityPostComment | null> {
    // Convert images array to JSON string
    const imagesString = data.images && data.images.length > 0 
      ? JSON.stringify(data.images) 
      : null;

    const [comment] = await db
      .update(communityPostComments)
      .set({
        content: data.content,
        images: imagesString,
        updated_at: new Date(),
      })
      .where(eq(communityPostComments.id, commentId))
      .returning();

    if (!comment) return null;

    return {
      ...comment,
      images: comment.images ? JSON.parse(comment.images) : []
    };
  }

  // Delete a comment
  async deleteComment(commentId: number, userId: string): Promise<boolean> {
    // Get the comment first to get the post_id for updating count
    const [comment] = await db
      .select({ post_id: communityPostComments.post_id })
      .from(communityPostComments)
      .where(eq(communityPostComments.id, commentId));

    if (!comment) return false;

    const result = await db
      .delete(communityPostComments)
      .where(eq(communityPostComments.id, commentId));

    if (result.rowCount && result.rowCount > 0) {
      // Update comments count on the post
      await this.updatePostCommentsCount(comment.post_id);
      return true;
    }

    return false;
  }

  // Helper: Update comments count on a post
  private async updatePostCommentsCount(postId: number): Promise<void> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityPostComments)
      .where(eq(communityPostComments.post_id, postId));

    await db
      .update(communityPosts)
      .set({ comments_count: count })
      .where(eq(communityPosts.id, postId));
  }

  // Get nested comment structure (for threaded comments)
  async getNestedComments(postId: number, userId?: string): Promise<any[]> {
    // Import communityService here to avoid circular imports
    const { communityService } = await import('./communityService');
    const allComments = await communityService.getPostComments(postId, userId);
    
    // Build nested structure
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create comment objects with children arrays
    allComments.forEach((comment: any) => {
      commentMap.set(comment.id, { ...comment, children: [] });
    });

    // Second pass: build the nested structure
    allComments.forEach((comment: any) => {
      const commentWithChildren = commentMap.get(comment.id);
      
      if (comment.parent_id) {
        // This is a reply, add to parent's children
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.children.push(commentWithChildren);
        }
      } else {
        // This is a root comment
        rootComments.push(commentWithChildren);
      }
    });

    return rootComments;
  }
}

export const communityCommentsService = new CommunityCommentsService();