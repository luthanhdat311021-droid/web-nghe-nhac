import React, { useEffect, useRef, useState } from 'react';
import { getLiveAnalyser } from '../../store/audioFxStore.js';
import { usePlayerStore } from '../../store/playerStore.js';

// Full-screen 3D visualizer: a pulsing particle sphere inside a ring of frequency bars, with a starfield.
// Real frequencies come from the Web Audio analyser when the song is routed through it (same-origin or CORS
// sources with Âm thanh Pro on). Other sources (most hosts, YouTube) cannot be read by the browser, so the
// scene is driven by a per-song rhythm model instead; the corner label says which one is running.

const BINS = 64;

const hashOf = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Average hue of the cover, or one derived from the song id when the image host blocks reading pixels. */
const coverHue = (url: string, fallbackSeed: string) =>
  new Promise<number>((resolve) => {
    const fallback = (hashOf(fallbackSeed) % 360) / 360;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 16;
        const c = canvas.getContext('2d')!;
        c.drawImage(img, 0, 0, 16, 16);
        const d = c.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max - min < 1) return resolve(fallback);
        const h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
        resolve((((h * 60) + 360) % 360) / 360);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = url;
  });

/** Rhythm model: a kick on every beat, snare-ish mids on 2 and 4, shimmering highs, all seeded per song. */
const simulateSpectrum = (out: Float32Array, t: number, seed: number, energy: number) => {
  const bpm = 92 + (seed % 37);
  const beat = (t * bpm) / 60;
  const phase = beat % 1;
  const kick = Math.exp(-phase * 7);
  const snare = Math.floor(beat) % 2 === 1 ? Math.exp(-phase * 9) : 0;
  const hat = Math.exp(-((beat * 2) % 1) * 12);
  for (let i = 0; i < BINS; i++) {
    const f = i / BINS;
    const wobble = 0.5 + 0.5 * Math.sin(t * (1.3 + f * 4) + i * 0.7 + (seed % 100));
    const body = Math.pow(1 - f, 1.6) * (0.35 + 0.65 * kick);
    const mid = Math.exp(-Math.pow((f - 0.35) / 0.18, 2)) * (0.25 + 0.6 * snare);
    const high = f * f * (0.15 + 0.5 * hat);
    out[i] = Math.min(1, (body + mid + high) * (0.75 + 0.35 * wobble) * energy);
  }
};

interface Visualizer3DProps {
  songId: string;
  coverUrl: string;
  isPlaying: boolean;
}

