import { describe, expect, test } from 'vitest';
import { groupTechsByCategory } from '../groupByCategory';
import type { TechHit } from '../types';

function hit(name: string, cats: number[], confidence = 100): TechHit {
	return { name, cats, confidence, evidence: [] };
}

describe('groupTechsByCategory', () => {
	test('returns empty when techs is empty', () => {
		expect(groupTechsByCategory([])).toEqual([]);
	});

	test('uses primary category (cats[0]) of each tech', () => {
		const techs = [
			hit('A', [12, 22]),
			hit('B', [12]),
			hit('C', [10]),
		];
		const groups = groupTechsByCategory(techs);
		const cat12 = groups.find((g) => g.categoryId === 12);
		expect(cat12?.techs.map((t) => t.name).sort()).toEqual(['A', 'B']);
		const cat10 = groups.find((g) => g.categoryId === 10);
		expect(cat10?.techs.map((t) => t.name)).toEqual(['C']);
	});

	test('orders groups by priority asc then categoryName asc', () => {
		const techs = [hit('A', [10]), hit('B', [12]), hit('C', [1])];
		const groups = groupTechsByCategory(techs);
		const priorities = groups.map((g) => g.priority);
		expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
	});

	test('sorts techs within group by confidence desc', () => {
		const techs = [
			hit('Low', [12], 30),
			hit('High', [12], 90),
			hit('Med', [12], 60),
		];
		const groups = groupTechsByCategory(techs);
		expect(groups[0].techs.map((t) => t.name)).toEqual(['High', 'Med', 'Low']);
	});

	test('drops techs whose primary category is not in CATEGORIES', () => {
		const techs = [hit('Phantom', [99999])];
		expect(groupTechsByCategory(techs)).toEqual([]);
	});

	test('skips tech with empty cats array', () => {
		const techs = [hit('NoCats', [])];
		expect(groupTechsByCategory(techs)).toEqual([]);
	});
});
