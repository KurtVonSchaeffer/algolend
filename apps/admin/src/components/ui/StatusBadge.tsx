import React from 'react';

export function StatusBadge({ status }: { status: string }) {
  let color = 'gray';
  const s = status.toUpperCase();
  if (['ACTIVE', 'APPROVED', 'SETTLED', 'COMPLETED', 'DISBURSED'].includes(s)) color = 'green';
  else if (['PENDING', 'REVIEW', 'PROCESSING'].includes(s)) color = 'purple';
  else if (['OFFERED'].includes(s)) color = 'blue';
  
  return (
    <span className={`badge badge-${color}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
