import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { PlannedAction } from '@/domain/intercepted';
import type {
	Action,
	BlockAction,
	BreakpointAction,
	MockAction,
	RequestDelayAction,
	RequestModifyAction,
	ResponseModifyAction,
	Rule,
	RuleStage,
} from '@/types/rules';
import {
	applyRequestBlock,
	applyRequestBreakpoint,
	applyRequestDelay,
	applyRequestMock,
	applyRequestModify,
	applyResponseBreakpoint,
	applyResponseMock,
	applyResponseModify,
	executeChain,
	type ExecutionContext,
	type PendingInterception,
	type RequestSnapshot,
	type ResponseSnapshot,
} from '../interceptionPipeline';

// Cria um ExecutionContext com spies em volta de stubs no-op. Tests podem
// substituir comportamentos individuais (ex.: forçar sendDebuggerCommand a
// rejeitar) reassinalando a propriedade depois da criação.
function makeCtx(): ExecutionContext & {
	sendDebuggerCommand: ReturnType<typeof vi.fn>;
	wait: ReturnType<typeof vi.fn>;
	enqueuePendingInterception: ReturnType<typeof vi.fn>;
} {
	const sendDebuggerCommand = vi.fn().mockResolvedValue(undefined);
	const wait = vi.fn().mockResolvedValue(undefined);
	const enqueuePendingInterception = vi.fn();
	return { sendDebuggerCommand, wait, enqueuePendingInterception };
}

function makeRule(id: string, actions: Action[], stage: RuleStage = 'request'): Rule {
	return {
		id,
		name: id,
		enabled: true,
		stage,
		matchers: [],
		actions,
		createdAt: 0,
		updatedAt: 0,
	};
}

function makeRequestSnapshot(overrides: Partial<RequestSnapshot> = {}): RequestSnapshot {
	return {
		url: 'https://api.example.test/users',
		method: 'POST',
		headers: { 'X-Original': 'yes', 'Content-Type': 'application/json' },
		postData: '{"name":"alice"}',
		...overrides,
	};
}

function makeResponseSnapshot(overrides: Partial<ResponseSnapshot> = {}): ResponseSnapshot {
	return {
		status: 200,
		statusPhrase: 'OK',
		headers: { 'Content-Type': 'application/json' },
		body: '{"ok":true}',
		...overrides,
	};
}

describe('applyRequestDelay', () => {
	test('chama ctx.wait(timeMs) e retorna void', async () => {
		const ctx = makeCtx();
		const action: RequestDelayAction = { type: 'requestDelay', enabled: true, timeMs: 250 };

		await applyRequestDelay(action, ctx);

		expect(ctx.wait).toHaveBeenCalledTimes(1);
		expect(ctx.wait).toHaveBeenCalledWith(250);
		expect(ctx.sendDebuggerCommand).not.toHaveBeenCalled();
	});

	test('propaga erro de ctx.wait sem swallow', async () => {
		const ctx = makeCtx();
		ctx.wait.mockRejectedValueOnce(new Error('wait abortado'));
		const action: RequestDelayAction = { type: 'requestDelay', enabled: true, timeMs: 100 };

		await expect(applyRequestDelay(action, ctx)).rejects.toThrow('wait abortado');
	});
});

