import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RulePresetId } from '@/types/rules';
import { createPresetRule } from '@/domain/rulePresets';

interface RulePresetCardProps {
	presetId: RulePresetId;
	onCreate: () => void;
}

export function RulePresetCard({ presetId, onCreate }: RulePresetCardProps) {
	const draft = createPresetRule(presetId);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">{draft.name}</CardTitle>
			</CardHeader>
			<CardContent>
				<Button size="sm" variant="outline" onClick={onCreate} className="w-full">
					Criar a partir deste preset
				</Button>
			</CardContent>
		</Card>
	);
}
