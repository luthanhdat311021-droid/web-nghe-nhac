import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Users, Search as SearchIcon } from 'lucide-react';
import { Artist } from '../../types/index.js';
import { artistService } from '../../services/artist.service.js';
import { adminService } from '../../services/admin.service.js';
import { Button } from '../../components/common/Button.js';
import { ArtistModal } from '../../components/admin/ArtistModal.js';
import { formatNumber } from '../../utils/format.js';

export const AdminArtists: React.FC = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);

  useEffect(() => {
    fetchArtists();
  }, [search, page]);

  const fetchArtists = async () => {
    try {
      setLoading(true);
      const res = await artistService.getAllArtists({
        search: search.trim() || undefined,
        page,
        limit: 15,
      });
      setArtists(res.items);
      setTotalPages(res.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (artist: Artist) => {
    setSelectedArtist(artist);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete artist? All songs linked to this artist will be deleted.')) return;
    try {
      await adminService.deleteArtist(id);
      fetchArtists();
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
            <Users className="w-5 h-5 text-white flex-shrink-0" />
            <span>Quản lý nghệ sĩ</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Quản lý hồ sơ ca sĩ, ảnh đại diện, banner và tiểu sử
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedArtist(null);
            setIsModalOpen(true);
          }}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="self-start sm:self-auto"
        >
          Add artist
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Tìm nghệ sĩ theo tên..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full h-9 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-text-muted outline-none focus:border-white/20 transition-all"
        />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="text-center py-10 text-xs text-text-muted">Đang tải danh sách...</div>
        ) : artists.length === 0 ? (
          <div className="text-center py-10 text-xs text-text-muted">Chưa có nghệ sĩ nào.</div>
        ) : (
          artists.map((artist) => (
            <div
              key={artist.id}
              className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <img
                  src={artist.avatarUrl}
                  alt={artist.name}
                  className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white text-xs sm:text-sm truncate">{artist.name}</h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {formatNumber(artist.monthlyListeners)} người nghe • {artist.country || 'Việt Nam'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <Button
                  onClick={() => handleEdit(artist)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(artist.id)}
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

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-text-muted uppercase text-[10px] tracking-wider border-b border-white/5 font-semibold">
              <tr>
                <th className="p-3.5">Nghệ sĩ</th>
                <th className="p-3.5">Quốc gia</th>
                <th className="p-3.5">Người nghe</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-text-muted">
                    Đang tải danh sách nghệ sĩ...
                  </td>
                </tr>
              ) : artists.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-text-muted">
                    Không tìm thấy nghệ sĩ nào.
                  </td>
                </tr>
              ) : (
                artists.map((artist) => (
                  <tr key={artist.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={artist.avatarUrl}
                          alt={artist.name}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                        <span className="font-semibold text-white truncate max-w-xs">
                          {artist.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-text-muted">
                      {artist.country || 'Chưa cập nhật'}
                    </td>
                    <td className="p-3.5 font-mono text-white">
                      {formatNumber(artist.monthlyListeners)}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => handleEdit(artist)}
                          variant="ghost"
                          size="sm"
                          leftIcon={<Edit className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(artist.id)}
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

      <ArtistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchArtists}
        artist={selectedArtist}
      />
    </div>
  );
};
