import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface CircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
}

const CircleButton = React.forwardRef<HTMLButtonElement, CircleButtonProps>(
  ({ className, icon: Icon, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0',
          'hover:bg-muted transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </button>
    );
  },
);
CircleButton.displayName = 'CircleButton';

export { CircleButton };
