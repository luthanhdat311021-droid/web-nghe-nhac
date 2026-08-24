import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  trend,
}) => {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-2 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          {title}
        </span>
        <div className="p-2 sm:p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text-secondary">
          {icon}
        </div>
      </div>
      <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">{value}</div>
      {trend && (
        <span className="text-[11px] font-medium text-emerald-400 block">
          {trend}
        </span>
      )}
    </div>
  );
};

