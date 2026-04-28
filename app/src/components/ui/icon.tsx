import React from 'react';
import { cn } from '@/lib/utils';

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
	name: string;
}

/**
 * @deprecated Use `LucideIcon` de `@/components/ui/lucide-icon`. Este wrapper
 * depende da fonte Material Icons e renderiza o nome como texto se a fonte
 * estiver ausente — bug visível no botão "fechar" do dialog antigo.
 *
 * Mantido apenas para superfícies legadas ainda não migradas (ResponseDialog,
 * RuleEditor). Não use em novas superfícies.
 */
export function Icon({ name, className, ...props }: IconProps) {
	return (
		<span className={cn('material-icons', className)} {...props}>
			{name}
		</span>
	);
}
