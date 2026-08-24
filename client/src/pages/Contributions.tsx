import React, { useState } from 'react';
import {
  Music2,
  Users,
  Plus,
  Edit,
  Trash2,
  Play,
  ExternalLink,
  Calendar,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Song, Artist } from '../types/index.js';
import { songService } from '../services/song.service.js';
import { artistService } from '../services/artist.service.js';
import { useAuthStore } from '../store/authStore.js';
import { usePlayerStore } from '../store/playerStore.js';
import { Button } from '../components/common/Button.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { AddSongModal } from '../components/song/AddSongModal.js';
import { AddArtistModal } from '../components/artist/AddArtistModal.js';
import { formatDuration, formatDate, formatNumber } from '../utils/format.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';

type TabType = 'songs' | 'artists';

export const Contributions: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { playSong } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<TabType>('songs');

  // Modals state
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isAddArtistOpen, setIsAddArtistOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);

  // Delete confirmation state
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'song' | 'artist';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: songs = [], isLoading: isSongsLoading } = useQuery<Song[]>({
    queryKey: QUERY_KEYS.mySongContributions,
    queryFn: () => songService.getMyContributions(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const { data: artists = [], isLoading: isArtistsLoading } = useQuery<Artist[]>({
    queryKey: QUERY_KEYS.myArtistContributions,
    queryFn: () => artistService.getMyContributions(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const loading = isSongsLoading || isArtistsLoading;

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      if (itemToDelete.type === 'song') {
        await songService.deleteSong(itemToDelete.id);
        queryClient.setQueryData<Song[]>(QUERY_KEYS.mySongContributions, (old = []) =>
          old.filter((s) => s.id !== itemToDelete.id)
        );
      } else {
        await artistService.deleteArtist(itemToDelete.id);
        queryClient.setQueryData<Artist[]>(QUERY_KEYS.myArtistContributions, (old = []) =>
          old.filter((a) => a.id !== itemToDelete.id)
        );
      }
      setItemToDelete(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa nội dung.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={<Music2 className="w-8 h-8 text-primary-400" />}
        title="Đăng nhập để xem Đóng góp của bạn"
        description="Đóng góp bài hát và nghệ sĩ yêu thích cho cộng đồng MusicWave."
        actionText="Đăng nhập"
        onAction={() => navigate('/login')}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 overflow-x-hidden">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-5 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left min-w-0 w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0 text-white shadow">
            <Music2 className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
              Trung tâm đóng góp
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Đóng góp của tôi
            </h1>
            <p className="text-xs text-text-muted">
              {songs.length} bài hát • {artists.length} nghệ sĩ đã đóng góp
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-center md:justify-end">
          <Button
            onClick={() => {
              setEditingArtist(null);
              setIsAddArtistOpen(true);
            }}
            variant="secondary"
            size="md"
            leftIcon={<Users className="w-4 h-4" />}
          >
            + Thêm nghệ sĩ
          </Button>

          <Button
            onClick={() => {
              setEditingSong(null);
              setIsAddSongOpen(true);
            }}
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + Thêm bài hát
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('songs')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'songs'
              ? 'bg-white text-black'
              : 'bg-white/[0.03] text-text-secondary hover:text-white border border-white/[0.06]'
          }`}
        >
          <Music2 className="w-3.5 h-3.5" />
          <span>Bài hát ({songs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('artists')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'artists'
              ? 'bg-white text-black'
              : 'bg-white/[0.03] text-text-secondary hover:text-white border border-white/[0.06]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Nghệ sĩ ({artists.length})</span>
        </button>
      </div>

      {/* Content View */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'songs' ? (
        songs.length === 0 ? (
          <EmptyState
            icon={<Music2 className="w-8 h-8 text-text-muted" />}
            title="Bạn chưa đóng góp bài hát nào"
            description="Hãy chia sẻ những bài hát hoặc sản phẩm âm nhạc mới lên MusicWave ngay hôm nay."
            actionText="+ Thêm bài hát đầu tiên"
            onAction={() => {
              setEditingSong(null);
              setIsAddSongOpen(true);
            }}
          />
        ) : (
          <div className="space-y-2">
            {songs.map((song) => (
              <div
                key={song.id}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition-colors"
              >
                {/* Left: Cover & Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => playSong(song, songs)}
                      aria-label="Play song"
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/song/${song.id}`}
                      className="font-bold text-xs sm:text-sm text-white truncate block hover:underline"
                    >
                      {song.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                      {song.artist && (
                        <Link
                          to={`/artist/${song.artist.id}`}
                          className="hover:text-white truncate"
                        >
                          {song.artist.name}
                        </Link>
                      )}
                      <span>•</span>
                      <span className="font-mono">{formatDuration(song.duration)}</span>
                      <span>•</span>
                      <span className="text-text-secondary">{formatNumber(song.playsCount)} lượt nghe</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                  <Link to={`/song/${song.id}`}>
                    <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                      Xem
                    </Button>
                  </Link>
                  <Button
                    onClick={() => {
                      setEditingSong(song);
                      setIsAddSongOpen(true);
                    }}
                    variant="secondary"
                    size="sm"
                    leftIcon={<Edit className="w-3.5 h-3.5" />}
                  >
                    Sửa
                  </Button>
                  <Button
                    onClick={() =>
                      setItemToDelete({
                        type: 'song',
                        id: song.id,
                        name: song.title,
                      })
                    }
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : artists.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-text-muted" />}
          title="Bạn chưa tạo nghệ sĩ nào"
          description="Tạo trang thông tin cho nghệ sĩ mới để gắn bài hát và giúp người nghe khám phá."
          actionText="+ Thêm nghệ sĩ mới"
          onAction={() => {
            setEditingArtist(null);
            setIsAddArtistOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] space-y-3 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <img
                  src={artist.avatarUrl}
                  alt={artist.name}
                  className="w-14 h-14 rounded-full object-cover border border-white/10 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-white truncate">{artist.name}</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {artist.country || 'Nghệ sĩ'} • {artist._count?.songs ?? 0} bài hát
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                <Link to={`/artist/${artist.id}`} className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full justify-center">
                    Xem
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    setEditingArtist(artist);
                    setIsAddArtistOpen(true);
                  }}
                  variant="secondary"
                  size="sm"
                  className="flex-1 justify-center"
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                >
                  Sửa
                </Button>
                <Button
                  onClick={() =>
                    setItemToDelete({
                      type: 'artist',
                      id: artist.id,
                      name: artist.name,
                    })
                  }
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Xóa
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Song Modal */}
      <AddSongModal
        isOpen={isAddSongOpen}
        onClose={() => {
          setIsAddSongOpen(false);
          setEditingSong(null);
        }}
        song={editingSong}
        onSuccess={(_savedSong) => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mySongContributions });
          queryClient.invalidateQueries({ queryKey: ['songs'] });
        }}
      />

      {/* Add / Edit Artist Modal */}
      <AddArtistModal
        isOpen={isAddArtistOpen}
        onClose={() => {
          setIsAddArtistOpen(false);
          setEditingArtist(null);
        }}
        artist={editingArtist}
        onSuccess={(_savedArtist) => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myArtistContributions });
          queryClient.invalidateQueries({ queryKey: ['artists'] });
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Xác nhận xóa"
        maxWidth="sm"
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-text-secondary leading-relaxed">
            Bạn có chắc chắn muốn xóa {itemToDelete?.type === 'song' ? 'bài hát' : 'nghệ sĩ'}{' '}
            <strong className="text-white">"{itemToDelete?.name}"</strong> không? Hành động này
            không thể hoàn tác.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setItemToDelete(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Xóa vĩnh viễn
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
