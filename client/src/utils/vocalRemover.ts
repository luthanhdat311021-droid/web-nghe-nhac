/**
 * MusicWave Karaoke Audio Engine
 * Real-time vocal remover ("beat only") using the Web Audio API, in the browser with no added latency.
 *
 * Vocals are usually mixed dead-centre (identical in left and right), so L − R cancels them while
 * keeping instruments panned to the sides. Bass and kick are also centred and would vanish too, so the
 * low end (< 220 Hz) is added back from the original signal.
 *
 * A media element accepts only one MediaElementSource ever, so this engine borrows the element's shared
 * source from the audio FX store (the same one the Music Pro EQ uses) and re-routes it:
 *   normal:     source ──────────────────────────────────────────────► gain → EQ → out
 *   beat only:  source → L−R → vocal-band dip ─┬──────────────────────► gain → EQ → out
 *              source → low-pass 220 Hz ───────┘
 */
import { getElementAudioNodes } from '../store/audioFxStore.js';

const AUDIO_ID = 'musicwave-html5-audio';

interface CutChain {
  inputs: AudioNode[]; // what the source feeds in beat mode
  output: GainNode;
}

class KaraokeAudioEngine {
  private isBeatModeActive = false;
  private chains = new WeakMap<HTMLMediaElement, CutChain>();
  private routedElement: HTMLMediaElement | null = null;
  // Reference tap: the original mix, band-limited to the singing range, for reading the singer's pitch.
  // It hangs off the source directly, so it still hears the vocals while beat-only mode removes them.
  private taps = new WeakMap<HTMLMediaElement, { input: AudioNode; analyser: AnalyserNode }>();

  /**
   * Analyser carrying the song's original vocals (mid channel, ~120–1000 Hz), or null when the song cannot be
   * processed (YouTube, hosts without CORS, iOS). The karaoke scorer reads the singer's pitch from it.
   */
  public getReferenceAnalyser(): AnalyserNode | null {
    const el = document.getElementById(AUDIO_ID) as HTMLMediaElement | null;
    const nodes = getElementAudioNodes(el);
    if (!el || !nodes) return null;
    let tap = this.taps.get(el);
    if (!tap) {
      const highpass = nodes.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 120;
      const lowpass = nodes.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1000;
      const analyser = nodes.ctx.createAnalyser();
      analyser.fftSize = 2048; // downmixes L+R to mono: the centred lead vocal is strongest there
      highpass.connect(lowpass).connect(analyser);
      tap = { input: highpass, analyser };
      this.taps.set(el, tap);
      nodes.source.connect(tap.input);
    }
    return tap.analyser;
  }

  /** source.disconnect() drops every branch; put the reference tap back after re-routing. */
  private reconnectTap(el: HTMLMediaElement, source: AudioNode) {
    const tap = this.taps.get(el);
    if (tap) source.connect(tap.input);
  }

  private buildChain(ctx: AudioContext, target: AudioNode): CutChain {
    const splitter = ctx.createChannelSplitter(2);
    const inverter = ctx.createGain();
    inverter.gain.value = -1;
    const sideSum = ctx.createGain(); // L + (−R) = L − R, mono
    splitter.connect(sideSum, 0);
    splitter.connect(inverter, 1);
    inverter.connect(sideSum);

    // Residual vocal energy (reverb, slight stereo spread) sits around 1–3 kHz: dip it further.
    const vocalDip = ctx.createBiquadFilter();
    vocalDip.type = 'peaking';
    vocalDip.frequency.value = 1500;
    vocalDip.Q.value = 0.7;
    vocalDip.gain.value = -9;
    sideSum.connect(vocalDip);

    const bass = ctx.createBiquadFilter();
    bass.type = 'lowpass';
    bass.frequency.value = 220;
    bass.Q.value = 0.7;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.9;
    bass.connect(bassGain);

    // The side signal is quieter than the full mix; lift it back to a comparable loudness.
    const output = ctx.createGain();
    output.gain.value = 1.6;
    vocalDip.connect(output);
    bassGain.connect(output);
    output.connect(target);
    return { inputs: [splitter, bass], output };
  }

  /**
   * Turn beat-only mode on or off for the element playing now.
   * Returns false when the song cannot be processed (YouTube, a host without CORS, iOS): it keeps its vocals.
   */
  public setBeatOnly(enabled: boolean): boolean {
    this.isBeatModeActive = enabled;
    return this.apply();
  }

  /** Re-applies the current mode, e.g. after the player switched to a new <audio> element for the next song. */
  public apply(): boolean {
    const el = document.getElementById(AUDIO_ID) as HTMLMediaElement | null;
    if (!this.isBeatModeActive) {
      this.restore(this.routedElement);
      if (el !== this.routedElement) this.restore(el);
      this.routedElement = null;
      return true;
    }
    if (this.routedElement && this.routedElement !== el) this.restore(this.routedElement);
    const nodes = getElementAudioNodes(el);
    if (!el || !nodes) return false;
    let chain = this.chains.get(el);
    if (!chain) {
      chain = this.buildChain(nodes.ctx, nodes.gain);
      this.chains.set(el, chain);
    }
    nodes.source.disconnect();
    chain.inputs.forEach((input) => nodes.source.connect(input));
    this.reconnectTap(el, nodes.source);
    this.routedElement = el;
    return true;
  }

  private restore(el: HTMLMediaElement | null) {
    if (!el || !this.chains.has(el)) return;
    const nodes = getElementAudioNodes(el);
    if (!nodes) return;
    nodes.source.disconnect();
    nodes.source.connect(nodes.gain);
    this.reconnectTap(el, nodes.source);
  }

  public isBeatOnly(): boolean {
    return this.isBeatModeActive;
  }
}

export const karaokeAudioEngine = new KaraokeAudioEngine();