export const Visualizer3D: React.FC<Visualizer3DProps> = ({ songId, coverUrl, isPlaying }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(isPlaying);
  const hueRef = useRef((hashOf(songId) % 360) / 360);
  const [mode, setMode] = useState<'live' | 'simulated' | 'loading'>('loading');
  const [failed, setFailed] = useState(false);

  playingRef.current = isPlaying;

  useEffect(() => {
    let alive = true;
    coverHue(coverUrl, songId).then((h) => { if (alive) hueRef.current = h; });
    return () => { alive = false; };
  }, [coverUrl, songId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    import('three').then((THREE) => {
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        setFailed(true);
        return;
      }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07080c, 0.045);
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

      // 1. Particle sphere whose points push outward with the band under them.
      const sphereGeo = new THREE.IcosahedronGeometry(1.5, 24);
      const base = Float32Array.from(sphereGeo.attributes.position.array as Float32Array);
      const pointCount = base.length / 3;
      const bandOf = new Uint8Array(pointCount);
      for (let i = 0; i < pointCount; i++) {
        const y = base[i * 3 + 1] / 1.5; // bass around the equator, treble towards the poles
        bandOf[i] = Math.min(BINS - 1, Math.floor(Math.abs(y) * (BINS - 1)));
      }
      const sphereMat = new THREE.PointsMaterial({ size: 0.03, transparent: true, opacity: 0.7, depthWrite: false,
        blending: THREE.AdditiveBlending, vertexColors: true });
      const colors = new Float32Array(base.length);
      sphereGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const sphere = new THREE.Points(sphereGeo, sphereMat);
      scene.add(sphere);

      // 2. Ring of frequency bars around the sphere.
      const barGeo = new THREE.BoxGeometry(0.07, 1, 0.07);
      barGeo.translate(0, 0.5, 0);
      const barMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
      const bars = new THREE.InstancedMesh(barGeo, barMat, BINS * 2);
      const dummy = new THREE.Object3D();
      const barColor = new THREE.Color();
      scene.add(bars);

      // 3. Starfield.
      const starCount = 1400;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 12 + Math.random() * 50;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        starPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({ size: 0.09, color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      const resize = () => {
        const w = host.clientWidth || 1, h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        camera.aspect = w / h;
        // Keep the whole ring in frame on tall phone screens.
        camera.position.setLength(w < h ? 9.5 : 7.2);
        camera.updateProjectionMatrix();
      };
      camera.position.set(0, 1.4, 7.2);
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const raw = new Uint8Array(128);
      const target = new Float32Array(BINS);
      const level = new Float32Array(BINS);
      const pos = sphereGeo.attributes.position.array as Float32Array;
      const sphereColor = new THREE.Color();
      const seed = hashOf(songId);
      let energy = 0;
      let simTime = usePlayerStore.getState().currentTime || 0;
      let last = performance.now();
      let orbit = 0;
      let lastMode = '';
      let frame = 0;

      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const playing = playingRef.current;
        energy += ((playing ? 1 : 0.12) - energy) * Math.min(1, dt * 2.5);

        const analyser = getLiveAnalyser();
        const nextMode = analyser ? 'live' : 'simulated';
        if (nextMode !== lastMode) { lastMode = nextMode; setMode(nextMode); }
        if (analyser) {
          analyser.getByteFrequencyData(raw);
          // The top of the spectrum is mostly empty; spread the useful lower 3/4 across the bins.
          for (let i = 0; i < BINS; i++) target[i] = raw[Math.floor((i / BINS) * raw.length * 0.75)] / 255;
        } else {
          if (playing) simTime += dt;
          // Stay close to the real playhead so pauses and seeks keep the beat aligned.
          const head = usePlayerStore.getState().currentTime || 0;
          if (Math.abs(head - simTime) > 1.5) simTime = head;
          simulateSpectrum(target, simTime, seed, energy);
        }
        let bass = 0;
        for (let i = 0; i < BINS; i++) {
          const k = target[i] > level[i] ? 0.55 : 0.12; // fast attack, slow release
          level[i] += (target[i] - level[i]) * k;
          if (i < 8) bass += level[i] / 8;
        }

        const hue = hueRef.current;
        const t = now / 1000;
        for (let i = 0; i < pointCount; i++) {
          const push = 1 + level[bandOf[i]] * 0.55 + bass * 0.12 + Math.sin(t * 2 + i * 0.05) * 0.01;
          pos[i * 3] = base[i * 3] * push;
          pos[i * 3 + 1] = base[i * 3 + 1] * push;
          pos[i * 3 + 2] = base[i * 3 + 2] * push;
          sphereColor.setHSL((hue + level[bandOf[i]] * 0.25 + (bandOf[i] / BINS) * 0.15) % 1, 0.9, 0.32 + level[bandOf[i]] * 0.3);
          colors[i * 3] = sphereColor.r;
          colors[i * 3 + 1] = sphereColor.g;
          colors[i * 3 + 2] = sphereColor.b;
        }
        sphereGeo.attributes.position.needsUpdate = true;
        sphereGeo.attributes.color.needsUpdate = true;

        // Mirror the spectrum so the ring is symmetric: bass at the front and back, highs at the sides.
        for (let j = 0; j < BINS * 2; j++) {
          const bin = j < BINS ? j : BINS * 2 - 1 - j;
          const angle = (j / (BINS * 2)) * Math.PI * 2;
          const height = 0.06 + level[bin] * 1.9;
          dummy.position.set(Math.cos(angle) * 2.9, -0.15, Math.sin(angle) * 2.9);
          dummy.rotation.set(0, -angle, 0);
          dummy.scale.set(1, height, 1);
          dummy.updateMatrix();
          bars.setMatrixAt(j, dummy.matrix);
          bars.setColorAt(j, barColor.setHSL((hue + bin / BINS * 0.35) % 1, 0.9, 0.55));
        }
        bars.instanceMatrix.needsUpdate = true;
        if (bars.instanceColor) bars.instanceColor.needsUpdate = true;

        const speed = reduceMotion ? 0.03 : 0.12 + bass * 0.25;
        orbit += dt * speed;
        const dist = camera.position.length();
        camera.position.set(Math.sin(orbit) * dist * 0.96, 1.2 + Math.sin(orbit * 0.7) * 0.8, Math.cos(orbit) * dist * 0.96);
        camera.position.setLength(dist);
        camera.lookAt(0, 0.2, 0);
        sphere.rotation.y += dt * (reduceMotion ? 0.02 : 0.15);
        stars.rotation.y -= dt * 0.01;
        starMat.size = 0.08 + bass * 0.12;
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        [sphereGeo, barGeo, starGeo].forEach((g) => g.dispose());
        [sphereMat, barMat, starMat].forEach((m) => m.dispose());
        bars.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => setFailed(true));

    return () => {
      disposed = true;
      cleanup();
    };
  }, [songId]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c0d12]/40 via-transparent to-[#0c0d12]/95" />
      {!failed && mode !== 'loading' && (
        <span className="absolute top-[calc(env(safe-area-inset-top)+4rem)] left-1/2 -translate-x-1/2 rounded-full bg-black/40 border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/70">
          {mode === 'live' ? 'Phân tích âm thanh thật' : 'Hiệu ứng theo nhịp'}
        </span>
      )}
      {failed && (
        <p className="absolute top-1/3 inset-x-0 text-center text-xs text-text-muted">Thiết bị không hỗ trợ đồ họa 3D (WebGL).</p>
      )}
    </div>
  );
};
