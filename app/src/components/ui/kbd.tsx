import { cn } from '@/lib/utils';

// Tecla estilizada para hotkey hints — usa a classe `.kbd` definida em globals.css.
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
	return <span className={cn('kbd', className)}>{children}</span>;
}
