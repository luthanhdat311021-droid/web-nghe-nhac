import { Request, Response } from 'express';
import { z } from 'zod';
import { GoogleAuthError, googleLoginUrl, exchangeGoogleCode, signInGoogle, linkGoogleAccount } from '../services/googleAuth.js';
import { sendError, sendSuccess } from '../utils/response.js';

const randomValue = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);
function failure(res: Response, error: unknown) {
  if (error instanceof GoogleAuthError) return sendError(res, error.message, error.status);
  if (error instanceof z.ZodError) return sendError(res, 'Thông tin đăng nhập Google không hợp lệ.', 400);
  if ((error as any)?.code === 'P2002') return sendError(res, 'Tài khoản vừa được tạo hoặc liên kết. Vui lòng đăng nhập lại.', 409);
  return sendError(res, 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.', 502);
}
export async function startGoogleLogin(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { challenge, state, nonce } = z.object({ challenge: randomValue, state: randomValue, nonce: randomValue }).parse(req.body);
    return sendSuccess(res, { url: googleLoginUrl(challenge, state, nonce) });
  } catch (error) { return failure(res, error); }
}
export async function finishGoogleLogin(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { code, verifier, nonce } = z.object({ code: z.string().min(1).max(4096), verifier: randomValue, nonce: randomValue }).parse(req.body);
    return sendSuccess(res, await signInGoogle(await exchangeGoogleCode(code, verifier, nonce)));
  } catch (error) { return failure(res, error); }
}
export async function confirmGoogleLink(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { ticket, password } = z.object({ ticket: z.string().min(1).max(4096), password: z.string().min(1).max(72) }).parse(req.body);
    return sendSuccess(res, await linkGoogleAccount(ticket, password));
  } catch (error) { return failure(res, error); }
}
