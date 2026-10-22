import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../services/prisma.js';
import { appCache } from '../utils/cacheManager.js';
import { config } from '../config/index.js';

// Disable external SMTP verification in this isolated controller test process.
config.smtp.user = '';
config.smtp.pass = '';
const { updateProfile } = await import('../controllers/auth.controller.js');
const { jobQueue } = await import('../services/jobQueue.js');

// The controller imports the production queue; this test performs no background jobs.
jobQueue.stop();

test('profile email updates are normalized, scoped to the signed-in user, and available to both roles', async () => {
  const db = prisma as any;
  const originalFind = db.user.findFirst;
  const originalUpdate = db.user.update;
  let written: any;
  let duplicate = false;
  let conflict = false;
  db.user.findFirst = async ({ where }: any) => {
    assert.equal(where.NOT.id, 'self');
    assert.equal(where.email.mode, 'insensitive');
    return duplicate ? { id: 'other' } : null;
  };
  db.user.update = async (args: any) => {
    if (conflict) throw { code: 'P2002' };
    written = args;
    return { id: args.where.id, ...args.data };
  };
  async function run(body: any, role = 'USER') {
    written = undefined;
    const res: any = { code: 200, payload: null,
      status(code: number) { this.code = code; return this; },
      json(payload: any) { this.payload = payload; return this; } };
    await updateProfile({ body, user: { userId: 'self', role } } as any, res);
    return res;
  }
  try {
    for (const role of ['USER', 'ADMIN']) {
      appCache.set('user:auth:self', { email: 'old@example.com' });
      const res = await run({ email: '  NEW@Example.com  ', userId: 'other', role: 'ADMIN' }, role);
      assert.equal(res.code, 200);
      assert.deepEqual(written.where, { id: 'self' });
      assert.deepEqual(written.data, { email: 'new@example.com' });
      assert.equal(appCache.get('user:auth:self'), undefined);
      assert.equal(res.payload.data.email, 'new@example.com');
    }
    for (const email of ['', 'invalid', 'a'.repeat(100) + '@example.com']) {
      assert.equal((await run({ email })).code, 400);
      assert.equal(written, undefined);
    }
    duplicate = true;
    assert.equal((await run({ email: 'taken@example.com' })).code, 400);
    assert.equal(written, undefined);
    duplicate = false;
    conflict = true;
    assert.equal((await run({ email: 'race@example.com' })).code, 400);
    conflict = false;
    assert.equal((await run({ bio: 'Updated bio' })).code, 200);
    assert.equal('email' in (written as any).data, false);
  } finally {
    db.user.findFirst = originalFind;
    db.user.update = originalUpdate;
  }
});
