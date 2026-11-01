import type { Translation } from '../../types';
import type source from '../pt-BR/privacy';

const privacy: Translation<typeof source> = {
	loading: 'Loading privacy settings…',
	loadError: 'Error loading: {{error}}',
	saved: 'Settings saved.',
	error: 'Error: {{error}}',
	unknownError: 'unknown',
	errors: {
		loadFailed: 'Failed to load privacyConfig',
		saveFailed: 'Failed to save privacyConfig',
		purgeFailed: 'Failed to purge',
	},
	purged_one: 'Removed {{count}} old session.',
	purged_other: 'Removed {{count}} old sessions.',
	title: 'Privacy & Redaction',
	description:
		'Controls what is masked/removed from sessions before saving. Changes apply to future recordings.',
	enabled: {
		label: 'Redaction enabled',
		hint: 'When off, headers/bodies/console/state are recorded unfiltered. Use only on localhost.',
	},
	headers: {
		title: 'Network — Headers',
		keys: 'Header keys (one per line, case-insensitive)',
		regex: 'Header regex (one per line)',
	},
	bodies: {
		title: 'Network — Bodies',
		regex: 'Body regex (one per line — JWT, PAN, etc.)',
	},
	console: {
		title: 'Console',
		mask: 'Mask console',
		regex: 'Console regex (one per line)',
	},
	rrweb: {
		title: 'rrweb (DOM/inputs)',
		maskAllInputs: 'Mask all inputs (not only password)',
		maskTextSelector: 'CSS selector for masking text',
	},
	urlGate: {
		title: 'URL gate (do not record)',
		blacklist: 'Blocked domains (glob — e.g. <code>*.bank.com</code>)',
	},
	stackPaths: {
		title: 'Paths in stack traces',
		truncate:
			'Truncate user paths (<code>/Users/foo/…</code> → <code>/Users/&lt;user&gt;/…</code>)',
	},
	retention: {
		title: 'Retention',
		autoPurge: 'Automatic purge enabled',
		days: 'Keep sessions for (days)',
		purgeNow: 'Purge now',
	},
	saving: 'Saving…',
};

export default privacy;
