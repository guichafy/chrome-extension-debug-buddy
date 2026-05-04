import { CATEGORIES } from './catalog';
import type { TechHit } from './types';

export interface CategoryGroup {
	categoryId: number;
	categoryName: string;
	priority: number;
	techs: TechHit[];
}

export function groupTechsByCategory(techs: TechHit[]): CategoryGroup[] {
	// Cada tech pode pertencer a múltiplas categorias. Para evitar duplicação
	// visual, atribuímos cada tech à PRIMEIRA categoria do seu cats[] (a
	// principal por convenção do schema Wappalyzer).
	const byCat = new Map<number, TechHit[]>();
	for (const tech of techs) {
		const primary = tech.cats[0];
		if (primary === undefined) continue;
		const arr = byCat.get(primary);
		if (arr) arr.push(tech);
		else byCat.set(primary, [tech]);
	}

	const groups: CategoryGroup[] = [];
	for (const [catId, list] of byCat) {
		const meta = CATEGORIES[String(catId)];
		if (!meta) continue;
		groups.push({
			categoryId: catId,
			categoryName: meta.name,
			priority: meta.priority,
			techs: [...list].sort((a, b) => b.confidence - a.confidence),
		});
	}
	groups.sort(
		(a, b) => a.priority - b.priority || a.categoryName.localeCompare(b.categoryName),
	);
	return groups;
}
