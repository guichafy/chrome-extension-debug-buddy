import type { Translation } from '../../types';
import type source from '../pt-BR';
import common from './common';
import layout from './layout';
import privacy from './privacy';
import selectTab from './selectTab';
import sessions from './sessions';

const en: Translation<typeof source> = {
	common,
	layout,
	privacy,
	selectTab,
	sessions,
};

export default en;
