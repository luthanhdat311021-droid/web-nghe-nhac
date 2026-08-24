import React, { useEffect, useState } from 'react';
import { UserCheck, Shield, Ban, CheckCircle, Trash2, Search as SearchIcon } from 'lucide-react';
import { User } from '../../types/index.js';
import { adminService } from '../../services/admin.service.js';
import { formatDate } from '../../utils/format.js';
import { Button } from '../../components/common/Button.js';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminService.getAllUsers();
      setUsers(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = async (user: User) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!window.confirm(`Đổi vai trò người dùng ${user.username} thành ${newRole}?`)) return;
    try {
      await adminService.updateUserRole(user.id, newRole);
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBlockToggle = async (user: User) => {
    try {
      await adminService.toggleBlockUser(user.id);
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa tài khoản người dùng này?')) return;
    try {
      await adminService.deleteUser(id);
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-white flex-shrink-0" />
            <span>Quản lý người dùng</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Quản lý tài khoản, phân quyền quản trị và trạng thái hoạt động
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Tìm người dùng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-text-muted outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="text-center py-10 text-xs text-text-muted">Đang tải danh sách...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-xs text-text-muted">Không tìm thấy người dùng nào.</div>
        ) : (
          filteredUsers.map((u) => (
            <div
              key={u.id}
              className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <img
                  src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={u.username}
                  className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-xs sm:text-sm truncate">{u.username}</span>
                    <button
                      onClick={() => handleRoleToggle(u)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-white/10 text-text-secondary hover:text-white"
                    >
                      {u.role}
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <Button
                  onClick={() => handleBlockToggle(u)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Ban className="w-3.5 h-3.5" />}
                  className="flex-1"
                >
                  {u.isBlocked ? 'Mở khóa' : 'Khóa'}
                </Button>
                <Button
                  onClick={() => handleDelete(u.id)}
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Xóa
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
                <th className="p-3.5">Người dùng</th>
                <th className="p-3.5">Vai trò</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5">Playlists</th>
                <th className="p-3.5">Đã thích</th>
                <th className="p-3.5">Ngày tham gia</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-muted">
                    Đang tải danh sách...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-muted">
                    Không tìm thấy người dùng.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={u.username}
                          className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-white block truncate">
                            {u.username}
                          </span>
                          <span className="text-[11px] text-text-muted truncate block">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleRoleToggle(u)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-white/10 text-text-secondary hover:text-white"
                        title="Nhấn để đổi vai trò"
                      >
                        {u.role}
                      </button>
                    </td>
                    <td className="p-3.5">
                      {u.isBlocked ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          Đã khóa
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          Hoạt động
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-text-muted">
                      {u._count?.playlists ?? 0}
                    </td>
                    <td className="p-3.5 font-mono text-text-muted">
                      {u._count?.favorites ?? 0}
                    </td>
                    <td className="p-3.5 text-text-muted">{formatDate(u.createdAt)}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => handleBlockToggle(u)}
                          variant="ghost"
                          size="sm"
                        >
                          {u.isBlocked ? 'Mở khóa' : 'Khóa'}
                        </Button>
                        <Button
                          onClick={() => handleDelete(u.id)}
                          variant="danger"
                          size="sm"
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Xóa
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
    </div>
  );
};
