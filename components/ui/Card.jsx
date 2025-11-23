import React from 'react';

export function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-brand-800 rounded-xl border border-brand-700 p-6 shadow-card ${
        hover ? 'hover:shadow-elevated hover:border-accent-blue/30 transition-all duration-300' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
