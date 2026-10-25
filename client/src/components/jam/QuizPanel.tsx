import React, { useEffect, useState } from 'react';
import { Check, Crown, Eye, Gamepad2, RotateCcw, Timer, Trophy, X } from 'lucide-react';
import { useJamStore } from '../../store/jamStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { Button } from '../common/Button.js';
import { QuizSongPicker } from './QuizSongPicker.js';

const ROUND_SECONDS = 30; // matches QUIZ_ROUND_MS on the server

/** Seconds left in the round, counted on the server's clock so every device shows the same number. */
const useSecondsLeft = (endsAt: string | null, active: boolean, offsetMs: number) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  if (!active || !endsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(endsAt) - (now + offsetMs)) / 1000));
};

export const QuizPanel: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const { isHost, quiz, members, serverOffsetMs, startQuiz, answerQuiz, revealQuiz, resetQuiz } = useJamStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [picking, setPicking] = useState(false); // host's song list stays folded until they start a round
  const secondsLeft = useSecondsLeft(quiz?.endsAt ?? null, !!quiz?.active, serverOffsetMs);
  useEffect(() => setNotice(''), [quiz?.round]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const players = members.filter((m) => !m.isHost).sort((a, b) => b.quizScore - a.quizScore);
  const answered = !!quiz?.myChoiceId;
  const revealed = !!quiz && !quiz.active;

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/10 via-fuchsia-500/5 to-transparent p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-amber-300" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Đoán bài hát{quiz ? ` · Vòng ${quiz.round}` : ''}
          </h3>
        </div>
        {quiz?.active && (
          <span className={`flex items-center gap-1.5 text-sm font-mono font-bold ${secondsLeft <= 5 ? 'text-rose-300' : 'text-amber-200'}`}>
            <Timer className="w-4 h-4" /> {secondsLeft}s
          </span>
        )}
      </div>

      {quiz?.active && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-300 to-rose-400 transition-[width] duration-300 ease-linear"
            style={{ width: `${(secondsLeft / ROUND_SECONDS) * 100}%` }}
          />
        </div>
      )}

      {!quiz && (
        <p className="text-sm text-text-secondary">
          {isHost
            ? 'Bạn là người dẫn: chọn một bài bí ẩn để phát cho cả phòng, mọi người chọn đúng tên bài trong 30 giây. Trả lời càng nhanh càng nhiều điểm.'
            : 'Chờ chủ phòng bắt đầu trò chơi. Khi nhạc vang lên, chọn đúng tên bài hát — càng nhanh càng nhiều điểm!'}
        </p>
      )}

      {quiz && quiz.options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quiz.options.map((option, i) => {
            const isCorrect = quiz.correctId === option.id;
            const isMine = quiz.myChoiceId === option.id;
            const showResult = revealed || isHost;
            const tone = showResult && isCorrect
              ? 'border-emerald-300/70 bg-emerald-400/15'
              : revealed && isMine
                ? 'border-rose-300/60 bg-rose-400/10'
                : isMine
                  ? 'border-amber-300/70 bg-amber-300/15'
                  : 'border-white/10 bg-black/20 hover:border-amber-300/50 hover:bg-white/[0.05]';
            return (
              <button
                key={option.id}
                disabled={isHost || answered || !quiz.active || busy}
                onClick={() => run(async () => {
                  const result = await answerQuiz(option.id);
                  setNotice(result.correct ? `Chuẩn! +${result.points} điểm` : 'Chưa đúng rồi… chờ đáp án nhé.');
                })}
                className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-default ${tone}`}
              >
                <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white line-clamp-2 break-words">{option.title}</span>
                  <span className="block text-xs text-text-muted truncate">{option.artistName}</span>
                </span>
                {showResult && isCorrect && <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />}
                {revealed && isMine && !isCorrect && <X className="w-4 h-4 text-rose-300 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {!isHost && quiz?.active && answered && !notice && (
        <p className="text-xs text-amber-200">Đã chốt đáp án, chờ cả phòng…</p>
      )}
      {!isHost && revealed && quiz?.myPoints != null && (
        <p className={`text-sm font-semibold ${quiz.myPoints > 0 ? 'text-emerald-300' : 'text-text-secondary'}`}>
          {quiz.myPoints > 0 ? `Bạn được +${quiz.myPoints} điểm vòng này!` : 'Vòng này bạn chưa ghi điểm.'}
        </p>
      )}
      {notice && <p className="text-xs text-amber-200" role="status">{notice}</p>}

      {isHost && !quiz?.active && picking && (
        <QuizSongPicker
          round={(quiz?.round ?? 0) + 1}
          busy={busy}
          onStart={(songId) => run(async () => { await startQuiz(songId); setPicking(false); })}
        />
      )}

      {isHost && (
        <div className="flex flex-wrap gap-2">
          {quiz?.active ? (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(revealQuiz)} leftIcon={<Eye className="w-4 h-4" />}>
              Công bố đáp án
            </Button>
          ) : !picking && (
            <Button variant="primary" size="sm" onClick={() => setPicking(true)} leftIcon={<Gamepad2 className="w-4 h-4" />}>
              {quiz ? `Chọn bài vòng ${quiz.round + 1}` : 'Bắt đầu đoán bài'}
            </Button>
          )}
          {picking && !quiz?.active && (
            <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
              Đóng
            </Button>
          )}
          {quiz && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(resetQuiz)} leftIcon={<RotateCcw className="w-4 h-4" />}>
              Kết thúc trò chơi
            </Button>
          )}
        </div>
      )}

      {quiz && players.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-300" /> Bảng điểm
          </p>
          {players.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-center text-xs font-bold text-text-muted">{i + 1}</span>
              {i === 0 && m.quizScore > 0 && <Crown className="w-3.5 h-3.5 text-amber-300" />}
              <span className="flex-1 truncate text-white">{m.username}{m.id === me?.id ? ' (bạn)' : ''}</span>
              <span className="font-mono font-bold text-amber-200">{m.quizScore}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-text-muted">
        Mỗi vòng là một lượt nghe: tài khoản Free vẫn tính hạn mức và quảng cáo theo quy định của Music Pro.
      </p>
    </div>
  );
};
