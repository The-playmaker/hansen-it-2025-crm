import React from 'react';

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  isLoading = false,
  className = '',
  disabled = false,
  ...props
}) {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-accent-blue text-white hover:bg-blue-600 active:scale-95 shadow-card hover:shadow-elevated',
    secondary: 'bg-brand-700 text-white hover:bg-brand-600 active:scale-95 shadow-card hover:shadow-elevated',
    outline: 'border-2 border-accent-blue text-accent-blue hover:bg-blue-500/10 active:scale-95',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-card',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {children}
    </button>
  );
}