describe('applyRequestModify', () => {
	test('aplica url/method override no snapshot e retorna novo objeto', () => {
		const snapshot = makeRequestSnapshot();
		const action: RequestModifyAction = {
			type: 'requestModify',
			enabled: true,
			url: 'https://api.example.test/v2/users',
			method: 'PUT',
		};

		const next = applyRequestModify(action, snapshot);

		expect(next.url).toBe('https://api.example.test/v2/users');
		expect(next.method).toBe('PUT');
		expect(next).not.toBe(snapshot);
		// snapshot original preservado
		expect(snapshot.url).toBe('https://api.example.test/users');
		expect(snapshot.method).toBe('POST');
	});

	test('aplica HeaderOps (remove → set → add) sobre headers', () => {
		const snapshot = makeRequestSnapshot({
			headers: { 'X-Old': 'remove-me', Authorization: 'old-token', 'Content-Type': 'application/json' },
		});
		const action: RequestModifyAction = {
			type: 'requestModify',
			enabled: true,
			removeHeaders: ['X-Old'],
			setHeaders: { Authorization: 'new-token' },
			addHeaders: { 'X-Trace': 'abc' },
		};

		const next = applyRequestModify(action, snapshot);

		expect(next.headers).toEqual({
			Authorization: 'new-token',
			'Content-Type': 'application/json',
			'X-Trace': 'abc',
		});
	});

	test('substitui postData quando body é informado', () => {
		const snapshot = makeRequestSnapshot({ postData: '{"name":"alice"}' });
		const action: RequestModifyAction = {
			type: 'requestModify',
			enabled: true,
			body: '{"name":"bob"}',
		};

		const next = applyRequestModify(action, snapshot);

		expect(next.postData).toBe('{"name":"bob"}');
	});

	test('aplica bodyOperations sobre postData JSON', () => {
		const snapshot = makeRequestSnapshot({ postData: '{"name":"alice","age":30}' });
		const action: RequestModifyAction = {
			type: 'requestModify',
			enabled: true,
			bodyOperations: [
				{ id: '1', type: 'replace', path: '$.name', value: '"bob"' },
				{ id: '2', type: 'remove', path: '$.age' },
			],
		};

		const next = applyRequestModify(action, snapshot);

		expect(JSON.parse(next.postData ?? '')).toEqual({ name: 'bob' });
	});

	test('falha (no fallbacks) quando bodyOperations recebe postData ausente', () => {
		const snapshot = makeRequestSnapshot({ postData: undefined });
		const action: RequestModifyAction = {
			type: 'requestModify',
			enabled: true,
			bodyOperations: [{ id: '1', type: 'add', path: '$.x', value: '1' }],
		};

		expect(() => applyRequestModify(action, snapshot)).toThrow(/Body ausente/);
	});

	test('mantém snapshot intacto quando action não traz overrides', () => {
		const snapshot = makeRequestSnapshot();
		const action: RequestModifyAction = { type: 'requestModify', enabled: true };

		const next = applyRequestModify(action, snapshot);

		expect(next).toEqual(snapshot);
	});
});

describe('applyRequestBlock', () => {
	test('chama Fetch.failRequest com errorReason', async () => {
		const ctx = makeCtx();
		const action: BlockAction = {
			type: 'block',
			enabled: true,
			errorReason: 'AccessDenied',
		};

		await applyRequestBlock(action, 'fetch-1', ctx);

		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		expect(ctx.sendDebuggerCommand).toHaveBeenCalledWith('Fetch.failRequest', {
			requestId: 'fetch-1',
			errorReason: 'AccessDenied',
		});
	});

	test('propaga erro do CDP sem swallow', async () => {
		const ctx = makeCtx();
		ctx.sendDebuggerCommand.mockRejectedValueOnce(new Error('cdp morreu'));
		const action: BlockAction = { type: 'block', enabled: true, errorReason: 'Failed' };

		await expect(applyRequestBlock(action, 'fetch-1', ctx)).rejects.toThrow('cdp morreu');
	});
});

describe('applyRequestMock', () => {
	test('emite Fetch.fulfillRequest com status/headers/body codificado e devolve snapshot', async () => {
		const ctx = makeCtx();
		const action: MockAction = {
			type: 'mock',
			enabled: true,
			status: 503,
			statusPhrase: 'Service Unavailable',
			headers: { 'X-Mock': 'yes' },
			body: '{"error":"down"}',
			contentType: 'application/json',
		};

		const snap = await applyRequestMock(action, 'fetch-2', 'POST', ctx);

		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		const [method, params] = ctx.sendDebuggerCommand.mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		expect(method).toBe('Fetch.fulfillRequest');
		expect(params.requestId).toBe('fetch-2');
		expect(params.responseCode).toBe(503);
		expect(params.responsePhrase).toBe('Service Unavailable');
		// header Content-Type injetado a partir de mock.contentType
		expect(params.responseHeaders).toEqual([
			{ name: 'X-Mock', value: 'yes' },
			{ name: 'Content-Type', value: 'application/json' },
		]);
		// body codificado em base64
		expect(typeof params.body).toBe('string');
		expect(atob(params.body as string)).toBe('{"error":"down"}');

		expect(snap).toEqual({
			status: 503,
			statusPhrase: 'Service Unavailable',
			headers: { 'X-Mock': 'yes', 'Content-Type': 'application/json' },
			body: '{"error":"down"}',
		});
	});

	test('omite body no fulfillRequest quando mock não define body', async () => {
		const ctx = makeCtx();
		const action: MockAction = {
			type: 'mock',
			enabled: true,
			status: 204,
			headers: {},
		};

		const snap = await applyRequestMock(action, 'fetch-3', 'DELETE', ctx);

		const params = ctx.sendDebuggerCommand.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(params.body).toBeUndefined();
		expect(snap.body).toBeUndefined();
	});
});

