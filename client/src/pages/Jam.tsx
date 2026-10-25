import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Users, Copy, Check, LogOut, Crown, Music2, Plus, Radio, Play, ListPlus } from 'lucide-react';
import { useJamStore, useQuizMask } from '../store/jamStore.js';
import { QuizPanel } from '../components/jam/QuizPanel.js';
import { SongPicker } from '../components/jam/SongPicker.js';
import { useAuthStore } from '../store/authStore.js';
import { usePlayerStore, useCurrentSong, useIsPlaying } from '../store/playerStore.js';
import { Song } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { ChatComposer, stickerAnimated, stickerStill } from '../components/jam/ChatComposer.js';

// A short message made only of emoji is shown large, like in most chat apps.
const isOnlyEmoji = (text: string) =>
  text.length <= 12 && /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u.test(text) && /\p{Extended_Pictographic}/u.test(text);

const avatarOf =(u?: { username: string; avatarUrl: string | null } | null) =>
  u?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u?.username || '?')}`;

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const createRoom = useJamStore((s) => s.createRoom);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const code = await createRoom();
      navigate(`/jam/${code}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tạo được phòng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/15 via-cyan-500/10 to-purple-500/10 p-6 sm:p-10">
        <Users className="text-emerald-300 w-10 h-10 mb-4" />
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Nghe chung, cùng một nhịp.</h1>
        <p className="text-text-secondary mt-3 max-w-xl">
          Tạo phòng, gửi link cho bạn bè. Mọi người nghe cùng một bài, cùng một giây, cùng thêm bài và trò chuyện.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Tạo phòng mới</h2>
          <p className="text-sm text-text-muted">Bạn là chủ phòng: nhạc bạn phát sẽ được phát cho mọi người trong phòng.</p>
          <Button variant="primary" onClick={handleCreate} disabled={busy} className="w-full">
            {busy ? 'Đang tạo…' : 'Tạo phòng nghe chung'}
          </Button>
        </div>
        <form
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const code = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (code.length === 6) navigate(`/jam/${code}`);
            else setError('Mã phòng gồm 6 ký tự.');
          }}
        >
          <h2 className="text-lg font-bold text-white">Vào phòng bằng mã</h2>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="VD: K7M2QX"
            className="w-full rounded-xl bg-black/20 border border-white/10 p-3 text-center text-xl font-mono tracking-[0.4em] text-white placeholder:text-text-muted placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-emerald-300/60"
          />
          <Button type="submit" variant="secondary" className="w-full">Vào phòng</Button>
        </form>
      </div>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      <p className="text-xs text-text-muted">
        Mỗi người nghe trên tài khoản của mình: tài khoản Free vẫn tính lượt nghe và quảng cáo theo quy định của Music Pro.
      </p>
    </div>
  );
};

const actionClass = 'flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors active:scale-95 flex items-center gap-1';

