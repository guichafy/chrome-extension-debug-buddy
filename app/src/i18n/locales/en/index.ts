import type { Translation } from '../../types';
import type source from '../pt-BR';
import common from './common';
import layout from './layout';
import privacy from './privacy';
import rules from './rules';
import rulesLab from './rulesLab';
import selectTab from './selectTab';
import sessions from './sessions';

const en: Translation<typeof source> = {
	common,
	layout,
	privacy,
	rules,
	rulesLab,
	selectTab,
	sessions,
};

export default en;
