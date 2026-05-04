import type { CategoryMeta, CompiledTech } from '../types';
import categoriesData from './categories.json';
import { compileCatalogBase, type RawTechBase } from './compile';

interface RawTech extends RawTechBase {
	website: string;
	icon?: string;
	description?: string;
}

// Vite eager glob: importa todos os JSONs de letra no boot.
// O padrão [a-z_].json cobre apenas arquivos de 1 letra + underscore —
// categories.json e groups.json têm nomes mais longos e não são incluídos.
const letterModules = import.meta.glob<Record<string, RawTech>>('./[a-z_].json', {
	eager: true,
	import: 'default',
});

export const COMPILED_CATALOG: CompiledTech[] = compileCatalogBase(
	letterModules,
	'[insights]',
	(raw) => ({ icon: raw.icon, website: raw.website, description: raw.description }),
);

export const CATEGORIES: Record<string, CategoryMeta> = categoriesData as Record<
	string,
	CategoryMeta
>;
