import { Response } from 'express';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { HybridSearchService } from '../services/search/hybridSearchService.js';
import { searchRateLimiter } from '../services/search/rateLimiter.js';
import { appCache } from '../utils/cacheManager.js';

/**
 * Main Search All Endpoint
 * GET /api/search?q=...&type=...&contextSongId=...
 */
export const searchAll = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'anonymous';
    const rateCheck = searchRateLimiter.check(clientIp);

    if (!rateCheck.allowed) {
      return sendError(
        res,
        'Bạn đang tìm kiếm quá nhanh. Vui lòng thử lại sau vài giây.',
        429
      );
    }

    const { q, type, contextSongId, limit } = req.query;
    const query = String(q || '').trim();
    const limitNum = limit ? parseInt(String(limit), 10) : 15;
    const cacheKey = `search:${query}:${type || 'all'}:${contextSongId || 'none'}:${limitNum}:${req.user?.userId || 'anon'}`;

    const results = await appCache.getOrSet(
      cacheKey,
      async () => {
        return HybridSearchService.searchAll({
          query,
          type: type as any,
          userId: req.user?.userId,
          contextSongId: contextSongId ? String(contextSongId) : undefined,
          limit: limitNum,
        });
      },
      60 // Cache for 60 seconds
    );

    return sendSuccess(res, results);
  } catch (error: any) {
    console.error('Search error:', error);
    return sendError(res, error.message || 'Lỗi xử lý tìm kiếm', 500);
  }
};

/**
 * Fast Autocomplete Suggestions Endpoint
 * GET /api/search/suggestions?q=...
 */
export const getSuggestions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, limit } = req.query;
    const query = String(q || '').trim();
    const limitNum = limit ? parseInt(String(limit), 10) : 8;

    const suggestions = await appCache.getOrSet(
      `search:sug:${query}:${limitNum}`,
      async () => {
        return HybridSearchService.getSuggestions(query, limitNum);
      },
      120 // Cache for 2 minutes
    );

    return sendSuccess(res, suggestions);
  } catch (error: any) {
    console.error('Suggestions error:', error);
    return sendError(res, error.message || 'Lỗi tải gợi ý', 500);
  }
};

/**
 * Dynamic Trending & Popular Searches Endpoint
 * GET /api/search/trending
 */
export const getTrending = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const trending = await appCache.getOrSet(
      'search:trending',
      async () => {
        return HybridSearchService.getTrending();
      },
      180 // Cache for 3 minutes
    );
    return sendSuccess(res, trending);
  } catch (error: any) {
    console.error('Trending error:', error);
    return sendError(res, error.message || 'Lỗi tải xu hướng tìm kiếm', 500);
  }
};
