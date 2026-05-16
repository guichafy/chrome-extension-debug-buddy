import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '../../types/intercepted';
import type { Action, Rule, TransformOperation } from '../../types/rules';
import {
	applyBodyOperations,
	applyHeaderOps,
	flattenChainActions,
	normalizeInterceptedResponse,
	processStageChain,
} from '../intercepted';
import type { MatchedRule } from '../ruleMatching';

const baseRule = (id: string, actions: Action[], stage: Rule['stage'] = 'response'): Rule => ({
	id,
	name: id,
	enabled: true,
	stage,
	matchers: [],
	actions,
	createdAt: 0,
	updatedAt: 0,
});

describe('normalizeInterceptedResponse', () => {
	test('adapta registro antigo com headers/body no topo para response', () => {
		const legacy: InterceptedResponse = {
			url: 'https://example.test/users',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: { 'Content-Type': 'application/json' },
			mimeType: 'application/json',
			type: 'xhr',
			timestamp: 1,
			body: '{"ok":true}',
		};

		expect(normalizeInterceptedResponse(legacy)).toEqual({
			...legacy,
			response: {
				headers: { 'Content-Type': 'application/json' },
				body: '{"ok":true}',
			},
		});
	});

	test('preserva request headers existentes sem criar request headers ausentes', () => {
		const request: InterceptedResponse = {
			url: 'https://example.test/users',
			method: 'POST',
			status: 201,
			statusText: 'Created',
			headers: { Location: '/users/1' },
			mimeType: 'application/json',
			type: 'fetch',
			timestamp: 1,
			request: {
				headers: { Authorization: 'Bearer token' },
				postData: '{"name":"Ada"}',
			},
		};

		const normalized = normalizeInterceptedResponse(request);
		expect(normalized.request).toEqual(request.request);
		expect(normalized.response).toEqual({ headers: { Location: '/users/1' } });
	});

	test('nao sobrescreve response ja persistido', () => {
		const current: InterceptedResponse = {
			url: 'https://example.test/no-content',
			method: 'HEAD',
			status: 200,
			statusText: 'OK',
			headers: {},
			response: { headers: { 'X-Response': '1' } },
			mimeType: 'text/plain',
			type: 'fetch',
			timestamp: 1,
		};

		expect(normalizeInterceptedResponse(current).response).toEqual({
			headers: { 'X-Response': '1' },
		});
	});
});

describe('flattenChainActions', () => {
	test('linha vazia quando chain vazio', () => {
		expect(flattenChainActions([])).toEqual([]);
	});

	test('preserva ordem das actions de uma única regra (sem terminal)', () => {
		const a1: Action = { type: 'requestDelay', enabled: true, timeMs: 100 };
		const a2: Action = {
			type: 'requestModify',
			enabled: true,
			setHeaders: { 'x-test': '1' },
		};
		const rule = baseRule('r1', [a1, a2], 'request');
		const chain: MatchedRule[] = [{ rule, actions: [a1, a2] }];
		const plan = flattenChainActions(chain);
		expect(plan).toEqual([
			{ rule, action: a1, isTerminal: false },
			{ rule, action: a2, isTerminal: false },
		]);
	});

	test('concatena actions de múltiplas regras na ordem do chain', () => {
		const aDelay: Action = { type: 'requestDelay', enabled: true, timeMs: 50 };
		const aModify: Action = { type: 'requestModify', enabled: true, addHeaders: { x: 'y' } };
		const r1 = baseRule('r1', [aDelay], 'request');
		const r2 = baseRule('r2', [aModify], 'request');
		const plan = flattenChainActions([
			{ rule: r1, actions: [aDelay] },
			{ rule: r2, actions: [aModify] },
		]);
		expect(plan.map((p) => p.action)).toEqual([aDelay, aModify]);
		expect(plan.map((p) => p.rule.id)).toEqual(['r1', 'r2']);
	});

	test('corta a chain na primeira action terminal', () => {
		const aDelay: Action = { type: 'requestDelay', enabled: true, timeMs: 50 };
		const aMock: Action = { type: 'mock', enabled: true, status: 200, headers: {} };
		const aLater: Action = {
			type: 'requestModify',
			enabled: true,
			setHeaders: { x: '2' },
		};
		const r1 = baseRule('r1', [aDelay, aMock], 'request');
		// r2 nunca deveria executar — vem após a terminal de r1.
		const r2 = baseRule('r2', [aLater], 'request');
		const plan = flattenChainActions([
			{ rule: r1, actions: [aDelay, aMock] },
			{ rule: r2, actions: [aLater] },
		]);
		expect(plan).toHaveLength(2);
		expect(plan[0].action).toBe(aDelay);
		expect(plan[1].action).toBe(aMock);
		expect(plan[1].isTerminal).toBe(true);
	});

	test('marca isTerminal=true para block e breakpoint', () => {
		const block: Action = { type: 'block', enabled: true, errorReason: 'Failed' };
		const r1 = baseRule('r1', [block], 'request');
		const plan = flattenChainActions([{ rule: r1, actions: [block] }]);
		expect(plan[0].isTerminal).toBe(true);
	});
});

