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

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService
      .getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2 sm:gap-2.5">
          <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 flex-shrink-0" />
          <span>System Overview & Analytics</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
          Live streaming telemetry, catalogue volume, and user activity
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatsCard
          title="Total Users"
          value={formatNumber(stats.kpi.totalUsers)}
          icon={<Users className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
          trend="+12% this week"
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
          title="Total Plays"
          value={formatNumber(stats.kpi.totalPlays)}
          icon={<Play className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />}
          trend="+28% streams"
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Plays Trend Chart */}
        <div className="p-4 sm:p-6 rounded-3xl bg-background-card border border-white/5 shadow-xl space-y-4 min-w-0 w-full overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              Weekly Streams Volume
            </h3>
            <span className="text-[11px] sm:text-xs text-text-muted">Last 7 Days</span>
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
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
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
              New User Registrations
            </h3>
            <span className="text-[11px] sm:text-xs text-text-muted">Last 7 Days</span>
          </div>

          <div className="h-56 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12141c',
                    borderColor: '#ffffff15',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="newUsers" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lists Row: Top Songs & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Top Played Tracks */}
        <div className="p-4 sm:p-6 rounded-3xl bg-background-card border border-white/5 space-y-3.5 shadow-xl">
          <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
            <Play className="w-4 h-4 text-purple-400" />
            Top Streamed Tracks
          </h3>
          <div className="space-y-2">
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
