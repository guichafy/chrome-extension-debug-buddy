import type { Translation } from '../../types';
import type source from '../pt-BR/replay';

const replay: Translation<typeof source> = {
	page: {
		loading: 'Loading…',
		title: 'Replay — {{url}}',
		stats: '{{events}} events · {{phases}} phases · {{visual}} visual events',
		originBanner:
			'Imported session recorded on <strong>{{importedOrigin}}</strong>, but the current tab is on <strong>{{currentOrigin}}</strong>. Make sure the origin is trustworthy.',
		noVisual: 'Session without visual capture.',
		noVisualHint: 'This session was recorded before Phase 2 or with rrweb disabled.',
		tabs: {
			timeline: 'Timeline',
			requests: 'Requests',
			recommendations: 'Recommendations',
		},
		filters: 'Filters:',
		noEvents: 'No events up to the current point ({{seconds}}s).',
	},
	phases: {
		title: 'Environment Phases ({{total}})',
		phase: 'Phase {{number}} — {{tech}}',
		noDetection: 'no detection',
	},
	recommendations: {
		severity: {
			error: 'ERROR',
			warn: 'WARNING',
			info: 'INFO',
		},
		none: 'No recommendations.',
		noneWithFilters: 'No recommendations with the current filters.',
	},
	categories: {
		security: 'Security',
		performance: 'Performance',
	},
	requests: {
		legacySession: 'Session recorded before Phase 7 — no rich request data.',
		noneYet: 'No requests captured up to this point of the recording.',
	},
	details: {
		description: 'Details of the request captured in the replay session.',
		url: 'URL',
		method: 'Method',
		status: 'Status',
		resourceType: 'Resource type',
		mimeType: 'MIME type',
		duration: 'Duration',
		mocked: 'Mocked',
		transformed: 'Transformed',
		mockLatency: 'Mock latency',
		yes: 'yes',
		noRequestHeaders: 'No request headers captured in this session.',
		noRequestBody: 'No request body captured for this session.',
		noResponseHeaders: 'No response headers captured in this session.',
	},
	liveInsights: {
		hosts_one: '{{count}} host',
		hosts_other: '{{count}} hosts',
		recommendations_one: '{{count}} recommendation',
		recommendations_other: '{{count}} recommendations',
		summary: '{{hosts}} · {{recommendations}}',
		clear: 'clear',
		startAnalysisHint: 'Start the analysis to collect insights for this page.',
		hostRecommendations_one: '{{count}} recommendation on this host',
		hostRecommendations_other: '{{count}} recommendations on this host',
		mostRecentHost: 'most recent host',
		noDetection: 'no detection',
		recsShort_one: '{{count}} rec',
		recsShort_other: '{{count}} recs',
		waitingFirstDetection: 'Waiting for the first probe detection…',
		noRecommendationsYet: 'No recommendations yet. Load page resources to trigger rules.',
		noProbeDetection:
			'No probe detection for this host. The recommendations below come from captured HTTP responses.',
		noTechsYet:
			'No technology detected for this host yet. Wait for the next Fetch or SPA navigation.',
		noHostRecommendations: 'No recommendations for this host.',
	},
	techItem: {
		officialSite: 'Official site of {{name}}',
	},
};

export default replay;
