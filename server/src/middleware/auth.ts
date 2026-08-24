import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { verifyToken } from '../utils/auth.js';
import { prisma } from '../services/prisma.js';
import { sendError } from '../utils/response.js';
import { appCache } from '../utils/cacheManager.js';

export interface CachedUserAuth {
  id: string;
  email: string;
  username: string;
  role: string;
  isBlocked: boolean;
}

export const getUserAuthStatus = async (userId: string): Promise<CachedUserAuth | null> => {
  return appCache.getOrSet(
    `user:auth:${userId}`,
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, username: true, role: true, isBlocked: true },
      });
      return user;
    },
    60 // Cache for 60 seconds (Anti-stampede protected)
  );
};

export const invalidateUserAuthCache = (userId: string): void => {
  appCache.delete(`user:auth:${userId}`);
};

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required. Please login.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, 'Invalid authorization token format.', 401);
    }

    const decoded = verifyToken(token);
    const user = await getUserAuthStatus(decoded.userId);

    if (!user) {
      return sendError(res, 'User account no longer exists.', 401);
    }

    if (user.isBlocked) {
      return sendError(res, 'Your account has been suspended by an administrator.', 403);
    }

    req.user = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error: any) {
    return sendError(res, 'Invalid or expired authentication token.', 401);
  }
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = verifyToken(token);
        const user = await getUserAuthStatus(decoded.userId);

        if (user && !user.isBlocked) {
          req.user = {
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          };
        }
      }
    }
  } catch (error) {
    // Ignore invalid token in optional auth
  }
  next();
};

