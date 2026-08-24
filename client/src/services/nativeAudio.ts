import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAudioPlugin {
  play(options: { url: string; title: string; artist: string; position: number; volume: number }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seek(options: { position: number }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  getState(): Promise<{ isPlaying: boolean; position: number; duration: number; error?: string | null }>;
}

const plugin = registerPlugin<NativeAudioPlugin>('NativeAudio');

export const isNativeAudioAvailable = () => Capacitor.getPlatform() === 'android';

export const nativeAudio = {
  play: (options: Parameters<NativeAudioPlugin['play']>[0]) => plugin.play(options),
  pause: () => plugin.pause(),
  resume: () => plugin.resume(),
  stop: () => plugin.stop(),
  seek: (position: number) => plugin.seek({ position: Math.max(0, Math.round(position * 1000)) }),
  setVolume: (volume: number) => plugin.setVolume({ volume: Math.max(0, Math.min(1, volume)) }),
  getState: () => plugin.getState(),
};
