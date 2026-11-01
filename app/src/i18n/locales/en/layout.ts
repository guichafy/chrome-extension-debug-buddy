import type { Translation } from '../../types';
import type source from '../pt-BR/layout';

const layout: Translation<typeof source> = {
	nav: {
		section: 'Main',
		commandCenter: 'Command Center',
		rulesLab: 'Rules Lab',
		sessions: 'Sessions',
		privacy: 'Privacy',
	},
	sidebar: {
		logoAlt: 'Logo',
		developedBy: 'Developed by',
		copyright: '© 2025 - All rights reserved',
	},
	language: {
		label: 'Language',
		saveError: 'Could not save the language: {{message}}',
	},
	header: {
		selectTab: 'Select Tab',
		tabUnavailableSelectAnother: 'Tab unavailable — select another',
		tabUnavailableAriaLabel: 'Tab unavailable: {{title}}. Click to select another one.',
		previouslySelectedTab: 'previously selected tab',
		tabNoLongerAvailable: 'Tab is no longer available',
		lastTab: 'Last tab: {{title}}',
		clickToSelectNewTab: 'Click to select a new tab.',
		startAnalysis: 'Start Analysis',
		stopAnalysis: 'Stop Analysis',
		liveInsights: 'Live Insights',
		liveInsightsDescription: 'Real-time stack detections and recommendations for the target tab.',
	},
	metrics: {
		noRequestsYet: 'No requests yet',
		requests_one: '{{count}} request',
		requests_other: '{{count}} requests',
		requestsTooltip: 'Total requests captured by the current analysis session.',
		transferred: '{{value}} transferred',
		transferredTooltip:
			'Bytes received over the wire (CDP transferSize). Includes headers and compressed payload when applicable.',
		resources: '{{value}} resources',
		resourcesTooltip:
			'Sum of the decoded response bodies captured by the extension. Binary bodies or bodies above the cap are not counted (they become bodyUnavailableReason).',
	},
	dock: {
		ignoreAllResult: '{{succeeded}} ignored successfully, {{failed}} failed:\n{{detail}}',
	},
};

export default layout;
