
import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
    const sizeClasses = 'h-9 px-4 py-2';

    const variantClasses = {
      primary: 'bg-slate-900 text-slate-50 shadow hover:bg-slate-900/90',
      secondary: 'bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-100/80',
    };
    
    return (
      <button
        className={cn(baseClasses, sizeClasses, variantClasses[variant], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
