import type { LucideIconName } from '@/components/ui/lucide-icon';
import type { RulePresetId } from '@/types/rules';

export interface PresetGroup {
	id: 'http_errors' | 'latency' | 'payload';
	label: string;
	presets: RulePresetId[];
}

export const PRESET_GROUPS: PresetGroup[] = [
	{
		id: 'http_errors',
		label: 'HTTP Errors',
		presets: ['http_error_500', 'http_error_404', 'http_error_401', 'http_error_403'],
	},
	{
		id: 'latency',
		label: 'Latência',
		presets: ['latency_fixed', 'latency_range'],
	},
	{
		id: 'payload',
		label: 'Payload anômalo',
		presets: ['empty_response', 'broken_json'],
	},
];

export interface PresetVisuals {
	iconName: LucideIconName;
	bgClass: string;
	textClass: string;
}

export function getPresetVisuals(presetId: RulePresetId): PresetVisuals {
	switch (presetId) {
		case 'http_error_500':
		case 'http_error_404':
		case 'http_error_401':
		case 'http_error_403':
			return {
				iconName: 'octagon-alert',
				bgClass: 'bg-rose-500/10',
				textClass: 'text-rose-300',
			};
		case 'latency_fixed':
		case 'latency_range':
			return {
				iconName: 'timer',
				bgClass: 'bg-amber-500/10',
				textClass: 'text-amber-300',
			};
		case 'empty_response':
		case 'broken_json':
			return {
				iconName: 'file-json',
				bgClass: 'bg-sky-500/10',
				textClass: 'text-sky-300',
			};
		default: {
			const exhaustive: never = presetId;
			throw new Error(`Preset sem agrupamento visual: ${exhaustive as string}`);
		}
	}
}
