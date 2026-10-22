import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../config/index.js';
import { prisma } from '../services/prisma.js';
import { hashPassword, comparePassword, generateResetToken, verifyToken } from '../utils/auth.js';
config.smtp.user = ''; config.smtp.pass = '';
const { requestPasswordReset, verifyPasswordResetOtp, resetPassword } = await import('../controllers/auth.controller.js');
const { emailService } = await import('../services/email.service.js');
const { jobQueue } = await import('../services/jobQueue.js');
jobQueue.stop();

test('password recovery: delivery errors, bounded OTP attempts, one-use reset and changed email', async () => {
  const db = prisma as any;
  const originals = { find: db.user.findUnique, update: db.user.updateMany, otpFind: db.passwordResetOtp.findFirst, otpUpdate: db.passwordResetOtp.updateMany, create: db.passwordResetOtp.create, delete: db.passwordResetOtp.deleteMany, send: emailService.sendPasswordResetOtp };
  const user = { id: 'test', email: 'test@example.com', username: 'test', isBlocked: false, passwordHash: await hashPassword('OldPassword1') };
  let otp: any;
  let delivery = false;
  let exists = true;
  let deleted = false;
  db.user.findUnique = async () => exists ? { ...user } : null;
  db.user.updateMany = async ({ where, data }: any) => {
    if (where.passwordHash !== user.passwordHash || where.email !== user.email) return { count: 0 };
    Object.assign(user, data); return { count: 1 };
  };
  db.passwordResetOtp.findFirst = async ({ where }: any) => where.createdAt ? null : otp && !otp.usedAt ? { ...otp } : null;
  db.passwordResetOtp.create = async ({ data }: any) => (otp = { id: 'otp', attempts: 0, usedAt: null, ...data });
  db.passwordResetOtp.deleteMany = async () => { deleted = true; otp = null; return { count: 1 }; };
  db.passwordResetOtp.updateMany = async ({ where, data }: any) => {
    if (!otp || otp.usedAt || (where.expiresAt && otp.expiresAt <= where.expiresAt.gt) || (where.attempts && otp.attempts >= where.attempts.lt)) return { count: 0 };
    if (data.attempts) otp.attempts++;
    if (data.usedAt) otp.usedAt = data.usedAt;
    return { count: 1 };
  };
  emailService.sendPasswordResetOtp = async () => delivery;
  async function run(fn: any, body: any) {
    const res: any = { code: 200, payload: null, status(code: number) { this.code = code; return this; }, json(payload: any) { this.payload = payload; return this; } };
    await fn({ body, socket: {}, ip: 'test' }, res); return res;
  }
  try {
    assert.equal((await run(requestPasswordReset, { email: ' TEST@example.com ' })).code, 503);
    assert.equal(deleted, true);
    delivery = true;
    assert.equal((await run(requestPasswordReset, { email: user.email })).code, 200);
    exists = false;
    assert.equal((await run(requestPasswordReset, { email: 'missing@example.com' })).code, 200);
    exists = true;
    otp.otpHash = await hashPassword('123456');
    for (let i = 0; i < 4; i++) assert.equal((await run(verifyPasswordResetOtp, { email: user.email, otp: '000000' })).code, 400);
    const verified = await run(verifyPasswordResetOtp, { email: user.email, otp: '123456' });
    assert.equal(verified.code, 200);
    assert.equal((await run(verifyPasswordResetOtp, { email: user.email, otp: '123456' })).code, 400);
    const token = verified.payload.data.resetToken;
    assert.throws(() => verifyToken(token));
    const body = { resetToken: token, newPassword: 'NewPassword2', confirmPassword: 'NewPassword2' };
    assert.equal((await run(resetPassword, { ...body, confirmPassword: 'Different1' })).code, 400);
    const concurrent = await Promise.all([run(resetPassword, body), run(resetPassword, body)]);
    assert.deepEqual(concurrent.map(r => r.code).sort(), [200, 401]);
    assert.equal(await comparePassword('NewPassword2', user.passwordHash), true);
    assert.equal((await run(resetPassword, body)).code, 401);
    const changedEmailToken = generateResetToken(user.id, user.email, user.passwordHash);
    user.email = 'changed@example.com';
    assert.equal((await run(resetPassword, { ...body, resetToken: changedEmailToken })).code, 401);
    otp = { id: 'otp', attempts: 0, usedAt: null, otpHash: await hashPassword('123456'), expiresAt: new Date(Date.now() - 1) };
    assert.equal((await run(verifyPasswordResetOtp, { email: user.email, otp: '123456' })).code, 400);
    otp.expiresAt = new Date(Date.now() + 60000);
    const parallel = await Promise.all([run(verifyPasswordResetOtp, { email: user.email, otp: '123456' }), run(verifyPasswordResetOtp, { email: user.email, otp: '123456' })]);
    assert.deepEqual(parallel.map(r => r.code).sort(), [200, 400]);
  } finally {
    db.user.findUnique = originals.find; db.user.updateMany = originals.update;
    db.passwordResetOtp.findFirst = originals.otpFind; db.passwordResetOtp.updateMany = originals.otpUpdate;
    db.passwordResetOtp.create = originals.create; db.passwordResetOtp.deleteMany = originals.delete;
    emailService.sendPasswordResetOtp = originals.send;
  }
});
