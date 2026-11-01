import type { Translation } from '../../types';
import type source from '../pt-BR/sessions';

const sessions: Translation<typeof source> = {
	page: {
		title: 'Saved sessions',
		retention: '{{saved}} / {{limit}} (retention limit)',
		empty: 'No saved sessions. Start a recording to create the first one.',
	},
	row: {
		inProgress: 'in progress',
		recorded: 'Recorded',
		imported: 'Imported',
		export: 'Export',
		delete: 'Delete',
	},
	recording: {
		label: 'Recording',
		statusAriaLabel:
			'Session: {{size}} of {{sizeLimit}} MB, {{minutes}} of {{durationLimit}} minutes',
		nearLimit: 'near the limit',
		size: 'Size',
		duration: 'Duration',
		stopHint: 'Click the switch to stop recording.',
		errors: {
			noTargetTab: 'No target tab',
			noActiveSession: 'No active session',
		},
	},
	import: {
		button: 'Import .dbsession',
		failed: 'Import failed: {{error}}',
		unknownError: 'unknown error',
		invalidFile: 'Invalid file: {{error}}',
	},
	originWarning: {
		title: 'Session from a different origin',
		description:
			'This session was recorded on <strong>{{importedOrigin}}</strong>, but the current tab is on<strong> {{currentOrigin}}</strong>. Replay works normally, but make sure the origin is trustworthy before continuing — sessions from unknown origins may contain unexpected content.',
		continue: 'Continue',
	},
	exportDialog: {
		title: 'Export session — read first',
		description:
			'This file contains EVERYTHING that was recorded: network requests and responses (including<strong> Authorization headers and cookies</strong> when not masked), every console message (including any <strong>password, token or card number</strong> that was logged with <code>console.log</code>), and the application state. Review it before attaching it anywhere public (Jira, Slack, email).',
		maskingHeading: 'Masking that will be applied to this export:',
		loadError: 'Error loading settings: {{error}}',
		loadErrorFallback: 'failed to read privacyConfig',
		loading: 'Loading…',
		maskingDisabled:
			'<strong>Warning:</strong> masking is <strong>disabled</strong> in Settings > Privacy. Nothing will be redacted in this file.',
		headers: 'Redacted headers: <strong>{{keys}} keys + {{regex}} regex</strong>',
		body: 'Body — regex applied: <strong>{{total}}</strong>',
		console: 'Console: <strong>{{state}}</strong>',
		consoleRedacting: 'redacting ({{total}} regex)',
		consoleDisabled: 'disabled for this session',
		rrweb: 'rrweb: <strong>{{state}}</strong>',
		rrwebAllInputs: 'all inputs masked',
		rrwebSensitiveOnly: 'password/cc/cvv only',
		truncatePaths: 'Truncate paths in stack traces: <strong>{{state}}</strong>',
		yes: 'yes',
		no: 'no',
		editHint: 'Edit these rules in <strong>Settings > Privacy</strong>.',
		confirm: 'Got it, export',
	},
};

export default sessions;
