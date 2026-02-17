import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export interface AuthPayload {
    sessionId: string;
}

export type AuthRequest = Request & { sessionId: string };

export function signToken(sessionId: string): string {
    return jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyTokenSafe(token: string): string | null {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
        return payload.sessionId;
    } catch {
        return null;
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }

    try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
        (req as Request & { sessionId: string }).sessionId = payload.sessionId;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
