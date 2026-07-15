import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiters
const chatRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '10 m'), // 20 requests per 10 minutes
  analytics: false,
});

const escalateRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 requests per hour
  analytics: false,
});

export async function checkChatRateLimit(sessionId: string) {
  try {
    const result = await chatRateLimiter.limit(`chat:${sessionId}`);
    return result;
  } catch (error) {
    console.error('Chat rate limit check error:', error);
    // On error, allow the request (fail open)
    return { success: true };
  }
}

export async function checkEscalateRateLimit(sessionId: string) {
  try {
    const result = await escalateRateLimiter.limit(`escalate:${sessionId}`);
    return result;
  } catch (error) {
    console.error('Escalate rate limit check error:', error);
    // On error, allow the request (fail open)
    return { success: true };
  }
}
