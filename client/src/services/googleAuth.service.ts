import api from './api.js';
import { ApiResponse, User } from '../types/index.js';

const flowKey = 'musicwave_google_oauth';
export interface GoogleSession { user: User; token: string }
export type GoogleResult = GoogleSession | { requiresLink: true; linkTicket: string };
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

export async function beginGoogleLogin() {
  const verifier = random();
  const state = random();
  const nonce = random();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const { data } = await api.post<ApiResponse<{ url: string }>>('/auth/google/start', { challenge, state, nonce });
  sessionStorage.setItem(flowKey, JSON.stringify({ verifier, state, nonce, createdAt: Date.now() }));
  window.location.assign(data.data.url);
}

// One shared promise prevents React StrictMode from exchanging a single-use code twice.
let completion: Promise<GoogleResult> | undefined;
export function completeGoogleLogin(): Promise<GoogleResult> {
  if (completion) return completion;
  completion = (async () => {
    const params = new URLSearchParams(window.location.search);
    const raw = sessionStorage.getItem(flowKey);
    sessionStorage.removeItem(flowKey);
    window.history.replaceState(null, '', window.location.pathname);
    if (params.has('error')) throw new Error('Bạn đã hủy hoặc Google chưa cho phép đăng nhập.');
    if (!raw) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng bắt đầu lại.');
    const flow = JSON.parse(raw);
    if (!params.get('code') || params.get('state') !== flow.state || Date.now() - flow.createdAt > 10 * 60 * 1000) {
      throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
    const { data } = await api.post<ApiResponse<GoogleResult>>('/auth/google/exchange', {
      code: params.get('code'), verifier: flow.verifier, nonce: flow.nonce,
    });
    return data.data;
  })();
  return completion;
}

export async function confirmGoogleAccount(ticket: string, password: string) {
  const { data } = await api.post<ApiResponse<GoogleSession>>('/auth/google/link', { ticket, password });
  return data.data;
}
