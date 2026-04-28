import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RulePresetId } from '@/types/rules';
import { createPresetRule } from '@/domain/rulePresets';

interface RulePresetCardProps {
	presetId: RulePresetId;
	onCreate: () => void;
}

const PRESET_DESCRIPTIONS: Record<RulePresetId, string> = {
	http_error_500: 'Retorna 500 Internal Server Error com payload JSON.',
	http_error_404: 'Retorna 404 Not Found com payload JSON.',
	http_error_401: 'Retorna 401 Unauthorized com payload JSON.',
	http_error_403: 'Retorna 403 Forbidden com payload JSON.',
	latency_fixed: 'Atrasa a resposta em 1s e devolve 200 OK.',
	latency_range: 'Atrasa a resposta entre 0.5s e 2s e devolve 200 OK.',
	empty_response: 'Devolve 200 OK com body vazio.',
	broken_json: 'Devolve 200 OK com JSON inválido sintaticamente.',
};

export function RulePresetCard({ presetId, onCreate }: RulePresetCardProps) {
	const draft = createPresetRule(presetId);
	return (
		<Card className="flex h-full flex-col">
			<CardHeader>
				<CardTitle className="text-sm">{draft.name}</CardTitle>
				<CardDescription className="text-xs">{PRESET_DESCRIPTIONS[presetId]}</CardDescription>
			</CardHeader>
			<CardContent className="mt-auto">
				<Button size="sm" variant="outline" onClick={onCreate} className="w-full">
					Criar a partir deste preset
				</Button>
			</CardContent>
		</Card>
	);
}
