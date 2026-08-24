import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Music2, Search as SearchIcon } from 'lucide-react';
import { Song } from '../../types/index.js';
import { songService } from '../../services/song.service.js';
import { adminService } from '../../services/admin.service.js';
import { Button } from '../../components/common/Button.js';
import { SongModal } from '../../components/admin/SongModal.js';
import { formatDuration, formatNumber } from '../../utils/format.js';

export const AdminSongs: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  useEffect(() => {
    fetchSongs();
  }, [search, page]);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const res = await songService.getAllSongs({
        search: search.trim() || undefined,
        page,
        limit: 15,
      });
      setSongs(res.items);
      setTotalPages(res.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (song: Song) => {
    setSelectedSong(song);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this song permanently?')) return;
    try {
      await adminService.deleteSong(id);
      fetchSongs();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Music2 className="w-5 h-5 text-white flex-shrink-0" />
            <span>Quản lý bài hát</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Quản lý kho nhạc, luồng phát, ảnh bìa và lời bài hát
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedSong(null);
            setIsModalOpen(true);
          }}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="self-start sm:self-auto"
        >
          Add song
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Tìm bài hát..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full h-9 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-text-muted outline-none focus:border-white/20 transition-all"
        />
      </div>

      {/* ========================================================================= */}
      {/* 1. MOBILE VIEW (<md): ADMIN SONG CARDS                                    */}
      {/* ========================================================================= */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="text-center py-10 text-xs text-text-muted">Đang tải danh sách...</div>
        ) : songs.length === 0 ? (
          <div className="text-center py-10 text-xs text-text-muted">Chưa có bài hát nào.</div>
        ) : (
          songs.map((song) => (
            <div
              key={song.id}
              className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5"
            >
              {/* Row 1: Artwork + Title + Artist */}
              <div className="flex items-center gap-3">
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white text-xs sm:text-sm truncate">{song.title}</h4>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">{song.artist?.name || 'Various Artists'}</p>
                </div>
              </div>

              {/* Row 2: Badges + Stats */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-mono text-text-muted">{formatDuration(song.duration)}</span>
                  <span className="text-text-muted">•</span>
                  <span className="font-mono text-text-secondary">{formatNumber(song.playsCount)} lượt nghe</span>
                </div>

                <div className="flex items-center gap-1">
                  {song.isTrending && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      Trending
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <Button
                  onClick={() => handleEdit(song)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(song.id)}
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP VIEW (md+): ADMIN SONG TABLE                                   */}
      {/* ========================================================================= */}
      <div className="hidden md:block rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-text-muted uppercase text-[10px] tracking-wider border-b border-white/5 font-semibold">
              <tr>
                <th className="p-3.5">Bài hát</th>
                <th className="p-3.5">Nghệ sĩ</th>
                <th className="p-3.5">Thể loại</th>
                <th className="p-3.5">Thời lượng</th>
                <th className="p-3.5">Lượt nghe</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    Đang tải danh sách bài hát...
                  </td>
                </tr>
              ) : songs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    Không tìm thấy bài hát nào.
                  </td>
                </tr>
              ) : (
                songs.map((song) => (
                  <tr key={song.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-white block truncate max-w-xs">
                            {song.title}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {song.album?.title || 'Single'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-text-secondary">
                      {song.artist?.name || 'Various'}
                    </td>
                    <td className="p-3.5 text-text-muted">
                      {song.genre?.name || 'Various'}
                    </td>
                    <td className="p-3.5 font-mono text-text-muted">
                      {formatDuration(song.duration)}
                    </td>
                    <td className="p-3.5 font-mono text-white">
                      {formatNumber(song.playsCount)}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => handleEdit(song)}
                          variant="ghost"
                          size="sm"
                          leftIcon={<Edit className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(song.id)}
                          variant="danger"
                          size="sm"
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <span className="text-xs text-text-muted">
            Trang {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <SongModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSongs}
        song={selectedSong}
      />
    </div>
  );
};
