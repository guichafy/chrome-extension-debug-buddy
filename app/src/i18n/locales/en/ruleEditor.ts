import type { Translation } from '../../types';
import type source from '../pt-BR/ruleEditor';

const ruleEditor: Translation<typeof source> = {
	defaultName: 'New Rule',
	steps: {
		type: {
			label: 'Type',
			description: 'Choose the rule behavior.',
		},
		matcher: {
			label: 'Matcher',
			description: 'Define which requests are targeted.',
		},
		action: {
			label: 'Action',
			description: 'Configure how the rule acts on the request.',
		},
		review: {
			label: 'Review',
			description: 'Confirm before saving.',
		},
		navAriaLabel: 'Wizard steps',
	},
	typeDescriptions: {
		mock: 'Does not call the server — returns the mocked response.',
		transform: 'Calls the server and applies changes to the response.',
		requestDelay: 'Delays the response before returning it to the client.',
		breakpoint: 'Pauses before responding and lets you edit the response in flight.',
	},
	validation: {
		nameEmpty: 'Enter a name for the rule',
		urlMatcherMissing: 'The rule needs an enabled URL matcher',
		urlPatternEmpty: 'Fill in the URL pattern before saving',
		methodEmpty: 'Select at least one HTTP method or disable the method matcher',
	},
	typeStep: {
		nameLabel: 'Rule Name',
		namePlaceholder: 'E.g.: Login API',
		stageLegend: 'Stage',
		stageHelp:
			'<strong>Request</strong> runs before the request goes out to the network; <strong>Response</strong> runs after the server responds. Each rule works on a single stage — to act on both, create two rules.',
		stageRequestOption: 'Request — before sending',
		stageResponseOption: 'Response — after it returns',
		stageLocked:
			'The stage cannot be changed while editing — actions and matchers depend on it. To switch, create a new rule.',
		typeLegend: 'Rule type',
		typeLocked: 'The type cannot be changed while editing — to change it, create a new rule.',
		typeHelp: 'Choose the initial behavior. The "Action" step lets you chain more actions later.',
		selected: 'Selected',
		enabled: 'Rule enabled',
	},
	matcherStep: {
		title: 'Match Conditions',
		description:
			'Define the URL pattern and the HTTP methods that trigger this rule. The panel on the right shows in real time whether the rule would match a test URL.',
	},
	actionStep: {
		chain: 'Action chain ({{total}}) — ',
		stage: 'Stage: {{stage}}',
		title: 'Rule actions',
		description:
			'Actions run in order. A terminal action (Mock, Block, Breakpoint) stops the chain — actions after it become unreachable.',
	},
	review: {
		unnamed: '(unnamed)',
		activeOnSave: 'Enabled on save',
		pausedOnSave: 'Paused on save',
		type: 'Type',
		matcher: 'Matcher',
		action: 'Action',
		fixErrors: 'Fix the items below before saving',
		errorStep: '({{step}} step)',
		ready: 'Ready to save',
		readyHint: 'All required fields are filled in.',
	},
	diff: {
		noChanges: 'No changes made — saving will keep the rule as it is.',
		title: 'Changes compared to the current rule',
		name: 'Name',
		state: 'State',
		matcher: 'Matcher',
		action: 'Action',
		active: 'Enabled',
		paused: 'Paused',
	},
	dialog: {
		back: 'Back',
		editTitle: 'Edit Rule',
		newTitle: 'New rule',
		configureTitle: 'Configure rule',
		editDescription: 'Modify the rule details.',
		welcomeDescription: 'Start from scratch or pick a template.',
		previous: 'Previous',
		next: 'Next',
		add: 'Add',
	},
	discard: {
		title: 'Discard changes?',
		description:
			'You have unsaved changes. Leaving now will discard everything modified in this wizard.',
		keepEditing: 'Keep editing',
		confirm: 'Discard',
	},
	presetWelcome: {
		blankTitle: 'Start from scratch',
		blankDescription: 'Configure the matcher and the action manually.',
		templatesTitle: 'Use a template',
		templatesHint: 'Pre-fills the wizard. You can still edit before saving.',
	},
	breakpoint: {
		descriptionLabel: 'Description (optional)',
		descriptionPlaceholder: 'E.g.: pause to check the auth token before continuing',
		descriptionHelp:
			'This description shows up in the response inspector when the rule fires — handy to remember why the breakpoint was set.',
		infoTitle: 'About the Breakpoint',
		infoText:
			'When this rule matches, the request is paused and the inspection dialog opens so you can edit the response manually before continuing.',
	},
	block: {
		reasonLabel: 'Block reason',
		reasons: {
			failed: 'Generic error — net::ERR_FAILED in devtools.',
			aborted: 'Request canceled — net::ERR_ABORTED.',
			timedOut: 'Simulated timeout — net::ERR_TIMED_OUT.',
			accessDenied: 'Access denied by policy — net::ERR_ACCESS_DENIED.',
			connectionFailed: 'TCP connection failed — net::ERR_CONNECTION_FAILED.',
			connectionRefused: 'Server refused — net::ERR_CONNECTION_REFUSED.',
			nameNotResolved: 'DNS failed — net::ERR_NAME_NOT_RESOLVED.',
			blockedByClient: 'Blocked by extension/client — net::ERR_BLOCKED_BY_CLIENT.',
			internetDisconnected: 'No connectivity — net::ERR_INTERNET_DISCONNECTED.',
		},
		infoTitle: 'Immediate failure, no network call',
		infoText:
			'The request is terminated with <code>Fetch.failRequest</code> and the selected reason. Useful to simulate offline scenarios, broken DNS, timeouts or policy blocks without touching the server.',
	},
	delay: {
		errors: {
			empty: 'Enter a value in milliseconds.',
			notDigits: 'Enter a non-negative integer (digits only).',
			negative: 'The delay must be an integer greater than or equal to zero.',
		},
		label: 'Delay in milliseconds',
		help: 'Minimum 0ms. Larger values increase the wait time perceived by the client.',
		presets: 'Quick presets',
		infoTitle: 'About the Delay',
		infoText:
			'The remote server is called normally; the response is held for <strong>{{ms}}ms</strong> before being returned to the client.',
	},
	headerMatchers: {
		empty: 'No headers captured in this request.',
		title: 'Header matchers (optional)',
		selected_one: '{{count}} selected of {{total}}',
		selected_other: '{{count}} selected of {{total}}',
		available_one: '{{count}} available',
		available_other: '{{count}} available',
		help: 'Select headers to require the same value in the original request. Sensitive headers are masked.',
		columns: {
			include: 'Inc.',
			type: 'Type',
			name: 'Name',
			value: 'Value',
		},
	},
	chain: {
		terminal: 'Terminal',
		paused: 'Paused',
		invalidForStage: 'This action is not valid in the current stage ({{stage}}).',
		unreachable: 'Unreachable — a previous terminal action stops the chain.',
		moveUp: 'Move action {{position}} up',
		moveDown: 'Move action {{position}} down',
		remove: 'Remove action {{position}}',
		terminatedBy:
			'The chain is already terminated by "{{action}}". Remove it before adding new actions.',
		responseChainCapped:
			'A chain with multiple actions in stage=response is not supported yet — the current engine runs only the first one. Remove this action to swap it for another.',
		empty: 'No actions configured. Add the first one to define the rule behavior.',
		add: 'Add action',
	},
	headerOps: {
		namePlaceholder: 'X-Custom-Header',
		valuePlaceholder: 'value',
		nameAriaLabel: 'Header name ({{mode}})',
		valueAriaLabel: 'Header value ({{mode}})',
		add: 'Add',
		removeHeader: 'Remove header {{name}}',
		removeTitle: 'Remove headers',
		removeHelp: 'Headers removed before <strong>set</strong> and <strong>add</strong> are applied.',
		removeNameAriaLabel: 'Name of the header to remove',
		undoRemove: 'Undo removal of {{name}}',
		setTitle: 'Set headers',
		setHelp: 'Replaces the existing value (or creates it if missing).',
		addTitle: 'Add headers',
		addHelp: 'Adds only if missing (case-insensitive).',
		order:
			'Order of application: <strong>remove</strong> → <strong>set</strong> → <strong>add</strong>.',
	},
	modifyTabs: {
		urlAndMethod: 'URL & Method',
		status: 'Status',
		headers: 'Headers',
		body: 'Body',
	},
	requestModify: {
		overrideUrl: 'Override URL',
		urlPlaceholder: 'https://api.example.com/users/42',
		urlHelp: 'Fully replaces the URL before sending (useful to redirect to another host or path).',
		overrideMethod: 'Override HTTP method',
		replaceBody: 'Replace body',
		bodyHelp:
			'The content replaces the original request <code>postData</code>. For targeted edits (JSONPath), prefer <code>bodyOperations</code> (coming soon to the editor).',
		infoTitle: 'Request modifier',
		infoText:
			'Runs in the <strong>Request</strong> stage, before the request goes out to the network. The chain continues after the modify — combine it with other actions (mock, block) in the same rule.',
	},
	responseModify: {
		statusErrors: {
			empty: 'Enter an HTTP status code.',
			notDigits: 'The status must contain digits only.',
			outOfRange: 'The status must be between 100 and 599.',
		},
		overrideStatus: 'Override status code',
		statusLabel: 'Status (100–599)',
		statusTextLabel: 'Status text (optional)',
		replaceBody: 'Replace body',
		bodyHelp: 'For JSONPath edits, consider the <strong>Transform</strong> action.',
		infoTitle: 'Response modifier',
		infoText:
			'Runs in the <strong>Response</strong> stage, after the server responds and before returning to the browser. The chain continues after the modify.',
	},
};

export default ruleEditor;
