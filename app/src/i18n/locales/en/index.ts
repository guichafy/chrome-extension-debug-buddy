import type { Translation } from '../../types';
import type source from '../pt-BR';
import common from './common';
import layout from './layout';
import privacy from './privacy';
import ruleEditor from './ruleEditor';
import rules from './rules';
import rulesLab from './rulesLab';
import selectTab from './selectTab';
import sessions from './sessions';

const en: Translation<typeof source> = {
	common,
	layout,
	privacy,
	ruleEditor,
	rules,
	rulesLab,
	selectTab,
	sessions,
};

export default en;
