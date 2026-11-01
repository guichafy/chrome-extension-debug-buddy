import type { Translation } from '../../types';
import type source from '../pt-BR/selectTab';

const selectTab: Translation<typeof source> = {
	title: 'Select a tab to intercept',
	description: 'Choose the tab whose network requests you want to monitor.',
	tabCount_one: '{{count}} tab',
	tabCount_other: '{{count}} tabs',
	visibleTabs: '{{visible}} of {{total}} tabs visible',
	keyboard: {
		navigate: 'Navigate',
		select: 'Select',
		close: 'Close',
	},
	list: {
		ariaLabel: 'Available tabs',
		current: 'Current',
		invalidUrl: '(invalid URL)',
	},
	search: {
		ariaLabel: 'Search tabs by title or URL',
		placeholder: 'Search by title or URL...',
	},
	domains: {
		all: 'All',
		allAriaLabel: 'All — Show all domains',
	},
	empty: {
		loading: 'Loading tabs',
		noTabs: 'No tabs available for analysis',
		noResults: 'No tab matches <query>{{query}}</query>',
		clearSearch: 'Clear search',
		loadError: 'Error loading tabs',
		unknownError: 'Unknown error',
		retry: 'Try again',
	},
	errors: {
		tabsQueryUnknown: 'Unknown error in chrome.tabs.query',
	},
};

export default selectTab;
