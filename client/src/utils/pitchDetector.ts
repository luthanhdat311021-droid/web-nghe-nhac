/**
 * Web Audio API Real-time Pitch Detection & Melody Analysis Engine
 * Uses optimized Autocorrelation with parabolic peak interpolation.
 * Runs 100% in-browser with zero server cost.
 */

export interface DetectedPitch {
  freq: number;          // Tần số Hz
  midi: number;          // MIDI float (ví dụ 69.2)
  roundedMidi: number;   // Số nguyên MIDI (ví dụ 69 = A4)
  noteName: string;      // Tên nốt (ví dụ "A4", "C#4")
  cents: number;         // Độ lệch cents (-50 đến +50)
  volume: number;        // Âm lượng RMS (0 đến 1)
  isVoiced: boolean;     // Có giọng người hát không (vượt ngưỡng âm lượng)
  clarity: number;       // 0–1: độ "rõ nốt" (đỉnh tự tương quan / năng lượng); nhạc nền lẫn lộn cho giá trị thấp
}

export interface TargetMelodyNote {
  id: string;
  word: string;
  startSec: number;
  durationSec: number;
  midi: number;
  noteName: string;
  freq: number;
}

export interface LineMelody {
  lineIndex: number;
  lineText: string;
  startSec: number;
  endSec: number;
  notes: TargetMelodyNote[];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Đổi tần số Hz thành MIDI note number
 */
export const freqToMidi = (freq: number): number => {
  return 69 + 12 * Math.log2(freq / 440);
};

/**
 * Đổi MIDI number thành tần số Hz
 */
export const midiToFreq = (midi: number): number => {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

/**
 * Đổi MIDI number thành tên nốt nhạc (vd: 60 -> C4, 69 -> A4)
 */
export const midiToNoteName = (midi: number): string => {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
};

/**
 * Tính khoảng cách cao độ tối thiểu giữa 2 nốt, có xét đến quãng tám (Octave Invariance)
 * Giúp ca sĩ giọng Nam hát thấp hơn ca sĩ giọng Nữ 1 quãng 8 vẫn được tính điểm trúng nốt!
 */
export const pitchDistanceInSemitones = (userMidi: number, targetMidi: number): number => {
  // Bỏ qua mọi chênh lệch quãng 8 (nam/nữ, hát thấp/cao vài quãng): chỉ so cùng tên nốt.
  const d = (((userMidi - targetMidi) % 12) + 12) % 12;
  return Math.min(d, 12 - d);
};

/** Dời nốt người hát lên/xuống từng quãng 8 cho gần nốt ca sĩ nhất, để vẽ hai nốt cạnh nhau. */
export const foldToOctaveOf = (midi: number, targetMidi: number): number =>
  midi + 12 * Math.round((targetMidi - midi) / 12);

/**
 * Thuật toán Autocorrelation phát hiện tần số cơ bản (F0) từ buffer âm thanh của micro
 */
export const detectPitchFromBuffer = (
  buffer: Float32Array,
  sampleRate: number,
  volumeThreshold = 0.012
): DetectedPitch | null => {
  const bufferSize = buffer.length;

  // 1. Tính RMS để kiểm tra mức âm lượng (loại bỏ tiếng ồn nền & khoảng lặng)
  let sumSquares = 0;
  for (let i = 0; i < bufferSize; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSquares / bufferSize);

  if (rms < volumeThreshold) {
    return null;
  }

  // 2. Cắt bớt phần đầu / đuôi có biên độ quá nhỏ
  let r1 = 0;
  let r2 = bufferSize - 1;
  const clipThreshold = 0.2;
  for (let i = 0; i < bufferSize / 2; i++) {
    if (Math.abs(buffer[i]) < clipThreshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < bufferSize / 2; i++) {
    if (Math.abs(buffer[bufferSize - i]) < clipThreshold) {
      r2 = bufferSize - i;
      break;
    }
  }
  const trimmed = buffer.subarray(r1, r2);
  // Chỉ cần các độ trễ tới chu kỳ của 80 Hz: tính hết cả buffer tốn gấp ~3 lần mà không dùng tới.
  const lagLimit = Math.min(trimmed.length, Math.floor(sampleRate / 80) + 2);
  const c = new Float32Array(lagLimit);

  // 3. Tự tương quan (Autocorrelation)
  for (let i = 0; i < lagLimit; i++) {
    let sum = 0;
    for (let j = 0; j < trimmed.length - i; j++) {
      sum += trimmed[j] * trimmed[j + i];
    }
    c[i] = sum;
  }

  // 4. Tìm điểm cực tiểu đầu tiên để vượt qua đỉnh tại lag = 0
  let d = 0;
  while (d < c.length - 1 && c[d] > c[d + 1]) {
    d++;
  }

  // 5. Tìm đỉnh cực đại sau điểm cực tiểu trong dải tần số giọng hát (80Hz - 1000Hz)
  const minPeriod = Math.floor(sampleRate / 1000); // ~1000Hz (C6)
  const maxPeriod = Math.floor(sampleRate / 80);   // ~80Hz (E2)
  const searchStart = Math.max(d, minPeriod);
  const searchEnd = Math.min(c.length - 1, maxPeriod);

  let maxVal = -1;
  let maxPos = -1;

  for (let i = searchStart; i < searchEnd; i++) {
    if (c[i] > maxVal && c[i] > c[i - 1] && c[i] > c[i + 1]) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos === -1 || maxVal < 0.01) {
    return null;
  }

  // 6. Nội suy parabol (Parabolic interpolation) quanh đỉnh để đạt độ mịn tần số cao
  const y1 = c[maxPos - 1];
  const y2 = c[maxPos];
  const y3 = c[maxPos + 1];
  const delta = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
  const exactPeriod = maxPos + delta;

  const freq = sampleRate / exactPeriod;

  // Giới hạn trong khoảng giọng người hát khả thi (80Hz - 1050Hz)
  if (freq < 75 || freq > 1100) {
    return null;
  }

  const midi = freqToMidi(freq);
  const roundedMidi = Math.round(midi);
  const noteName = midiToNoteName(roundedMidi);
  const cents = Math.round((midi - roundedMidi) * 100);

  return {
    freq,
    midi,
    roundedMidi,
    noteName,
    cents,
    volume: Math.min(1, rms * 8),
    isVoiced: true,
    clarity: c[0] > 0 ? Math.max(0, Math.min(1, maxVal / c[0])) : 0,
  };
};

/**
 * Sinh chuỗi nốt giai điệu mục tiêu (Target Melody) hài hòa cho các câu hát
 * Dựa trên thuật toán tất định (deterministic) từ lời bài hát và mã ID của bài hát.
 * Đảm bảo mọi người trong phòng Jam và mỗi lần hát đều so sánh với cùng một giai điệu chuẩn.
 */
export const generateMelodyForLines = (
  songId: string,
  lines: { time: number; text: string }[],
  totalDuration = 240
): LineMelody[] => {
  // Bộ âm giai chuẩn thân thiện với giọng hát (quãng C4 - G4 - A4 - C5)
  // Đô (60), Rê (62), Mi (64), Fa (65), Sol (67), La (69), Si (71), Đô (72)
  const PENTATONIC_SCALE = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 to C5

  // Băm chuỗi đơn giản để tạo seed
  let hash = 0;
  for (let i = 0; i < songId.length; i++) {
    hash = (hash << 5) - hash + songId.charCodeAt(i);
    hash |= 0;
  }

  return lines.map((line, lineIdx) => {
    const nextLine = lines[lineIdx + 1];
    const lineEnd = Math.min(
      nextLine ? nextLine.time : line.time + 6,
      line.time + 6,
      totalDuration
    );
    const lineDuration = Math.max(1.2, lineEnd - line.time);

    // Tách các từ trong câu hát
    const words = line.text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const noteCount = Math.max(1, words.length);
    const noteDuration = lineDuration / noteCount;

    // Tạo các nốt lượn mượt mà cho câu
    let currentScaleIdx = Math.abs(hash + lineIdx * 3) % PENTATONIC_SCALE.length;
    const notes: TargetMelodyNote[] = [];

    words.forEach((word, wordIdx) => {
      // Biến thiên nốt liền kề để giai điệu tự nhiên, êm tai
      const wordHash = word.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const step = (wordHash % 3) - 1; // -1, 0, hoặc +1
      currentScaleIdx = Math.max(
        0,
        Math.min(PENTATONIC_SCALE.length - 1, currentScaleIdx + step)
      );

      const midi = PENTATONIC_SCALE[currentScaleIdx];
      const noteName = midiToNoteName(midi);
      const freq = midiToFreq(midi);

      notes.push({
        id: `${lineIdx}-${wordIdx}`,
        word,
        startSec: line.time + wordIdx * noteDuration,
        durationSec: noteDuration,
        midi,
        noteName,
        freq,
      });
    });

    return {
      lineIndex: lineIdx,
      lineText: line.text,
      startSec: line.time,
      endSec: lineEnd,
      notes,
    };
  });
};

