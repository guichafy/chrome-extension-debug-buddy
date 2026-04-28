import React from 'react';
import type { InterceptedResponse } from '@/types/intercepted';

interface QuickMockPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	request: InterceptedResponse;
	requestId: string;
}

// Stub — substituído pela implementação real na Phase 3.
export function QuickMockPanel(_: QuickMockPanelProps) {
	return null;
}