describe('applyRequestBreakpoint', () => {
	test('enfileira PendingInterception com stage=request e snapshot', () => {
		const ctx = makeCtx();
		const snapshot = makeRequestSnapshot();
		const action: BreakpointAction = {
			type: 'breakpoint',
			enabled: true,
			description: 'pausa pre-envio',
		};
		const rule = makeRule('rule-bp', [action], 'request');

		applyRequestBreakpoint(action, 'fetch-4', snapshot, rule, ctx);

		expect(ctx.enqueuePendingInterception).toHaveBeenCalledTimes(1);
		const entry = ctx.enqueuePendingInterception.mock.calls[0]?.[0] as PendingInterception;
		expect(entry).toEqual({
			stage: 'request',
			requestId: 'fetch-4',
			ruleId: 'rule-bp',
			description: 'pausa pre-envio',
			url: snapshot.url,
			method: snapshot.method,
			request: {
				headers: snapshot.headers,
				postData: snapshot.postData,
			},
		});
		expect(ctx.sendDebuggerCommand).not.toHaveBeenCalled();
	});

	test('omite postData no entry quando snapshot não tem corpo', () => {
		const ctx = makeCtx();
		const snapshot = makeRequestSnapshot({ postData: undefined });
		const action: BreakpointAction = { type: 'breakpoint', enabled: true };
		const rule = makeRule('rule-bp', [action], 'request');

		applyRequestBreakpoint(action, 'fetch-5', snapshot, rule, ctx);

		const entry = ctx.enqueuePendingInterception.mock.calls[0]?.[0] as PendingInterception;
		expect(entry.request.postData).toBeUndefined();
		expect(entry.description).toBeUndefined();
	});
});

describe('applyResponseModify', () => {
	test('substitui status/statusPhrase e aplica HeaderOps', () => {
		const snapshot = makeResponseSnapshot({
			status: 200,
			statusPhrase: 'OK',
			headers: { 'X-Old': 'remove', 'Content-Type': 'application/json' },
		});
		const action: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			status: 500,
			statusPhrase: 'Boom',
			removeHeaders: ['X-Old'],
			addHeaders: { 'X-Trace': 'xyz' },
		};

		const next = applyResponseModify(action, snapshot);

		expect(next.status).toBe(500);
		expect(next.statusPhrase).toBe('Boom');
		expect(next.headers).toEqual({ 'Content-Type': 'application/json', 'X-Trace': 'xyz' });
	});

	test('deriva statusPhrase canônica quando apenas status é passado', () => {
		const snapshot = makeResponseSnapshot();
		const action: ResponseModifyAction = { type: 'responseModify', enabled: true, status: 404 };

		const next = applyResponseModify(action, snapshot);

		expect(next.status).toBe(404);
		expect(next.statusPhrase).toBe('Not Found');
	});

	test('substitui body quando body é informado', () => {
		const snapshot = makeResponseSnapshot({ body: '{"old":true}' });
		const action: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			body: '{"new":true}',
		};

		const next = applyResponseModify(action, snapshot);

		expect(next.body).toBe('{"new":true}');
	});

	test('aplica bodyOperations sobre o body JSON', () => {
		const snapshot = makeResponseSnapshot({ body: '{"a":1,"b":2}' });
		const action: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			bodyOperations: [{ id: '1', type: 'add', path: '$.c', value: '3' }],
		};

		const next = applyResponseModify(action, snapshot);

		expect(JSON.parse(next.body ?? '')).toEqual({ a: 1, b: 2, c: 3 });
	});

	test('propaga erro quando bodyOperations recebe body ausente', () => {
		const snapshot = makeResponseSnapshot({ body: undefined });
		const action: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			bodyOperations: [{ id: '1', type: 'add', path: '$.x', value: '1' }],
		};

		expect(() => applyResponseModify(action, snapshot)).toThrow(/Body ausente/);
	});
});

