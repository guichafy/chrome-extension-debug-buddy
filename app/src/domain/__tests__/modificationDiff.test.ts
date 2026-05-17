import { describe, expect, test } from 'vitest';
import {
	diffHeaderRecord,
	diffRequestSnapshots,
	diffResponseSnapshots,
	type HeaderDiff,
} from '../modificationDiff';

describe('diffRequestSnapshots', () => {
	test('retorna undefined quando original e modified são iguais', () => {
		const snap = {
			url: 'https://api.test/users',
			method: 'GET',
			headers: { 'content-type': 'application/json' },
		};
		expect(diffRequestSnapshots(snap, snap)).toBeUndefined();
	});

	test('captura mudança de URL', () => {
		const original = { url: 'https://api.test/v1/users', method: 'GET', headers: {} };
		const modified = { url: 'https://api.test/v2/users', method: 'GET', headers: {} };
		expect(diffRequestSnapshots(original, modified)).toEqual({
			url: 'https://api.test/v2/users',
		});
	});

	test('captura mudança de método', () => {
		const original = { url: 'https://api.test', method: 'GET', headers: {} };
		const modified = { url: 'https://api.test', method: 'POST', headers: {} };
		expect(diffRequestSnapshots(original, modified)).toEqual({ method: 'POST' });
	});

	test('captura headers adicionados/modificados (snapshot final)', () => {
		const original = { url: 'https://api.test', method: 'GET', headers: { accept: 'text/html' } };
		const modified = {
			url: 'https://api.test',
			method: 'GET',
			headers: { accept: 'application/json', authorization: 'Bearer x' },
		};
		const diff = diffRequestSnapshots(original, modified);
		expect(diff).toEqual({
			headers: { accept: 'application/json', authorization: 'Bearer x' },
		});
	});

	test('captura postData modificado', () => {
		const original = {
			url: 'https://api.test',
			method: 'POST',
			headers: {},
			postData: '{"a":1}',
		};
		const modified = {
			url: 'https://api.test',
			method: 'POST',
			headers: {},
			postData: '{"a":2}',
		};
		expect(diffRequestSnapshots(original, modified)).toEqual({ postData: '{"a":2}' });
	});

	test('captura postData removido (original tinha, modified não)', () => {
		const original = {
			url: 'https://api.test',
			method: 'POST',
			headers: {},
			postData: '{"a":1}',
		};
		const modified = { url: 'https://api.test', method: 'POST', headers: {} };
		// postData explicitamente vira string vazia para marcar remoção.
		const diff = diffRequestSnapshots(original, modified);
		expect(diff).toEqual({ postData: '' });
	});

	test('combina múltiplas modificações', () => {
		const original = {
			url: 'https://api.test/v1',
			method: 'GET',
			headers: { accept: '*/*' },
		};
		const modified = {
			url: 'https://api.test/v2',
			method: 'POST',
			headers: { accept: 'application/json' },
			postData: '{}',
		};
		expect(diffRequestSnapshots(original, modified)).toEqual({
			url: 'https://api.test/v2',
			method: 'POST',
			headers: { accept: 'application/json' },
			postData: '{}',
		});
	});

	test('headers iguais sob ordem diferente NÃO disparam diff', () => {
		const original = {
			url: 'https://api.test',
			method: 'GET',
			headers: { a: '1', b: '2' },
		};
		const modified = {
			url: 'https://api.test',
			method: 'GET',
			headers: { b: '2', a: '1' },
		};
		expect(diffRequestSnapshots(original, modified)).toBeUndefined();
	});
});

describe('diffResponseSnapshots', () => {
	test('retorna undefined quando original e modified são iguais', () => {
		const snap = {
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			body: '{}',
		};
		expect(diffResponseSnapshots(snap, snap)).toBeUndefined();
	});

	test('captura mudança de status (com statusPhrase quando diff também)', () => {
		const original = { status: 200, statusPhrase: 'OK', headers: {} };
		const modified = { status: 503, statusPhrase: 'Service Unavailable', headers: {} };
		expect(diffResponseSnapshots(original, modified)).toEqual({
			status: 503,
			statusPhrase: 'Service Unavailable',
		});
	});

	test('captura body modificado', () => {
		const original = { status: 200, statusPhrase: 'OK', headers: {}, body: '[]' };
		const modified = { status: 200, statusPhrase: 'OK', headers: {}, body: '[1,2]' };
		expect(diffResponseSnapshots(original, modified)).toEqual({ body: '[1,2]' });
	});

	test('captura headers adicionados (snapshot final completo)', () => {
		const original = {
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
		};
		const modified = {
			status: 200,
			statusPhrase: 'OK',
			headers: {
				'content-type': 'application/json',
				'x-custom': 'value',
			},
		};
		const diff = diffResponseSnapshots(original, modified);
		expect(diff).toEqual({
			headers: { 'content-type': 'application/json', 'x-custom': 'value' },
		});
	});

	test('só statusPhrase mudou (status igual) também é diff', () => {
		const original = { status: 200, statusPhrase: 'OK', headers: {} };
		const modified = { status: 200, statusPhrase: 'Tudo certo', headers: {} };
		expect(diffResponseSnapshots(original, modified)).toEqual({ statusPhrase: 'Tudo certo' });
	});
});

describe('diffHeaderRecord', () => {
	test('detecta adição, remoção e modificação de headers', () => {
		const before = { a: '1', b: '2', c: '3' };
		const after = { a: '1', b: '22', d: '4' };
		const diff: HeaderDiff[] = diffHeaderRecord(before, after);
		// Ordenado por nome para snapshot estável.
		expect(diff).toEqual([
			{ name: 'a', kind: 'unchanged', value: '1' },
			{ name: 'b', kind: 'changed', value: '22', previousValue: '2' },
			{ name: 'c', kind: 'removed', previousValue: '3' },
			{ name: 'd', kind: 'added', value: '4' },
		]);
	});

	test('case-insensitive: A-Header é o mesmo que a-header', () => {
		const before = { 'X-Foo': 'a' };
		const after = { 'x-foo': 'b' };
		const diff = diffHeaderRecord(before, after);
		const changed = diff.find((d) => d.name.toLowerCase() === 'x-foo');
		expect(changed?.kind).toBe('changed');
		if (changed?.kind === 'changed') {
			expect(changed.value).toBe('b');
			expect(changed.previousValue).toBe('a');
		}
	});
});
