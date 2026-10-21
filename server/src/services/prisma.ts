import { PrismaClient } from '@prisma/client';
import { INLINE_MEDIA_FIELDS, INLINE_MEDIA_MODELS, parseInlineMediaUrl } from '../utils/inlineMedia.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/**
 * API responses replace inline data: URIs with /api/media/inline/:id/:field URLs (see utils/inlineMedia.ts).
 * When a client form sends such a URL back on save, write the original stored value instead,
 * so editing a song/artist/album never destroys its media.
 */
const restoreInlineMediaFields = async (data: any) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  for (const field of INLINE_MEDIA_FIELDS) {
    const ref = parseInlineMediaUrl(data[field]);
    if (!ref) continue;
    // The URL may point at another record/field (e.g. a song cover copied from an artist avatar).
    for (const model of INLINE_MEDIA_MODELS[ref.field]) {
      const row = await (prisma as any)[model].findUnique({ where: { id: ref.id }, select: { [ref.field]: true } });
      if (typeof row?.[ref.field] === 'string') {
        data[field] = row[ref.field];
        break;
      }
    }
  }
};

prisma.$use(async (params, next) => {
  if (params.action === 'create' || params.action === 'update') {
    await restoreInlineMediaFields(params.args?.data);
  } else if (params.action === 'upsert') {
    await restoreInlineMediaFields(params.args?.create);
    await restoreInlineMediaFields(params.args?.update);
  }
  return next(params);
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
