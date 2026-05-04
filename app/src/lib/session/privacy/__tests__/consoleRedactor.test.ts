import { describe, expect, it } from 'vitest';
import type { ConsoleArgPreview } from '../../types';
import { redactConsoleArgs } from '../consoleRedactor';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';

describe('redactConsoleArgs', () => {
	const arg = (description: string): ConsoleArgPreview => ({
		type: 'string',
		description,
	});

	it('redige "password: hunter2" em description', () => {
		const out = redactConsoleArgs(
			[arg('password: hunter2'), arg('safe')],
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out[0].description).toContain('[REDACTED]');
		expect(out[0].description).not.toContain('hunter2');
		expect(out[1].description).toBe('safe');
	});

	it('redige JWT em description', () => {
		const jwt =
			'eyJabcdefghij.eyJklmnopqrst.signed1234567890_abcdefghij1234567890_abcdefghij';
		const out = redactConsoleArgs([arg(`bearer ${jwt}`)], DEFAULT_REDACTION_CONFIG);
		expect(out[0].description).toContain('[REDACTED]');
		expect(out[0].description).not.toContain(jwt);
	});

	it('redige preview.properties[].value', () => {
		const out = redactConsoleArgs(
			[
				{
					type: 'object',
					description: 'Object',
					preview: {
						properties: [
							{ name: 'pwd', type: 'string', value: 'password: hunter2' },
							{ name: 'name', type: 'string', value: 'alice' },
						],
						overflow: false,
					},
				},
			],
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out[0].preview?.properties[0].value).toContain('[REDACTED]');
		expect(out[0].preview?.properties[1].value).toBe('alice');
	});

	it('respeita enabled=false (passthrough)', () => {
		const input = [arg('password: hunter2')];
		const out = redactConsoleArgs(input, { ...DEFAULT_REDACTION_CONFIG, enabled: false });
		expect(out[0].description).toBe('password: hunter2');
	});

	it('respeita consoleEnabled=false (não redige nada)', () => {
		const out = redactConsoleArgs([arg('password: hunter2')], {
			...DEFAULT_REDACTION_CONFIG,
			consoleEnabled: false,
		});
		expect(out[0].description).toBe('password: hunter2');
	});
});
