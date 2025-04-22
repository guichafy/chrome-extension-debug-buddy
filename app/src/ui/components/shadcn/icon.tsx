import React from 'react';
import { cn } from '@/backend/lib/utils';

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
}

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <span className={cn('material-icons', className)} {...props}>
      {name}
    </span>
  );
}
