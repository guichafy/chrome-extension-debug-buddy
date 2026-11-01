import type { Translation } from '../../types';
import type source from '../pt-BR/common';

const common: Translation<typeof source> = {
	actions: {
		cancel: 'Cancel',
		close: 'Close',
		save: 'Save',
		toggleSidebar: 'Toggle Sidebar',
	},
	errors: {
		unknown: 'Unknown error',
		unknownApplyEdit: 'Unknown error while applying the edit.',
		noResponse: 'No response',
	},
};

export default common;
