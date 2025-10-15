
import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary';
}

const Badge: React.FC<BadgeProps> = ({ className, variant = 'primary', ...props }) => {
  const baseClasses = 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'border-transparent bg-slate-900 text-slate-50 shadow hover:bg-slate-900/80',
    secondary: 'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80',
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)} {...props} />
  );
};

export { Badge };
