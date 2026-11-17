// Scale-up India — Phase 16: Centralized Sliding-Window Rate Limiter
// Path: src/lib/security/rateLimiter.ts

import { SECURITY_CONFIG } from "./config";
import { DomainError } from "@/lib/errors";

export class RateLimitExceededError extends DomainError {
  constructor(message = "Too many requests. Please slow down.", retryAfterSeconds = 60) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
  }
}

interface RateLimitBucket {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_MUTATION_LIMIT: RateLimitConfig = {
  windowMs: SECURITY_CONFIG.RATE_LIMITS.MUTATION.WINDOW_MS,
  maxRequests: SECURITY_CONFIG.RATE_LIMITS.MUTATION.MAX_REQUESTS,
};

/**
 * Checks a sliding-window rate limit for a given key.
 * Throws RateLimitExceededError if the request count exceeds maxRequests within windowMs.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_MUTATION_LIMIT
): { remaining: number; resetTime: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(key) || { timestamps: [] };

  // Filter timestamps within the sliding window
  const validTimestamps = bucket.timestamps.filter((ts) => now - ts < config.windowMs);

  if (validTimestamps.length >= config.maxRequests) {
    const oldestTimestamp = validTimestamps[0];
    const retryAfterMs = oldestTimestamp + config.windowMs - now;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    throw new RateLimitExceededError(
      `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${Math.round(config.windowMs / 1000)}s allowed.`,
      retryAfterSec
    );
  }

  validTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: validTimestamps });

  const remaining = config.maxRequests - validTimestamps.length;
  const resetTime = now + config.windowMs;

  return { remaining, resetTime };
}

/**
 * Resets all active rate limit buckets. Used for deterministic testing.
 */
export function resetAllRateLimits(): void {
  rateLimitStore.clear();
}
