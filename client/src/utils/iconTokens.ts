/**
 * Icon Design Tokens for MusicWave
 * Handcrafted, consistent hierarchy across the application.
 */

export const ICON_SIZE = {
  /** 12-14px: Inline micro-indicators, small badges, timestamp icons */
  xs: 'w-3.5 h-3.5',
  /** 16px: Secondary buttons, table row actions, input field icons */
  sm: 'w-4 h-4',
  /** 18px: Sidebar navigation, topbar controls, card action icons */
  md: 'w-[18px] h-[18px]',
  /** 20px: Bottom mobile navigation, primary player secondary controls */
  lg: 'w-5 h-5',
  /** 24px: Master play buttons (medium), modal headers, empty state icons */
  xl: 'w-6 h-6',
  /** 28-32px: Hero headers, large empty states */
  '2xl': 'w-8 h-8',
} as const;

export const ICON_STROKE = {
  thin: 1.5,
  regular: 1.75,
  medium: 2,
} as const;

export const ICON_COLORS = {
  default: 'text-white',
  secondary: 'text-text-secondary',
  muted: 'text-text-muted',
  active: 'text-white',
  accent: 'text-primary-400',
  favorite: 'text-rose-500',
  danger: 'text-red-400',
  verified: 'text-sky-400',
} as const;
