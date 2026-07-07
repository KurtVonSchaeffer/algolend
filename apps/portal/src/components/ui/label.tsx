import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600', className)} {...props} />
));
Label.displayName = 'Label';
