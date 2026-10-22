import React, { useEffect, useRef, useState } from 'react';
import { Send, Smile, Sticker } from 'lucide-react';

// Animated Noto emoji (Apache 2.0) served by Google Fonts; must match JAM_STICKERS on the server.
export const STICKERS = [
  '1f600', '1f602', '1f923', '1f60d', '1f970', '1f618', '1f973', '1f60e', '1f929', '1f62d', '1f97a', '1f631',
  '1f621', '1f634', '1f914', '1f92f', '1f525', '2764_fe0f', '1f494', '1f44f', '1f64c', '1f44d', '1f389', '1f3b6',
  '1f483', '1f4af', '2728', '1f308', '1f680',
];
const NOTO = 'https://fonts.gstatic.com/s/e/notoemoji/latest';
export const stickerStill = (id: string) => `${NOTO}/${id}/emoji.svg`;
export const stickerAnimated = (id: string) => `${NOTO}/${id}/512.webp`;

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Cảm xúc', emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇', '🙂', '😉', '😌', '😴', '🤔', '🤯', '😮', '😱', '😢', '😭', '🥺', '😡', '😤', '🙄', '😅', '🤗', '🤭', '😜'] },
  { label: 'Cử chỉ', emojis: ['👍', '👎', '👏', '🙌', '🙏', '🤝', '✌️', '🤘', '👌', '🤙', '💪', '👋', '🫶', '🤞', '☝️', '👀'] },
  { label: 'Âm nhạc', emojis: ['🎵', '🎶', '🎧', '🎤', '🎸', '🎹', '🥁', '🎷', '🎺', '🎻', '💃', '🕺', '🪩', '📻', '🔊', '🎼'] },
  { label: 'Trái tim & khác', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💯', '🔥', '✨', '⭐', '🌈', '🎉', '🎊', '🚀', '☕', '🌙', '🌧️', '🍀'] },
];

interface ChatComposerProps {
  onSendText: (text: string) => Promise<void>;
  onSendSticker: (id: string) => Promise<void>;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({ onSendText, onSendSticker }) => {
  const [text, setText] = useState('');
  const [panel, setPanel] = useState<'emoji' | 'sticker' | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the picker when clicking anywhere outside the composer.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPanel(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [panel]);

  const run = async (fn: () => Promise<void>) => {
    setSending(true);
    try {
      await fn();
      setError('');
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không gửi được tin nhắn.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    if (await run(() => onSendText(value))) setText('');
    setPanel(null);
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + emoji + text.slice(end)).slice(0, 300);
    setText(next);
    requestAnimationFrame(() => {
      input?.focus();
      const caret = Math.min(next.length, start + emoji.length);
      input?.setSelectionRange(caret, caret);
    });
  };

  const sendSticker = async (id: string) => {
    if (sending) return;
    if (await run(() => onSendSticker(id))) setPanel(null);
  };

  const toggle = (which: 'emoji' | 'sticker') => setPanel((p) => (p === which ? null : which));
  const toolClass = (active: boolean) =>
    `w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
      active ? 'bg-emerald-400/20 text-emerald-300' : 'text-text-muted hover:text-white hover:bg-white/5'
    }`;

  return (
    <div ref={rootRef} className="relative p-3 border-t border-white/10 space-y-1">
      {panel && (
        <div className="absolute bottom-full left-2 right-2 mb-2 rounded-2xl border border-white/10 bg-background-elevated shadow-2xl p-3 max-h-72 overflow-y-auto z-20">
          {panel === 'emoji' ? (
            <div className="space-y-3">
              {EMOJI_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">{g.label}</p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {g.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="aspect-square rounded-lg text-xl hover:bg-white/10 active:scale-90 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Nhãn dán: bấm để thả vào phòng</p>
              <div className="grid grid-cols-5 gap-1.5">
                {STICKERS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled={sending}
                    onClick={() => sendSticker(id)}
                    aria-label={`Nhãn dán ${id}`}
                    className="aspect-square rounded-xl p-1.5 hover:bg-white/10 active:scale-90 transition-transform disabled:opacity-50"
                  >
                    <img src={stickerStill(id)} alt="" loading="lazy" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <button type="button" onClick={() => toggle('emoji')} aria-label="Biểu tượng cảm xúc" className={toolClass(panel === 'emoji')}>
          <Smile className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => toggle('sticker')} aria-label="Nhãn dán" className={toolClass(panel === 'sticker')}>
          <Sticker className="w-5 h-5" />
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Nhắn gì đó…"
          className="flex-1 min-w-0 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-emerald-300/60"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Gửi"
          className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-400 text-black flex items-center justify-center active:scale-95 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
};
