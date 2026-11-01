import type { Translation } from '../../types';
import type source from '../pt-BR';
import common from './common';
import layout from './layout';

const en: Translation<typeof source> = {
	common,
	layout,
};

export default en;
