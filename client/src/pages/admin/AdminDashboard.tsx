import React, { useEffect, useState } from 'react';
import {
  Users,
  Music2,
  Disc,
  ListMusic,
  Play,
  TrendingUp,
  UserPlus,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { DashboardStats } from '../../types/index.js';
import { adminService } from '../../services/admin.service.js';
import { StatsCard } from '../../components/admin/StatsCard.js';
import { formatNumber, formatDate } from '../../utils/format.js';

const formatVnd = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await adminService.getStats();
        if (active) { setStats(data); setError(''); }
      } catch {
        if (active) setError('Không tải được số liệu mới. Vui lòng thử lại.');
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!stats) return <div role="alert" className="p-6 space-y-4"><p>{error}</p><button onClick={() => window.location.reload()} className="text-amber-300">Thử lại</button></div>;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2 sm:gap-2.5">
          <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 flex-shrink-0" />
          <span>System Overview & Analytics</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
          Dữ liệu thực từ hệ thống • Giờ Việt Nam • Cập nhật mỗi 30 giây
        </p>
        <p className="text-xs text-text-muted mt-1">Cập nhật lúc {new Date(stats.generatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
        {error && <p role="alert" className="text-amber-300 text-sm mt-2">{error} Đang hiển thị số liệu lần cập nhật trước.</p>}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="Total Users"
          value={formatNumber(stats.kpi.totalUsers)}
          icon={<Users className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
        />
        <StatsCard
          title="Total Songs"
          value={stats.kpi.totalSongs}
          icon={<Music2 className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
        />
        <StatsCard
          title="Total Artists"
          value={stats.kpi.totalArtists}
          icon={<Users className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
        />
        <StatsCard
          title="Total Albums"
          value={stats.kpi.totalAlbums}
          icon={<Disc className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
        />
        <StatsCard
          title="Playlists"
          value={stats.kpi.totalPlaylists}
          icon={<ListMusic className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
        />
        <StatsCard
          title="Lượt phát ghi nhận"
          value={formatNumber(stats.kpi.totalPlays)}
          icon={<Play className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
        />
        <StatsCard title="Tổng doanh thu" value={formatVnd(stats.kpi.totalRevenue)} icon={<Wallet className="w-5 h-5 text-emerald-400" />} />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
        {/* Plays Trend Chart */}
        <div className="p-4 sm:p-6 rounded-3xl bg-background-card border border-white/5 shadow-xl space-y-4 min-w-0 w-full overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              Lượt phát nhạc
            </h3>
            <span className="text-[11px] sm:text-xs text-text-muted">7 ngày gần nhất</span>
          </div>

          <div className="h-56 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="playsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12141c',
                    borderColor: '#ffffff15',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="plays"
                  name="Lượt phát"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#playsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="p-4 sm:p-6 rounded-3xl bg-background-card border border-white/5 shadow-xl space-y-4 min-w-0 w-full overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-text-secondary" />
              Đăng ký mới
            </h3>
            <span className="text-[11px] sm:text-xs text-text-muted">7 ngày gần nhất</span>
          </div>

          <div className="h-56 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12141c',
                    borderColor: '#ffffff15',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="newUsers" name="Tài khoản mới" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-4 sm:p-6 rounded-3xl bg-background-card border border-white/5 shadow-xl space-y-4 min-w-0 w-full overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-400" /> Doanh thu Music Pro</h3>
            <span className="text-[11px] sm:text-xs text-text-muted">7 ngày gần nhất</span>
          </div>
          <div className="h-56 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={value => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(value)} />
                <Tooltip formatter={(value: number) => [formatVnd(value), 'Doanh thu']} contentStyle={{ backgroundColor: '#12141c', borderColor: '#ffffff15', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="revenue" name="Doanh thu" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <p className="text-xs text-text-muted">Lượt phát được ghi nhận từ khi triển khai Music Pro, không bao gồm bộ đếm mẫu trước đây. Doanh thu tính theo ngày giao dịch của đơn đã thanh toán qua SePay; không tính đơn chờ hoặc hết hạn. Ngày không có ghi nhận hiển thị 0.</p>

      {/* Lists Row: Top Songs & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Top Played Tracks */}
        <div className="p-4 sm:p-6 rounded-3xl bg-background-card border border-white/5 space-y-3.5 shadow-xl">
          <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
            <Play className="w-4 h-4 text-purple-400" />
            Top Streamed Tracks
          </h3>
          <div className="space-y-2">
            {stats.topSongs.length === 0 && <p className="text-sm text-text-muted py-4">Chưa có lượt phát được ghi nhận.</p>}
            {stats.topSongs.map((song, idx) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors gap-2"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <span className="text-xs font-mono font-bold text-text-muted w-4 text-center flex-shrink-0">
                    0{idx + 1}
                  </span>
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">{song.title}</p>
                    <p className="text-[11px] sm:text-xs text-text-secondary truncate">{song.artist?.name}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-primary-400 font-semibold flex-shrink-0">
                  {formatNumber(song.playsCount)} plays
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="p-4 sm:p-6 rounded-3xl bg-background-card border border-white/5 space-y-3.5 shadow-xl">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-cyan" />
            Recently Registered Users
          </h3>
          <div className="space-y-2">
            {stats.recentUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.02] border border-white/5 gap-2"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                    {u.username[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{u.username}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-text-muted">
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary truncate">{u.email}</p>
                  </div>
                </div>
                <span className="text-[11px] text-text-muted flex-shrink-0">{formatDate(u.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
