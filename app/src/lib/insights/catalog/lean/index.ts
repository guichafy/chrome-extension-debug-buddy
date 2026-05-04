import type { CompiledTech } from '../../types';
import { compileCatalogBase, type RawTechBase } from '../compile';

// Vite eager glob: importa todos os JSONs de letra no boot.
// [a-z_].json exclui nomes compostos como categories.json / groups.json.
const letterModules = import.meta.glob<Record<string, RawTechBase>>('./[a-z_].json', {
	eager: true,
	import: 'default',
});

export const COMPILED_CATALOG_LEAN: CompiledTech[] = compileCatalogBase(
	letterModules,
	'[insights/lean]',
	// lean — campos UI-only (icon, website, description) omitidos; website '' satisfaz o tipo.
	() => ({ website: '' }),
);
