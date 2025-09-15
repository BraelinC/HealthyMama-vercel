/**
 * Simple rate limiter to prevent API abuse
 */

interface RateLimit {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimit>();
  private readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_REQUESTS = 10; // 10 requests per hour for free users

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.limits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit
      this.limits.set(userId, {
        count: 1,
        resetTime: now + this.WINDOW_MS
      });
      return true;
    }

    if (userLimit.count >= this.MAX_REQUESTS) {
      return false;
    }

    userLimit.count++;
    return true;
  }

  getRemainingRequests(userId: string): number {
    const userLimit = this.limits.get(userId);
    if (!userLimit || Date.now() > userLimit.resetTime) {
      return this.MAX_REQUESTS;
    }
    return Math.max(0, this.MAX_REQUESTS - userLimit.count);
  }

  getResetTime(userId: string): number {
    const userLimit = this.limits.get(userId);
    if (!userLimit || Date.now() > userLimit.resetTime) {
      return Date.now() + this.WINDOW_MS;
    }
    return userLimit.resetTime;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [userId, limit] of this.limits.entries()) {
      if (now > limit.resetTime) {
        this.limits.delete(userId);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Cleanup expired entries every hour
setInterval(() => rateLimiter.cleanup(), 60 * 60 * 1000);