describe('processStageChain', () => {
	test('retorna hasTerminal=false quando chain só tem modificadores', () => {
		const a: Action = { type: 'requestDelay', enabled: true, timeMs: 10 };
		const decision = processStageChain([{ rule: baseRule('r1', [a], 'request'), actions: [a] }]);
		expect(decision.actions).toHaveLength(1);
		expect(decision.hasTerminal).toBe(false);
	});

	test('retorna hasTerminal=true quando chain inclui terminal', () => {
		const aMock: Action = { type: 'mock', enabled: true, status: 200, headers: {} };
		const decision = processStageChain([{ rule: baseRule('r1', [aMock]), actions: [aMock] }]);
		expect(decision.hasTerminal).toBe(true);
	});
});

describe('applyHeaderOps', () => {
	test('removeHeaders é case-insensitive', () => {
		const out = applyHeaderOps(
			{ 'Content-Type': 'application/json', Accept: 'text/html' },
			{ removeHeaders: ['content-type'] },
		);
		expect(out).toEqual({ Accept: 'text/html' });
	});

	test('setHeaders preserva casing original quando header já existe', () => {
		const out = applyHeaderOps(
			{ 'Content-Type': 'application/json' },
			{ setHeaders: { 'content-type': 'text/plain' } },
		);
		expect(out).toEqual({ 'Content-Type': 'text/plain' });
	});

	test('setHeaders insere com casing dado quando header não existe', () => {
		const out = applyHeaderOps({}, { setHeaders: { 'X-Custom': 'v' } });
		expect(out).toEqual({ 'X-Custom': 'v' });
	});

	test('addHeaders só adiciona se header ainda não existe (case-insensitive)', () => {
		const out = applyHeaderOps(
			{ Authorization: 'Bearer x' },
			{ addHeaders: { authorization: 'Bearer y', 'X-Debug': '1' } },
		);
		expect(out).toEqual({ Authorization: 'Bearer x', 'X-Debug': '1' });
	});

	test('ordem das operações: remove → set → add', () => {
		const out = applyHeaderOps(
			{ A: '1', B: '2' },
			{
				removeHeaders: ['B'],
				setHeaders: { A: '10' },
				addHeaders: { B: '20', C: '30' },
			},
		);
		expect(out).toEqual({ A: '10', B: '20', C: '30' });
	});

	test('não muta o objeto de entrada', () => {
		const input = { A: '1' };
		applyHeaderOps(input, { setHeaders: { A: '2' } });
		expect(input).toEqual({ A: '1' });
	});
});

describe('applyBodyOperations', () => {
	const replaceFoo: TransformOperation = {
		id: 'op-1',
		type: 'replace',
		path: '$.foo',
		value: '"bar"',
	};

	test('retorna body original quando ops está vazia', () => {
		const r = applyBodyOperations('{"x":1}', []);
		expect(r).toEqual({ ok: true, body: '{"x":1}' });
	});

	test('aplica replace e devolve JSON serializado', () => {
		const r = applyBodyOperations('{"foo":"baz"}', [replaceFoo]);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(JSON.parse(r.body)).toEqual({ foo: 'bar' });
	});

	test('falha quando body é undefined (regra no-fallback do projeto)', () => {
		const r = applyBodyOperations(undefined, [replaceFoo]);
		expect(r.ok).toBe(false);
	});

	test('falha quando body não é JSON válido', () => {
		const r = applyBodyOperations('{unterminated', [replaceFoo]);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.error).toMatch(/JSON/);
	});

	test('propaga erro do jsonPatcher (failedAtIndex visível)', () => {
		const r = applyBodyOperations('{"foo":"baz"}', [
			{ id: 'bad', type: 'replace', path: '$.naoExiste', value: '"x"' },
		]);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.error).toMatch(/operação 0/);
	});
});
