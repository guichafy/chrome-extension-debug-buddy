import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import type { InterceptedResponse } from '@/types/intercepted';
import { EditResponseDialog } from './EditResponseDialog';

interface PendingResponseActionsProps {
	request: InterceptedResponse;
	requestId: string;
	/** Quando false, renderiza um indicador read-only "Resolvida" no lugar dos botões. */
	isWaiting: boolean;
	onApprove: (requestId: string) => unknown;
	onIgnore: (requestId: string) => unknown;
	onCreateMock: (request: InterceptedResponse, requestId: string) => void;
	onApproveWithEdit: (
		requestId: string,
		payload: { status: number; headers: Record<string, string>; body: string },
	) => Promise<{ success: boolean; error?: string }>;
	/**
	 * Habilita atalhos de teclado (Enter/E/M) escopados a este componente. O atalho
	 * "I" (ignorar) já é registrado globalmente por `usePendingHotkeys` no
	 * CommandCenter — não duplicamos para evitar dupla execução.
	 */
	hotkeysEnabled?: boolean;
	/** Estilo compacto para uso dentro de tabela. Default `default`. */
	size?: 'sm' | 'default';
	/** Permite desabilitar todas as ações (ex.: captureError presente). */
	disabled?: boolean;
}

/**
 * Split button compartilhado entre `RequestInspector` e a tabela de `/pending`.
 * Hierarquia: "Aprovar" como ação primária à esquerda; chevron à direita abre
 * dropdown com variações ("Aprovar e editar...", "Criar Mock") e a destrutiva
 * "Ignorar" depois de um separador.
 */
export function PendingResponseActions({
	request,
	requestId,
	isWaiting,
	onApprove,
	onIgnore,
	onCreateMock,
	onApproveWithEdit,
	hotkeysEnabled = false,
	size = 'default',
	disabled = false,
}: PendingResponseActionsProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	if (!isWaiting) {
		return (
			<Badge
				variant="outline"
				className="inline-flex items-center gap-1 text-xs"
				data-testid="pending-actions-resolved"
			>
				<LucideIcon name="check-circle" className="h-3 w-3" />
				Resolvida
			</Badge>
		);
	}

	const handleApprove = () => {
		void onApprove(requestId);
	};
	const handleIgnore = () => {
		void onIgnore(requestId);
	};
	const handleCreateMock = () => {
		onCreateMock(request, requestId);
	};
	const handleOpenEdit = () => {
		setEditDialogOpen(true);
	};

	// Atalhos locais Enter / E / M. "I" fica a cargo do listener global do
	// CommandCenter (usePendingHotkeys). O dialog aberto e qualquer input/textarea
	// devem suprimir os atalhos para não roubar foco do usuário.
	useHotkeys({
		enabled: hotkeysEnabled && !disabled && !editDialogOpen,
		onApprove: handleApprove,
		onEdit: handleOpenEdit,
		onCreateMock: handleCreateMock,
	});

	const buttonSize = size === 'sm' ? 'sm' : 'default';

	return (
		<>
			<div className={cn('inline-flex items-stretch')} data-testid="pending-response-actions">
				<Button
					type="button"
					size={buttonSize}
					variant="default"
					onClick={handleApprove}
					disabled={disabled}
					className="gap-1.5 rounded-r-none"
					data-testid="pending-actions-approve"
				>
					<LucideIcon name="check" className="h-4 w-4" />
					Aprovar
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							size={buttonSize}
							variant="default"
							disabled={disabled}
							aria-label="Mais ações"
							className="rounded-l-none border-l border-primary-foreground/20 px-2"
							data-testid="pending-actions-more"
						>
							<LucideIcon name="chevron-down" className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-60">
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								handleOpenEdit();
							}}
							data-testid="pending-actions-edit"
						>
							<LucideIcon name="file-edit" className="mr-2 h-4 w-4" />
							<span>Aprovar e editar…</span>
							<Kbd className="ml-auto">E</Kbd>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								handleCreateMock();
							}}
							data-testid="pending-actions-create-mock"
						>
							<LucideIcon name="copy" className="mr-2 h-4 w-4" />
							<span>Criar Mock</span>
							<Kbd className="ml-auto">M</Kbd>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								handleIgnore();
							}}
							className="text-destructive focus:bg-destructive/10 focus:text-destructive"
							data-testid="pending-actions-ignore"
						>
							<LucideIcon name="x" className="mr-2 h-4 w-4" />
							<span>Ignorar</span>
							<Kbd className="ml-auto">I</Kbd>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<EditResponseDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				request={request}
				requestId={requestId}
				onSubmit={onApproveWithEdit}
			/>
		</>
	);
}

interface UseHotkeysOptions {
	enabled: boolean;
	onApprove: () => void;
	onEdit: () => void;
	onCreateMock: () => void;
}

// Listener escopado às ações do split button. Diferente do global
// `usePendingHotkeys`, este lida com Enter (aprovar a request inspecionada),
// E (abrir edit dialog) e M (criar mock).
function useHotkeys({ enabled, onApprove, onEdit, onCreateMock }: UseHotkeysOptions) {
	useEffect(() => {
		if (!enabled) return;

		const handler = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;

			const target = event.target as HTMLElement | null;
			if (target) {
				const tag = target.tagName;
				if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
				if (target.isContentEditable) return;
			}

			switch (event.key) {
				case 'Enter':
					event.preventDefault();
					onApprove();
					break;
				case 'e':
				case 'E':
					event.preventDefault();
					onEdit();
					break;
				case 'm':
				case 'M':
					event.preventDefault();
					onCreateMock();
					break;
			}
		};

		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [enabled, onApprove, onEdit, onCreateMock]);
}
