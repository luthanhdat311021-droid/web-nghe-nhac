import React from 'react';
import { Music2 } from 'lucide-react';
import { Button } from './Button.js';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-text-muted mb-3.5">
        {icon || <Music2 className="w-6 h-6 text-text-muted" />}
      </div>
      <h3 className="text-base font-bold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted max-w-sm mb-5 leading-relaxed">{description}</p>
      )}
      {actionText && onAction && (
        <Button onClick={onAction} variant="secondary" size="sm">
          {actionText}
        </Button>
      )}
    </div>
  );
};

