import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import type { CategoryGroup } from '@/lib/insights/groupByCategory';
import { TechCategorySection } from '../TechCategorySection';

function group(overrides: Partial<CategoryGroup> = {}): CategoryGroup {
	return {
		categoryId: 12,
		categoryName: 'JavaScript frameworks',
		priority: 8,
		techs: [{ name: 'React', cats: [12], confidence: 100, evidence: [] }],
		...overrides,
	};
}

describe('TechCategorySection', () => {
	test('renders category name and tech count', () => {
		render(<TechCategorySection group={group()} defaultOpen={false} />);
		expect(screen.getByText('JavaScript frameworks')).toBeInTheDocument();
		expect(screen.getByText('1')).toBeInTheDocument();
	});

	test('hides techs by default when defaultOpen=false', () => {
		render(<TechCategorySection group={group()} defaultOpen={false} />);
		expect(screen.queryByText('React')).toBeNull();
	});

	test('shows techs when defaultOpen=true', () => {
		render(<TechCategorySection group={group()} defaultOpen={true} />);
		expect(screen.getByText('React')).toBeInTheDocument();
	});

	test('toggle button expands and collapses', async () => {
		const user = userEvent.setup();
		render(<TechCategorySection group={group()} defaultOpen={false} />);
		expect(screen.queryByText('React')).toBeNull();
		await user.click(screen.getByRole('button'));
		expect(screen.getByText('React')).toBeInTheDocument();
		await user.click(screen.getByRole('button'));
		expect(screen.queryByText('React')).toBeNull();
	});
});
