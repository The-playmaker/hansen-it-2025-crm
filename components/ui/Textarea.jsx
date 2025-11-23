import React from 'react';

export function Textarea({ label, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-brand-400">
          {label}
        </label>
      )}
      <textarea
        className={`w-full bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white placeholder-brand-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors min-h-[100px] resize-y ${className}`}
        {...props}
      />
    </div>
  );
}
