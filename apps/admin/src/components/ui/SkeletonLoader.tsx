import React from 'react';

export function SkeletonLoader({ type = 'card' }: { type?: 'card' | 'table' | 'line' }) {
  if (type === 'table') {
    return (
      <div className="skeleton" style={{ width: '100%', height: 400, borderRadius: 12 }}></div>
    );
  }
  if (type === 'line') {
    return (
      <div className="skeleton" style={{ width: '100%', height: 24, borderRadius: 6, marginBottom: 12 }}></div>
    );
  }
  return (
    <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 12 }}></div>
  );
}
