import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { TechHit } from '@/lib/insights/types';
import { TechItem } from '../TechItem';

function hit(name: string, overrides: Partial<TechHit> = {}): TechHit {
	return { name, cats: [12], confidence: 100, evidence: [], ...overrides };
}

describe('TechItem', () => {
	test('renders tech name', () => {
		render(<TechItem tech={hit('React')} />);
		expect(screen.getByText('React')).toBeInTheDocument();
	});

	test('renders version when present', () => {
		render(<TechItem tech={hit('React', { version: '18.2.0' })} />);
		expect(screen.getByText('18.2.0')).toBeInTheDocument();
	});

	test('does not render version pill when absent', () => {
		const { container } = render(<TechItem tech={hit('React')} />);
		expect(container.textContent).not.toMatch(/\d+\.\d+\.\d+/);
	});

	test('renders confidence pill for med (50-74)', () => {
		render(<TechItem tech={hit('X', { confidence: 60 })} />);
		expect(screen.getByText(/med/i)).toBeInTheDocument();
	});

	test('renders confidence pill for low (<50)', () => {
		render(<TechItem tech={hit('X', { confidence: 30 })} />);
		expect(screen.getByText(/low/i)).toBeInTheDocument();
	});

	test('does not render confidence pill for high (>=75)', () => {
		const { container } = render(<TechItem tech={hit('X', { confidence: 90 })} />);
		expect(container.textContent).not.toMatch(/\bmed\b|\blow\b/i);
	});

	test('renders website link when present', () => {
		render(<TechItem tech={hit('X', { website: 'https://example.com' })} />);
		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', 'https://example.com');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
	});

	test('does not render link when website is absent', () => {
		render(<TechItem tech={hit('X')} />);
		expect(screen.queryByRole('link')).toBeNull();
	});
});
