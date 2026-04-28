import { describe, expect, test } from 'vitest';
import { getStatusBadgeClass, getStatusCategory } from '../statusBadge';

describe('getStatusBadgeClass', () => {
	test('5xx returns destructive classes', () => {
		expect(getStatusBadgeClass(500)).toContain('bg-destructive');
		expect(getStatusBadgeClass(503)).toContain('text-destructive');
		expect(getStatusBadgeClass(599)).toContain('border-destructive');
	});

	test('4xx returns warning classes', () => {
		expect(getStatusBadgeClass(400)).toContain('bg-warning');
		expect(getStatusBadgeClass(404)).toContain('text-warning');
		expect(getStatusBadgeClass(429)).toContain('border-warning');
	});

	test('3xx returns info classes', () => {
		expect(getStatusBadgeClass(301)).toContain('bg-info');
		expect(getStatusBadgeClass(304)).toContain('text-info');
		expect(getStatusBadgeClass(308)).toContain('border-info');
	});

	test('2xx returns success classes', () => {
		expect(getStatusBadgeClass(200)).toContain('bg-success');
		expect(getStatusBadgeClass(204)).toContain('text-success');
		expect(getStatusBadgeClass(299)).toContain('border-success');
	});

	test('1xx returns muted classes', () => {
		expect(getStatusBadgeClass(100)).toContain('bg-muted');
		expect(getStatusBadgeClass(102)).toContain('text-muted-foreground');
	});

	test('unknown / 0 / negative returns muted classes', () => {
		expect(getStatusBadgeClass(0)).toContain('bg-muted');
		expect(getStatusBadgeClass(-1)).toContain('bg-muted');
	});

	test('boundary 200 vs 199', () => {
		expect(getStatusBadgeClass(200)).toContain('bg-success');
		expect(getStatusBadgeClass(199)).toContain('bg-muted');
	});
});

describe('getStatusCategory', () => {
	test.each([
		[500, 'Server Error'],
		[404, 'Client Error'],
		[301, 'Redirect'],
		[200, 'Success'],
		[100, 'Informational'],
		[0, 'Unknown'],
	])('status %i → %s', (status, expected) => {
		expect(getStatusCategory(status)).toBe(expected);
	});
});
