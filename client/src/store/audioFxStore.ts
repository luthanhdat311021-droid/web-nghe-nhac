import { create } from 'zustand';
import { useAuthStore } from './authStore.js';

// Music Pro audio effects: a 10-band equalizer (Web Audio) and crossfade between songs.
// Browsers only let Web Audio read media from the page's own origin or CORS-enabled hosts; anything else
// comes out silent. So the EQ runs only for such sources, while crossfade uses element.volume and works for
// every HTML5 source. YouTube sources play inside YouTube's iframe and support neither.

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_PRESETS: Record<string, { label: string; gains: number[] }> = {
  flat: { label: 'Mặc định', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  bass: { label: 'Bass Boost', gains: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0] },
  vocal: { label: 'Giọng hát', gains: [-2, -2, -1, 1, 3, 4, 4, 2, 0, -1] },
  acoustic: { label: 'Acoustic', gains: [3, 3, 2, 1, 1, 1, 2, 3, 3, 2] },
  electronic: { label: 'Electronic', gains: [5, 4, 1, 0, -2, 1, 0, 1, 4, 5] },
  treble: { label: 'Treble Boost', gains: [0, 0, 0, 0, 0, 1, 3, 4, 5, 6] },
};
const STORAGE_KEY = 'musicwave_audio_fx_v1';
export const MAX_CROSSFADE = 12;

interface FxSettings {
  enabled: boolean;
  preset: string;
  gains: number[];
  crossfade: number; // seconds, 0 = off
}

const loadSettings = (): FxSettings => {
  const fallback = { enabled: false, preset: 'flat', gains: [...EQ_PRESETS.flat.gains], crossfade: 6 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.gains) && saved.gains.length === EQ_BANDS.length) return { ...fallback, ...saved };
  } catch {}
  return fallback;
};

export const isProUser = () => {
  const expires = useAuthStore.getState().user?.proExpiresAt;
  return !!expires && new Date(expires).getTime() > Date.now();
};

// ---------------------------------------------------------------------------
// Web Audio graph: every <audio> element -> its own gain (for fades) -> shared EQ chain -> output
// ---------------------------------------------------------------------------
let ctx: AudioContext | null = null;
let filters: BiquadFilterNode[] = [];
const nodes = new WeakMap<HTMLMediaElement, { source: MediaElementAudioSourceNode; gain: GainNode }>();
let fadeInArmedUntil = 0;
let fadeInSeconds = 0;

// Hosts known to send CORS headers for audio (Supabase Storage); same-origin media always qualifies.
const CORS_AUDIO_HOSTS = [/\.supabase\.co$/i];

/** Whether Web Audio may process this source without being silenced by the browser. */
export const canProcessSource = (url?: string | null) => {
  if (!url) return false;
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin || CORS_AUDIO_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
};
const isSameOrigin = (url: string) => {
  try { return new URL(url, window.location.href).origin === window.location.origin; } catch { return false; }
};

const applyGains = (gains: number[]) => {
  filters.forEach((f, i) => f.gain.setTargetAtTime(gains[i] || 0, ctx!.currentTime, 0.05));
};

// Must run inside a user gesture the first time, otherwise the context stays suspended (silence).
export const ensureAudioContext = () => {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    filters = EQ_BANDS.map((freq, i) => {
      const f = ctx!.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.1;
      return f;
    });
    filters.reduce((prev, next) => (prev.connect(next), next));
    filters[filters.length - 1].connect(ctx.destination);
    applyGains(useAudioFxStore.getState().gains);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

export const fxActive = () => useAudioFxStore.getState().enabled && isProUser();

/**
 * Route an <audio> element through the EQ. Once attached it stays attached (a Web Audio rule), so callers
 * must only attach elements whose source is processable and must swap elements before loading one that isn't.
 */
export const attachAudioElement = (el: HTMLMediaElement | null) => {
  if (!el || nodes.has(el) || !fxActive() || !ctx || ctx.state !== 'running') return;
  const src = el.currentSrc || el.src;
  // A cross-origin source loaded without the crossorigin attribute would be silenced, even from a CORS host.
  if (src && (!canProcessSource(src) || (!isSameOrigin(src) && el.crossOrigin !== 'anonymous'))) return;
  try {
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    source.connect(gain).connect(filters[0]);
    nodes.set(el, { source, gain });
  } catch (e) {
    console.warn('[MusicWave FX] Cannot attach audio element:', e);
  }
};

export const isAttached = (el: HTMLMediaElement | null) => !!el && nodes.has(el);

// Volume ramps work for every source (no CORS needed), unlike Web Audio gain.
const rampVolume = (el: HTMLMediaElement, from: number, to: number, seconds: number, done?: () => void) => {
  const start = performance.now();
  el.volume = Math.max(0, Math.min(1, from));
  const timer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / (seconds * 1000));
    // Equal-power curve keeps the perceived loudness steady while two songs overlap.
    const curve = to > from ? Math.sin((k * Math.PI) / 2) : Math.cos((k * Math.PI) / 2);
    el.volume = Math.max(0, Math.min(1, to > from ? from + (to - from) * curve : to + (from - to) * curve));
    if (k >= 1) {
      clearInterval(timer);
      done?.();
    }
  }, 50);
  return () => clearInterval(timer);
};

