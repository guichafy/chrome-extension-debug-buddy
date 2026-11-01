import type { Translation } from '../../types';
import type source from '../pt-BR';
import commandCenter from './commandCenter';
import common from './common';
import layout from './layout';
import privacy from './privacy';
import replay from './replay';
import ruleEditor from './ruleEditor';
import rules from './rules';
import rulesLab from './rulesLab';
import selectTab from './selectTab';
import sessions from './sessions';

const en: Translation<typeof source> = {
	commandCenter,
	common,
	layout,
	privacy,
	replay,
	ruleEditor,
	rules,
	rulesLab,
	selectTab,
	sessions,
};

export default en;