/** Host picks what the room hears (play now or queue); guests suggest songs to the host's queue. */
const RoomMusicBox: React.FC<{ isHost: boolean }> = ({ isHost }) => {
  const addSong = useJamStore((s) => s.addSong);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const [notice, setNotice] = useState('');
  const upNext = queue.slice(queueIndex + 1, queueIndex + 6);

  const suggest = async (song: Song) => {
    try {
      setNotice(await addSong(song.id));
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Không thêm được bài hát.');
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
        {isHost ? 'Chọn nhạc cho phòng' : 'Đề xuất bài cho phòng'}
      </h3>
      <SongPicker
        renderActions={(song) =>
          isHost ? (
            <>
              <button
                onClick={() => { usePlayerStore.getState().playSong(song); setNotice(`Đang phát "${song.title}" cho cả phòng.`); }}
                aria-label={`Phát ngay ${song.title}`}
                className={`${actionClass} bg-emerald-400 text-black hover:bg-emerald-300`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Phát
              </button>
              <button
                onClick={() => { usePlayerStore.getState().addToQueue(song); setNotice(`Đã thêm "${song.title}" vào hàng chờ.`); }}
                aria-label={`Thêm ${song.title} vào hàng chờ`}
                className={`${actionClass} border border-white/15 text-white hover:bg-white/10`}
              >
                <ListPlus className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => suggest(song)}
              aria-label={`Đề xuất ${song.title}`}
              className={`${actionClass} border border-emerald-300/40 text-emerald-300 hover:bg-emerald-400/10`}
            >
              <Plus className="w-3.5 h-3.5" /> Đề xuất
            </button>
          )
        }
      />
      {notice && <p className="text-xs text-emerald-300" role="status">{notice}</p>}
      {isHost && upNext.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Tiếp theo</p>
          {upNext.map((song, i) => (
            <div key={`${song.id}-${i}`} className="flex min-w-0 items-center gap-2 text-xs">
              <span className="w-4 text-text-muted">{i + 1}</span>
              <span className="truncate text-white">{song.title}</span>
              <span className="truncate text-text-muted">· {song.artist?.name}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-text-muted">
        {isHost
          ? 'Bấm "Phát" để cả phòng nghe ngay, hoặc thêm vào hàng chờ. Bài khách đề xuất cũng tự vào hàng chờ của bạn.'
          : 'Bài bạn đề xuất sẽ vào hàng chờ của chủ phòng. Bạn cũng có thể dùng menu ⋮ của bất kỳ bài nào → "Thêm vào phòng nghe chung".'}
      </p>
    </div>
  );
};

const Room: React.FC<{ code: string }> = ({ code }) => {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const { isHost, roomSong, roomPlaying, members, messages, ended, leaveRoom, sendMessage, sendSticker } = useJamStore();
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const playbackError = usePlayerStore((s) => s.playbackError);
  const [copied, setCopied] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const maskedRoomSong = useQuizMask(roomSong);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const link = `${window.location.origin}/jam/${code}`;
  const copyLink = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Nghe chung trên MusicWave', url: link });
      else await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/jam');
  };

  if (ended) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <Radio className="w-10 h-10 mx-auto text-text-muted" />
        <h2 className="text-xl font-bold text-white">Phòng nghe chung đã kết thúc</h2>
        <p className="text-sm text-text-muted">Chủ phòng đã đóng phòng hoặc đã rời đi quá lâu.</p>
        <Button variant="primary" onClick={() => { useJamStore.getState().reset(); navigate('/jam'); }}>Tạo hoặc vào phòng khác</Button>
      </div>
    );
  }

  const shownSong = isHost ? currentSong : maskedRoomSong;
  const shownPlaying = isHost ? isPlaying : roomPlaying;

  return (
    // minmax(0, …) columns: a long song title must truncate, not widen the page past a phone screen.
    <div className="max-w-6xl mx-auto pb-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
      <div className="space-y-5 min-w-0">
        <div className="rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/10 to-transparent p-5 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Phòng nghe chung</p>
            <p className="text-3xl font-mono font-black tracking-[0.3em] text-white">{code}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={copyLink} leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
              {copied ? 'Đã sao chép' : 'Mời bạn bè'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLeave} leftIcon={<LogOut className="w-4 h-4" />}>
              {isHost ? 'Đóng phòng' : 'Rời phòng'}
            </Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 p-5 flex items-center gap-5">
          {shownSong && <img src={shownSong.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-125" />}
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
            {shownSong ? <img src={shownSong.coverUrl} alt={shownSong.title} className="w-full h-full object-cover" /> : <Music2 className="w-8 h-8 text-text-muted" />}
          </div>
          <div className="relative min-w-0 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {shownSong ? (shownPlaying ? 'Đang phát cho cả phòng' : 'Đang tạm dừng') : 'Chưa phát bài nào'}
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-white truncate">{shownSong?.title || '—'}</h2>
            <p className="text-sm text-text-secondary truncate">{shownSong?.artist?.name}</p>
            <p className="text-xs text-text-muted pt-1">
              {isHost
                ? 'Bạn là chủ phòng: phát, tạm dừng, tua hay chuyển bài đều được đồng bộ cho mọi người.'
                : 'Chủ phòng đang điều khiển nhạc; máy bạn tự đồng bộ theo.'}
            </p>
            {!isHost && playbackError && <p className="text-xs text-rose-300">{playbackError}</p>}
          </div>
        </div>

        <QuizPanel />

        <RoomMusicBox isHost={isHost} />

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider px-1">Đang nghe ({members.length})</h3>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/10 pl-1 pr-3 py-1">
                <img src={avatarOf(m)} alt="" className="w-7 h-7 rounded-full bg-white/5" />
                <span className="text-xs font-semibold text-white">{m.username}{m.id === me?.id ? ' (bạn)' : ''}</span>
                {m.isHost && <Crown className="w-3.5 h-3.5 text-amber-300" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col h-[60vh] lg:h-[calc(100vh-12rem)] lg:sticky lg:top-0">
        <div className="px-4 py-3 border-b border-white/10 text-sm font-bold text-white">Trò chuyện</div>
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && <p className="text-xs text-text-muted text-center py-8">Chưa có tin nhắn. Chào cả phòng đi!</p>}
          {messages.map((m) =>
            m.kind === 'queue' ? (
              <p key={m.id} className="text-xs text-emerald-300/90 text-center">
                🎵 {m.user?.username} đã thêm "{m.text}"
              </p>
            ) : m.kind === 'quiz' ? (
              <p key={m.id} className="text-xs text-amber-200 text-center rounded-lg bg-amber-300/10 border border-amber-300/20 px-3 py-1.5">
                🎮 {m.text}
              </p>
            ) : m.kind === 'sticker' ? (
              <div key={m.id} className={`flex gap-2 items-end ${m.userId === me?.id ? 'flex-row-reverse' : ''}`}>
                <img src={avatarOf(m.user)} alt="" className="w-7 h-7 rounded-full bg-white/5 flex-shrink-0" />
                <div className={`flex flex-col ${m.userId === me?.id ? 'items-end' : 'items-start'}`}>
                  {m.userId !== me?.id && <p className="text-[11px] font-bold text-text-secondary px-1">{m.user?.username}</p>}
                  <img
                    src={stickerAnimated(m.text)}
                    onError={(e) => { e.currentTarget.src = stickerStill(m.text); }}
                    alt="Nhãn dán"
                    loading="lazy"
                    className="w-24 h-24 object-contain drop-shadow-lg animate-[stickerPop_0.35s_ease-out]"
                  />
                </div>
              </div>
            ) : (
              <div key={m.id} className={`flex gap-2 ${m.userId === me?.id ? 'flex-row-reverse' : ''}`}>
                <img src={avatarOf(m.user)} alt="" className="w-7 h-7 rounded-full bg-white/5 flex-shrink-0" />
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${m.userId === me?.id ? 'bg-emerald-400/20' : 'bg-white/[0.06]'}`}>
                  {m.userId !== me?.id && <p className="text-[11px] font-bold text-text-secondary">{m.user?.username}</p>}
                  <p className={`text-white break-words whitespace-pre-line ${isOnlyEmoji(m.text) ? 'text-4xl leading-tight' : 'text-sm'}`}>{m.text}</p>
                </div>
              </div>
            )
          )}
        </div>
        <ChatComposer onSendText={sendMessage} onSendSticker={sendSticker} />
      </div>
    </div>
  );
};

export const Jam: React.FC = () => {
  const { code: routeCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const code = useJamStore((s) => s.code);
  const joinRoom = useJamStore((s) => s.joinRoom);

  useEffect(() => {
    if (routeCode && isAuthenticated) joinRoom(routeCode);
    else if (!routeCode && code) navigate(`/jam/${code}`, { replace: true });
  }, [routeCode, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <Users className="w-10 h-10 mx-auto text-emerald-300" />
        <h2 className="text-xl font-bold text-white">Đăng nhập để nghe chung</h2>
        <Link to="/login" className="inline-block rounded-xl bg-white text-black px-5 py-2.5 text-sm font-bold">Đăng nhập</Link>
      </div>
    );
  }
  if (routeCode && code) return <Room code={code} />;
  return <Landing />;
};