describe('applyResponseMock', () => {
	test('emite Fetch.fulfillRequest e retorna snapshot da resposta mockada', async () => {
		const ctx = makeCtx();
		const action: MockAction = {
			type: 'mock',
			enabled: true,
			status: 418,
			headers: {},
			body: 'I am a teapot',
			contentType: 'text/plain',
		};

		const snap = await applyResponseMock(action, 'fetch-6', 'GET', ctx);

		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		const params = ctx.sendDebuggerCommand.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(params.responseCode).toBe(418);
		expect(params.responsePhrase).toBe("I'm a Teapot");
		expect(snap.status).toBe(418);
		expect(snap.body).toBe('I am a teapot');
	});
});

describe('applyResponseBreakpoint', () => {
	test('enfileira PendingInterception com stage=response, request e response snapshots', () => {
		const ctx = makeCtx();
		const reqSnap = makeRequestSnapshot();
		const respSnap = makeResponseSnapshot();
		const action: BreakpointAction = { type: 'breakpoint', enabled: true };
		const rule = makeRule('rule-resp-bp', [action], 'response');

		applyResponseBreakpoint(action, 'fetch-7', reqSnap, respSnap, rule, ctx);

		expect(ctx.enqueuePendingInterception).toHaveBeenCalledTimes(1);
		const entry = ctx.enqueuePendingInterception.mock.calls[0]?.[0] as PendingInterception;
		expect(entry.stage).toBe('response');
		expect(entry.ruleId).toBe('rule-resp-bp');
		expect(entry.url).toBe(reqSnap.url);
		expect(entry.method).toBe(reqSnap.method);
		expect(entry.response).toEqual(respSnap);
		expect(ctx.sendDebuggerCommand).not.toHaveBeenCalled();
	});
});

