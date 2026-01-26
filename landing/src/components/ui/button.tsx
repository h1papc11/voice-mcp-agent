import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary/10 backdrop-blur-sm border border-border text-primary hover:bg-primary/11 hover:border-primary/15 shadow-lg shadow-black/20 active:scale-[0.99]',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 active:scale-[0.98]',
        outline:
          'border border-border bg-background/50 backdrop-blur-sm hover:bg-foreground/5 transition-all active:scale-[0.99]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70 backdrop-blur-sm active:scale-[0.99]',
        ghost:
          'hover:bg-accent/30 hover:text-accent-foreground backdrop-blur-sm active:scale-[0.99]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-12 rounded-xl text-base px-8 font-semibold',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
