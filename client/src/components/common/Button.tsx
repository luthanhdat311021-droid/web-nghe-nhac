import React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-lg select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.99]';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-[13px] sm:text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2.5',
    icon: 'h-9 w-9 p-0 flex items-center justify-center',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    // Solid white on dark surface (Standard for real products)
    primary:
      'bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 font-semibold border border-transparent',
    // Solid subtle violet accent if specifically chosen
    accent:
      'bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white font-medium border border-transparent',
    // Subtle surface card with 1px hairline border
    secondary:
      'bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] text-white border border-white/[0.08] hover:border-white/[0.15]',
    // Transparent with subtle border
    outline:
      'bg-transparent hover:bg-white/[0.05] active:bg-white/[0.08] text-white border border-white/[0.12] hover:border-white/[0.2]',
    // Clean transparent ghost
    ghost:
      'bg-transparent hover:bg-white/[0.06] active:bg-white/[0.1] text-text-secondary hover:text-white',
    // Clean quiet destructive
    danger:
      'bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/25 text-red-400 border border-red-500/20',
  };

  return (
    <button
      className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