describe('executeChain — Request stage', () => {
	test('plan vazio não chama CDP nem ctx', async () => {
		const ctx = makeCtx();

		const result = await executeChain(
			[],
			'fetch-empty',
			'request',
			{ request: makeRequestSnapshot() },
			ctx,
		);

		expect(result.terminated).toBe(false);
		expect(result.terminalKind).toBeNull();
		expect(result.appliedTypes).toEqual([]);
		expect(result.cdpReleased).toBe(false);
		expect(ctx.sendDebuggerCommand).not.toHaveBeenCalled();
		expect(ctx.wait).not.toHaveBeenCalled();
	});

	test('[requestDelay] aplica wait e emite continueRequest final sem mods', async () => {
		const ctx = makeCtx();
		const delay: RequestDelayAction = { type: 'requestDelay', enabled: true, timeMs: 50 };
		const rule = makeRule('r-delay', [delay], 'request');
		const plan: PlannedAction[] = [{ rule, action: delay, isTerminal: false }];

		const result = await executeChain(
			plan,
			'fetch-d',
			'request',
			{ request: makeRequestSnapshot() },
			ctx,
		);

		expect(ctx.wait).toHaveBeenCalledWith(50);
		// continueRequest com apenas requestId (sem url/method/headers/postData
		// pois nenhum requestModify alterou nada)
		expect(ctx.sendDebuggerCommand).toHaveBeenLastCalledWith('Fetch.continueRequest', {
			requestId: 'fetch-d',
		});
		expect(result).toMatchObject({
			terminated: false,
			terminalKind: null,
			appliedTypes: ['latency'],
			cdpReleased: true,
		});
	});

	test('[requestDelay, requestModify] aguarda, muta snapshot e continua com mods', async () => {
		const ctx = makeCtx();
		const delay: RequestDelayAction = { type: 'requestDelay', enabled: true, timeMs: 25 };
		const modify: RequestModifyAction = {
			type: 'requestModify',
			enabled: true,
			method: 'PUT',
			setHeaders: { Authorization: 'tok' },
		};
		const rule = makeRule('r-chain', [delay, modify], 'request');
		const plan: PlannedAction[] = [
			{ rule, action: delay, isTerminal: false },
			{ rule, action: modify, isTerminal: false },
		];

		const result = await executeChain(
			plan,
			'fetch-dm',
			'request',
			{ request: makeRequestSnapshot() },
			ctx,
		);

		// Ordem: wait primeiro, depois continueRequest
		expect(ctx.wait).toHaveBeenCalledWith(25);
		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		const [method, params] = ctx.sendDebuggerCommand.mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		expect(method).toBe('Fetch.continueRequest');
		expect(params.requestId).toBe('fetch-dm');
		expect(params.method).toBe('PUT');
		// headers só vão quando mudaram
		expect(params.headers).toEqual(
			expect.arrayContaining([
				{ name: 'Authorization', value: 'tok' },
				{ name: 'Content-Type', value: 'application/json' },
				{ name: 'X-Original', value: 'yes' },
			]),
		);
		// url não mudou → não vai no payload
		expect(params.url).toBeUndefined();

		expect(result.terminated).toBe(false);
		expect(result.appliedTypes).toEqual(['latency', 'requestModify']);
		expect(result.cdpReleased).toBe(true);
		expect(result.requestSnapshot.method).toBe('PUT');
	});

	test('[requestDelay, mock] aguarda e fulfilla com mock; não emite continueRequest', async () => {
		const ctx = makeCtx();
		const delay: RequestDelayAction = { type: 'requestDelay', enabled: true, timeMs: 10 };
		const mock: MockAction = {
			type: 'mock',
			enabled: true,
			status: 200,
			headers: {},
			body: '{"mocked":true}',
			contentType: 'application/json',
		};
		const rule = makeRule('r-dm', [delay, mock], 'request');
		const plan: PlannedAction[] = [
			{ rule, action: delay, isTerminal: false },
			{ rule, action: mock, isTerminal: true },
		];

		const result = await executeChain(
			plan,
			'fetch-mock',
			'request',
			{ request: makeRequestSnapshot() },
			ctx,
		);

		expect(ctx.wait).toHaveBeenCalledWith(10);
		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		expect(ctx.sendDebuggerCommand).toHaveBeenLastCalledWith(
			'Fetch.fulfillRequest',
			expect.objectContaining({ requestId: 'fetch-mock', responseCode: 200 }),
		);
		expect(result.terminated).toBe(true);
		expect(result.terminalKind).toBe('mock');
		expect(result.cdpReleased).toBe(true);
		expect(result.appliedTypes).toEqual(['latency', 'mock']);
		expect(result.responseSnapshot?.body).toBe('{"mocked":true}');
	});

	test('[block] emite failRequest e termina sem actions seguintes', async () => {
		const ctx = makeCtx();
		const block: BlockAction = { type: 'block', enabled: true, errorReason: 'BlockedByClient' };
		const after: RequestDelayAction = { type: 'requestDelay', enabled: true, timeMs: 5 };
		const rule = makeRule('r-block', [block, after], 'request');
		const plan: PlannedAction[] = [
			{ rule, action: block, isTerminal: true },
			// action depois do terminal — não deveria existir no plan, mas o
			// executor é defensivo: se aparecer, é ignorada.
			{ rule, action: after, isTerminal: false },
		];

		const result = await executeChain(
			plan,
			'fetch-b',
			'request',
			{ request: makeRequestSnapshot() },
			ctx,
		);

		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		expect(ctx.sendDebuggerCommand).toHaveBeenLastCalledWith('Fetch.failRequest', {
			requestId: 'fetch-b',
			errorReason: 'BlockedByClient',
		});
		expect(ctx.wait).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			terminated: true,
			terminalKind: 'block',
			cdpReleased: true,
			appliedTypes: ['block'],
		});
	});

	test('[breakpoint] enfileira pendingInterception e termina; NÃO emite CDP release', async () => {
		const ctx = makeCtx();
		const bp: BreakpointAction = { type: 'breakpoint', enabled: true };
		const rule = makeRule('r-bp', [bp], 'request');
		const plan: PlannedAction[] = [{ rule, action: bp, isTerminal: true }];

		const result = await executeChain(
			plan,
			'fetch-bp',
			'request',
			{ request: makeRequestSnapshot() },
			ctx,
		);

		expect(ctx.enqueuePendingInterception).toHaveBeenCalledTimes(1);
		const entry = ctx.enqueuePendingInterception.mock.calls[0]?.[0] as PendingInterception;
		expect(entry.stage).toBe('request');
		expect(entry.requestId).toBe('fetch-bp');
		expect(ctx.sendDebuggerCommand).not.toHaveBeenCalled();

		expect(result).toMatchObject({
			terminated: true,
			terminalKind: 'breakpoint',
			cdpReleased: false,
			appliedTypes: ['requestBreakpoint'],
		});
	});

	test('propaga erro de applier (no fallbacks)', async () => {
		const ctx = makeCtx();
		ctx.sendDebuggerCommand.mockRejectedValueOnce(new Error('cdp falhou'));
		const block: BlockAction = { type: 'block', enabled: true, errorReason: 'Failed' };
		const rule = makeRule('r-err', [block], 'request');
		const plan: PlannedAction[] = [{ rule, action: block, isTerminal: true }];

		await expect(
			executeChain(plan, 'fetch-err', 'request', { request: makeRequestSnapshot() }, ctx),
		).rejects.toThrow('cdp falhou');
	});
});

