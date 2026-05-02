import { describe, expect, it, vi } from 'vitest';
import { buildRrwebOptions } from '../rrwebRecorder';

describe('buildRrwebOptions', () => {
	it('default: mascara só password (não todos os inputs)', () => {
		const opts = buildRrwebOptions({
			maskTextSelector: '.dbb-mask',
			maskAllInputs: false,
			recordCanvas: false,
			emit: vi.fn(),
		});
		const masking = opts.maskInputOptions as Record<string, boolean>;
		expect(masking.password).toBe(true);
		expect(masking.text).toBeFalsy();
		expect(opts.maskTextSelector).toBe('.dbb-mask');
	});

	it('maskAllInputs=true: cobre password, text, email, textarea', () => {
		const opts = buildRrwebOptions({
			maskTextSelector: '.dbb-mask',
			maskAllInputs: true,
			recordCanvas: false,
			emit: vi.fn(),
		});
		const masking = opts.maskInputOptions as Record<string, boolean>;
		expect(masking.password).toBe(true);
		expect(masking.text).toBe(true);
		expect(masking.email).toBe(true);
		expect(masking.textarea).toBe(true);
	});

	it('maskInputFn redige autocomplete cc-*', () => {
		const opts = buildRrwebOptions({
			maskTextSelector: '.x',
			maskAllInputs: false,
			recordCanvas: false,
			emit: vi.fn(),
		});
		const fn = opts.maskInputFn as (text: string, el: HTMLElement | null) => string;
		const fakeCc = {
			getAttribute: (n: string) => (n === 'autocomplete' ? 'cc-number' : null),
		} as unknown as HTMLElement;
		const fakeOther = { getAttribute: () => null } as unknown as HTMLElement;
		expect(fn('4111-1111-1111-1111', fakeCc)).toBe('[REDACTED]');
		expect(fn('hello', fakeOther)).toBe('hello');
	});

	it('recordCanvas é propagado', () => {
		const opts = buildRrwebOptions({
			maskTextSelector: '.x',
			maskAllInputs: false,
			recordCanvas: true,
			emit: vi.fn(),
		});
		expect(opts.recordCanvas).toBe(true);
	});
});
