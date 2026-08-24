import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Disc, Search as SearchIcon } from 'lucide-react';
import { Album } from '../../types/index.js';
import { albumService } from '../../services/album.service.js';
import { adminService } from '../../services/admin.service.js';
import { Button } from '../../components/common/Button.js';
import { AlbumModal } from '../../components/admin/AlbumModal.js';
import { formatDate } from '../../utils/format.js';

export const AdminAlbums: React.FC = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  useEffect(() => {
    fetchAlbums();
  }, [search, page]);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      const res = await albumService.getAllAlbums({
        search: search.trim() || undefined,
        page,
        limit: 15,
      });
      setAlbums(res.items);
      setTotalPages(res.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (album: Album) => {
    setSelectedAlbum(album);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this album?')) return;
    try {
      await adminService.deleteAlbum(id);
      fetchAlbums();
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
            <Disc className="w-5 h-5 text-white flex-shrink-0" />
            <span>Quản lý album</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Quản lý danh sách album phát hành, ảnh bìa và ngày phát hành
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedAlbum(null);
            setIsModalOpen(true);
          }}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="self-start sm:self-auto"
        >
          Add album
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Tìm album theo tiêu đề..."
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
        ) : albums.length === 0 ? (
          <div className="text-center py-10 text-xs text-text-muted">Chưa có album nào.</div>
        ) : (
          albums.map((album) => (
            <div
              key={album.id}
              className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <img
                  src={album.coverUrl}
                  alt={album.title}
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white text-xs sm:text-sm truncate">{album.title}</h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {album.artist?.name || 'Various'} • {formatDate(album.releaseDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <Button
                  onClick={() => handleEdit(album)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(album.id)}
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
                <th className="p-3.5">Album</th>
                <th className="p-3.5">Nghệ sĩ</th>
                <th className="p-3.5">Ngày phát hành</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-text-muted">
                    Đang tải danh sách album...
                  </td>
                </tr>
              ) : albums.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-text-muted">
                    Không tìm thấy album nào.
                  </td>
                </tr>
              ) : (
                albums.map((album) => (
                  <tr key={album.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={album.coverUrl}
                          alt={album.title}
                          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                        />
                        <span className="font-semibold text-white truncate max-w-xs">
                          {album.title}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-text-secondary">
                      {album.artist?.name || 'Various'}
                    </td>
                    <td className="p-3.5 text-text-muted">
                      {formatDate(album.releaseDate)}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => handleEdit(album)}
                          variant="ghost"
                          size="sm"
                          leftIcon={<Edit className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(album.id)}
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

      <AlbumModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchAlbums}
        album={selectedAlbum}
      />
    </div>
  );
};