describe('executeChain — Response stage', () => {
	test('[responseModify] muta snapshot e emite Fetch.fulfillRequest', async () => {
		const ctx = makeCtx();
		const mod: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			status: 500,
			body: '{"error":"forced"}',
		};
		const rule = makeRule('r-respmod', [mod], 'response');
		const plan: PlannedAction[] = [{ rule, action: mod, isTerminal: false }];

		const result = await executeChain(
			plan,
			'fetch-rm',
			'response',
			{ request: makeRequestSnapshot(), response: makeResponseSnapshot() },
			ctx,
		);

		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		const params = ctx.sendDebuggerCommand.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(params.responseCode).toBe(500);
		expect(params.responsePhrase).toBe('Internal Server Error');
		expect(typeof params.body).toBe('string');
		expect(atob(params.body as string)).toBe('{"error":"forced"}');

		expect(result.terminated).toBe(false);
		expect(result.appliedTypes).toEqual(['responseModify']);
		expect(result.cdpReleased).toBe(true);
		expect(result.responseSnapshot?.status).toBe(500);
	});

	test('[responseModify, responseModify] compõe mods e emite UMA fulfillRequest', async () => {
		const ctx = makeCtx();
		const mod1: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			addHeaders: { 'X-One': '1' },
		};
		const mod2: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			addHeaders: { 'X-Two': '2' },
		};
		const rule = makeRule('r-2mod', [mod1, mod2], 'response');
		const plan: PlannedAction[] = [
			{ rule, action: mod1, isTerminal: false },
			{ rule, action: mod2, isTerminal: false },
		];

		const result = await executeChain(
			plan,
			'fetch-2m',
			'response',
			{ request: makeRequestSnapshot(), response: makeResponseSnapshot() },
			ctx,
		);

		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		const params = ctx.sendDebuggerCommand.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(params.responseHeaders).toEqual(
			expect.arrayContaining([
				{ name: 'X-One', value: '1' },
				{ name: 'X-Two', value: '2' },
			]),
		);
		expect(result.appliedTypes).toEqual(['responseModify', 'responseModify']);
	});

	test('[responseModify, mock] aplica mod, mas mock substitui tudo (terminal)', async () => {
		const ctx = makeCtx();
		const mod: ResponseModifyAction = {
			type: 'responseModify',
			enabled: true,
			addHeaders: { 'X-Ignored': 'yes' },
		};
		const mock: MockAction = {
			type: 'mock',
			enabled: true,
			status: 200,
			headers: { 'X-Mock': 'yes' },
			body: '{"from":"mock"}',
			contentType: 'application/json',
		};
		const rule = makeRule('r-mm', [mod, mock], 'response');
		const plan: PlannedAction[] = [
			{ rule, action: mod, isTerminal: false },
			{ rule, action: mock, isTerminal: true },
		];

		const result = await executeChain(
			plan,
			'fetch-mm',
			'response',
			{ request: makeRequestSnapshot(), response: makeResponseSnapshot() },
			ctx,
		);

		// Apenas UMA chamada: a do mock terminal (sem fulfillRequest duplicado
		// por causa do mod).
		expect(ctx.sendDebuggerCommand).toHaveBeenCalledTimes(1);
		const params = ctx.sendDebuggerCommand.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(params.responseHeaders).toEqual([
			{ name: 'X-Mock', value: 'yes' },
			{ name: 'Content-Type', value: 'application/json' },
		]);
		expect(result.terminalKind).toBe('mock');
		expect(result.appliedTypes).toEqual(['responseModify', 'mock']);
	});

	test('[breakpoint] enfileira sem emitir CDP release', async () => {
		const ctx = makeCtx();
		const bp: BreakpointAction = { type: 'breakpoint', enabled: true };
		const rule = makeRule('r-rbp', [bp], 'response');
		const plan: PlannedAction[] = [{ rule, action: bp, isTerminal: true }];

		const result = await executeChain(
			plan,
			'fetch-rbp',
			'response',
			{ request: makeRequestSnapshot(), response: makeResponseSnapshot() },
			ctx,
		);

		expect(ctx.enqueuePendingInterception).toHaveBeenCalledTimes(1);
		const entry = ctx.enqueuePendingInterception.mock.calls[0]?.[0] as PendingInterception;
		expect(entry.stage).toBe('response');
		expect(entry.response).toBeTruthy();
		expect(ctx.sendDebuggerCommand).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			terminated: true,
			terminalKind: 'breakpoint',
			cdpReleased: false,
			appliedTypes: ['responseBreakpoint'],
		});
	});

	test('plan vazio no Response stage não chama CDP (caller orquestra pass-through)', async () => {
		const ctx = makeCtx();

		const result = await executeChain(
			[],
			'fetch-empty-r',
			'response',
			{ request: makeRequestSnapshot(), response: makeResponseSnapshot() },
			ctx,
		);

		expect(ctx.sendDebuggerCommand).not.toHaveBeenCalled();
		expect(result.cdpReleased).toBe(false);
	});

	test('breakpoint sem responseSnapshot estoura (no fallbacks)', async () => {
		const ctx = makeCtx();
		const bp: BreakpointAction = { type: 'breakpoint', enabled: true };
		const rule = makeRule('r-bp-bad', [bp], 'response');
		const plan: PlannedAction[] = [{ rule, action: bp, isTerminal: true }];

		await expect(
			executeChain(plan, 'fetch-bad', 'response', { request: makeRequestSnapshot() }, ctx),
		).rejects.toThrow(/response snapshot/i);
	});
});

