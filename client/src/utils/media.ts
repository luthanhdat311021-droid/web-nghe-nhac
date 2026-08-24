import { Capacitor } from '@capacitor/core';

/**
 * Resolves media URLs (audio, cover art, uploads) to ensure full reachable URLs
 * when running inside Android WebView (Capacitor) or Web browser.
 */
export const getMediaUrl = (url?: string | null): string => {
  if (!url) return '';

  let resolved = url;

  // If running inside Android emulator, localhost / 127.0.0.1 must point to host machine (10.0.2.2)
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    if (resolved.includes('localhost:5000')) {
      resolved = resolved.replace('localhost:5000', '10.0.2.2:5000');
    } else if (resolved.includes('127.0.0.1:5000')) {
      resolved = resolved.replace('127.0.0.1:5000', '10.0.2.2:5000');
    }
  }

  if (
    resolved.startsWith('http://') ||
    resolved.startsWith('https://') ||
    resolved.startsWith('blob:') ||
    resolved.startsWith('data:')
  ) {
    return resolved;
  }

  let rawApiUrl = import.meta.env.VITE_API_URL || '';
  if (!rawApiUrl && Capacitor.isNativePlatform()) {
    rawApiUrl = 'https://musicwave-app.vercel.app/api';
  }
  const baseUrl = rawApiUrl ? rawApiUrl.replace(/\/api\/?$/, '') : 'https://musicwave-app.vercel.app';
  const cleanUrl = resolved.startsWith('/') ? resolved : `/${resolved}`;

  return `${baseUrl}${cleanUrl}`;
};

