import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Alert({ variant = 'error', children }: { variant?: 'error' | 'success'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mb-4 rounded-xl border p-3 text-sm',
        variant === 'error' && 'border-red-200 bg-red-50 text-red-700',
        variant === 'success' && 'border-green-200 bg-green-50 text-green-700'
      )}
    >
      {children}
    </div>
  );
}
