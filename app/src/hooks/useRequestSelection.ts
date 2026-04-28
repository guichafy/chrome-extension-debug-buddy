import { useCallback, useMemo, useState } from 'react';
import type { InterceptedResponse } from '@/types/intercepted';

export interface RequestSelectionState {
	selectedId: string | null;
	selected: InterceptedResponse | null;
	select: (id: string) => void;
	clear: () => void;
}

export function useRequestSelection(
	requests: Record<string, InterceptedResponse>,
): RequestSelectionState {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const selected = useMemo<InterceptedResponse | null>(() => {
		if (!selectedId) return null;
		return requests[selectedId] ?? null;
	}, [requests, selectedId]);

	const select = useCallback((id: string) => setSelectedId(id), []);
	const clear = useCallback(() => setSelectedId(null), []);

	return { selectedId, selected, select, clear };
}
