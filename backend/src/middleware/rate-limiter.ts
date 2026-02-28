import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

interface RateLimiterOptions {
    maxRequests: number;
    windowMs: number;
    keyExtractor: (req: Request) => string | null;
}

export function sessionKey(req: Request): string | null {
    return (req as AuthRequest).sessionId ?? null;
}

export function ipKey(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0];
    return req.ip ?? null;
}

export function createRateLimiter({ maxRequests, windowMs, keyExtractor }: RateLimiterOptions) {
    const requests = new Map<string, number[]>();

    // Prune stale entries every 60s to prevent memory leaks
    setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of requests) {
            const recent = timestamps.filter(t => now - t < windowMs);
            if (recent.length === 0) {
                requests.delete(key);
            } else {
                requests.set(key, recent);
            }
        }
    }, 60_000).unref();

    return (req: Request, res: Response, next: NextFunction): void => {
        const key = keyExtractor(req);
        if (!key) {
            res.status(400).json({ error: 'Unable to identify client' });
            return;
        }

        const now = Date.now();
        const timestamps = requests.get(key) ?? [];
        const recent = timestamps.filter(t => now - t < windowMs);

        if (recent.length >= maxRequests) {
            res.status(429).json({ error: 'Too many requests, please slow down' });
            return;
        }

        recent.push(now);
        requests.set(key, recent);
        next();
    };
}
