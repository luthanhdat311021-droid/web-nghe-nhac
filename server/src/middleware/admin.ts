import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { sendError } from '../utils/response.js';

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return sendError(res, 'Access denied. Administrator privileges required.', 403);
  }
  next();
};
