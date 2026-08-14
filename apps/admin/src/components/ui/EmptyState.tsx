import React from 'react';

export function EmptyState({ icon, title, message, action }: { icon?: string, title: string, message?: React.ReactNode, action?: React.ReactNode }) {
  return (
    <div className="admin-z-empty">
      {icon && <span className="material-symbols-outlined">{icon}</span>}
      <p>{title}</p>
      <small>{message}</small>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