/** Fade an element to silence, then hand it back for cleanup. */
export const fadeOutElement = (el: HTMLMediaElement, seconds: number, done: () => void) => {
  rampVolume(el, el.volume, 0, seconds, () => {
    const node = nodes.get(el);
    if (node) try { node.source.disconnect(); node.gain.disconnect(); } catch {}
    done();
  });
};

/** The next song that starts within the window fades in instead of starting at full volume. */
export const armFadeIn = (seconds: number) => {
  fadeInSeconds = seconds;
  fadeInArmedUntil = Date.now() + 20000;
};

export const isFadeInArmed = () => Date.now() <= fadeInArmedUntil;

/** Called once the new song is playing: fades it in if a crossfade armed it. */
export const runArmedFadeIn = (el: HTMLMediaElement, targetVolume: number) => {
  if (Date.now() > fadeInArmedUntil) return;
  fadeInArmedUntil = 0;
  rampVolume(el, 0, targetVolume, fadeInSeconds);
};

/** Seconds of crossfade to use right now, or 0 when it must not run. */
export const activeCrossfadeSeconds = () => {
  const s = useAudioFxStore.getState();
  return fxActive() && !s.crossfadeBlocked ? s.crossfade : 0;
};

// ---------------------------------------------------------------------------
// Settings store (per-device preference)
// ---------------------------------------------------------------------------
interface AudioFxState extends FxSettings {
  isPanelOpen: boolean;
  crossfadeBlocked: boolean; // e.g. while following a host in a Jam room
  setEnabled: (enabled: boolean) => void;
  setPreset: (preset: string) => void;
  setBandGain: (index: number, gain: number) => void;
  setCrossfade: (seconds: number) => void;
  setCrossfadeBlocked: (blocked: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
}

const persist = (s: FxSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: s.enabled, preset: s.preset, gains: s.gains, crossfade: s.crossfade }));
  } catch {}
};

export const useAudioFxStore = create<AudioFxState>((set, get) => ({
  ...loadSettings(),
  isPanelOpen: false,
  crossfadeBlocked: false,
  setEnabled: (enabled) => {
    set({ enabled });
    persist(get());
    if (enabled) {
      ensureAudioContext();
      attachAudioElement(document.getElementById('musicwave-html5-audio') as HTMLAudioElement | null);
    }
    applyGains(enabled ? get().gains : EQ_PRESETS.flat.gains);
  },
  setPreset: (preset) => {
    const gains = [...(EQ_PRESETS[preset] || EQ_PRESETS.flat).gains];
    set({ preset, gains });
    persist(get());
    if (ctx && get().enabled) applyGains(gains);
  },
  setBandGain: (index, gain) => {
    const gains = get().gains.map((g, i) => (i === index ? gain : g));
    set({ gains, preset: 'custom' });
    persist(get());
    if (ctx && get().enabled) applyGains(gains);
  },
  setCrossfade: (crossfade) => {
    set({ crossfade: Math.max(0, Math.min(MAX_CROSSFADE, crossfade)) });
    persist(get());
  },
  setCrossfadeBlocked: (crossfadeBlocked) => set({ crossfadeBlocked }),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
}));

// A reloaded page cannot start an AudioContext on its own; wake it on the first interaction.
if (typeof window !== 'undefined') {
  const wake = () => {
    if (!fxActive()) return;
    ensureAudioContext();
    attachAudioElement(document.getElementById('musicwave-html5-audio') as HTMLAudioElement | null);
  };
  window.addEventListener('pointerdown', wake, { capture: true });
  window.addEventListener('keydown', wake, { capture: true });
}