describe('executeChain — multi-regra (chain composta)', () => {
	let ctx: ReturnType<typeof makeCtx>;

	beforeEach(() => {
		ctx = makeCtx();
	});

	test('itera múltiplas regras na ordem do plan acumulando appliedTypes', async () => {
		const delay: RequestDelayAction = { type: 'requestDelay', enabled: true, timeMs: 5 };
		const modify: RequestModifyAction = {
			type: 'requestModify',
			enabled: true,
			setHeaders: { 'X-A': 'a' },
		};
		const ruleA = makeRule('ra', [delay], 'request');
		const ruleB = makeRule('rb', [modify], 'request');
		const plan: PlannedAction[] = [
			{ rule: ruleA, action: delay, isTerminal: false },
			{ rule: ruleB, action: modify, isTerminal: false },
		];

		const result = await executeChain(
			plan,
			'fetch-multi',
			'request',
			{ request: makeRequestSnapshot() },
			ctx,
		);

		expect(ctx.wait).toHaveBeenCalledWith(5);
		expect(ctx.sendDebuggerCommand).toHaveBeenLastCalledWith(
			'Fetch.continueRequest',
			expect.objectContaining({ requestId: 'fetch-multi' }),
		);
		expect(result.appliedTypes).toEqual(['latency', 'requestModify']);
	});
});
