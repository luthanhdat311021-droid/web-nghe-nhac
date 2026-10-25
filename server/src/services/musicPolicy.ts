export const PRO_PRICE = 50000;
export const PRO_DAYS = 30;
export const FREE_LIMIT = 3;
export const FREE_PLAYLIST_LIMIT = 3;
export const AD_SECONDS = 10;
export const vietnamDay = (now = new Date()) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const isPro = (expires: Date | null, now = new Date()) => !!expires && expires > now;
export const extendPro = (expires: Date | null, now = new Date()) => new Date(Math.max(expires?.getTime() || 0, now.getTime()) + PRO_DAYS * 86400000);
export const paymentCode = (value: string) => value.toUpperCase().match(/MW[A-F0-9]{24}(?![A-F0-9])/g) || [];
// Bank timestamps can be minute-rounded or skewed from the server clock.
export const PAYMENT_CLOCK_SKEW_MS = 5 * 60000;
