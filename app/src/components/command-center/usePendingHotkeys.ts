import { useEffect } from 'react';

interface UsePendingHotkeysOptions {
	enabled: boolean;
	/**
	 * Habilita J/K (próximo/anterior). Quando false, esses keystrokes não são
	 * interceptados — o usuário pode usar J/K para outras coisas (ex.: scroll
	 * via vimium). Sem fallback silencioso: nunca chamamos `preventDefault`
	 * para depois fazer nada.
	 */
	navEnabled: boolean;
	onApprove: () => void;
	onIgnore: () => void;
	onNext: () => void;
	onPrev: () => void;
	onEscape?: () => void;
}

// Registra atalhos globais (A/I/J/K/Esc) usados quando há requisições pendentes.
// Ignora eventos disparados a partir de inputs/textarea/contenteditable para
// não roubar o foco do FilterBar ou do Inspector.
export function usePendingHotkeys({
	enabled,
	navEnabled,
	onApprove,
	onIgnore,
	onNext,
	onPrev,
	onEscape,
}: UsePendingHotkeysOptions) {
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

			switch (event.key.toLowerCase()) {
				case 'a':
					event.preventDefault();
					onApprove();
					break;
				case 'i':
					event.preventDefault();
					onIgnore();
					break;
				case 'j':
					if (!navEnabled) return;
					event.preventDefault();
					onNext();
					break;
				case 'k':
					if (!navEnabled) return;
					event.preventDefault();
					onPrev();
					break;
				case 'escape':
					if (onEscape) {
						event.preventDefault();
						onEscape();
					}
					break;
			}
		};

		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [enabled, navEnabled, onApprove, onIgnore, onNext, onPrev, onEscape]);
}
