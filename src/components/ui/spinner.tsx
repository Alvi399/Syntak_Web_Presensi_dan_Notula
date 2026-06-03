import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const spinnerVariants = cva(
  'animate-spin text-muted-foreground',
  {
    variants: {
      size: {
        default: 'h-4 w-4',
        sm: 'h-3 w-3',
        lg: 'h-6 w-6',
        xl: 'h-8 w-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface SpinnerProps extends React.SVGProps<SVGSVGElement>, VariantProps<typeof spinnerVariants> {
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon';
}

export function Spinner({ className, size, ...props }: SpinnerProps) {
  return (
    <Loader2 className={cn(spinnerVariants({ size, className }))} {...props} />
  );
}

export function PageLoader({ className, text = "Memuat data..." }: { className?: string; text?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 space-y-4 min-h-[50vh]", className)}>
      <Spinner size="xl" className="text-primary" />
      {text && <p className="text-muted-foreground text-sm font-medium animate-pulse">{text}</p>}
    </div>
  );
}
