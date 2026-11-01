import { performanceEnvironment } from './environment';
import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo, type Worker } from '@playwright/test';
import { sessionEventsToRequestsRecord } from '../../src/lib/session/sessionNetworkAdapter';
import type { Session } from '../../src/lib/session/types';
import type { InterceptedResponse } from '../../src/types/intercepted';
import type { Message, MessageResponse } from '../../src/types/messages';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { startRecordingFixture } from './recordingFixture';
import {
	installRecordingTelemetry,
	sampleRecordingTelemetry,
	watchRecordingErrors,
	summarizeRecordingTelemetry,
	createRecordingSampler,
} from './recordingTelemetry';

const TEN_MINUTES = 10 * 60 * 1000;
const REQUEST_PATH = '/recording-payload';

async function send(page: Page, message: Message): Promise<MessageResponse> {
	const result = await page.evaluate((value) => chrome.runtime.sendMessage(value), message);
	if (!result || result.error || result.success === false || result.ok === false) {
		throw new Error(`Mensagem ${message.action} falhou: ${JSON.stringify(result)}`);
	}
	return result;
}

async function readStore<T>(page: Page, store: 'sessions' | 'requests'): Promise<T[]> {
	return page.evaluate(
		(name) =>
			new Promise<T[]>((resolve, reject) => {
				const open = indexedDB.open('debugger-extension-db');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const request = db.transaction(name).objectStore(name).getAll();
					request.onerror = () => {
						db.close();
						reject(request.error);
					};
					request.onsuccess = () => {
						db.close();
						resolve(request.result);
					};
				};
			}),
		store,
	);
}

function workloadRequests(requests: Record<string, InterceptedResponse>) {
	return Object.fromEntries(
		Object.entries(requests).filter(
			([, request]) => new URL(request.url).pathname === REQUEST_PATH,
		),
	);
}

function sequenceOf(request: InterceptedResponse) {
	const value = new URL(request.url).searchParams.get('seq');
	if (value === null) throw new Error(`URL sem seq: ${request.url}`);
	return Number(value);
}

async function generateBatch(page: Page, sequences: number[]) {
	const actual = await page.evaluate(async (ids) => {
		return Promise.all(
			ids.map(async (seq) => {
				const response = await fetch(`/recording-payload?seq=${seq}`, {
					cache: 'no-store',
					signal: AbortSignal.timeout(15_000),
				});
				if (!response.ok) throw new Error(`HTTP ${response.status} para ${seq}`);
				const payload = await response.json();
				if (payload.seq !== seq) throw new Error(`Resposta divergente: ${seq}/${payload.seq}`);
				if (payload.payload !== 'recording-performance-'.repeat(100))
					throw new Error(`Payload corrompido na página alvo: ${seq}`);
				const progress = document.getElementById('progress');
				if (!progress) throw new Error('Fixture sem output');
				progress.textContent = String(seq);
				return payload.seq as number;
			}),
		);
	}, sequences);
	expect(actual).toEqual(sequences);
}

async function capturesWithTiming(page: Page, expectedCount: number) {
	let captures: Record<string, InterceptedResponse> = {};
	await expect
		.poll(
			async () => {
				const response = await send(page, { action: 'getAllRequests' });
				if (!response.allRequests) throw new Error('getAllRequests sem dados');
				captures = workloadRequests(response.allRequests);
				return Object.values(captures).filter(
					(request) => typeof request.duration === 'number' && request.duration > 0,
				).length;
			},
			{ timeout: 20_000, intervals: [100, 250, 500] },
		)
		.toBe(expectedCount);
	return captures;
}

async function assertParity(
	page: Page,
	sessionId: string,
	sequences: number[],
	captures: Record<string, InterceptedResponse>,
) {
	const sessions = await readStore<Session>(page, 'sessions');
	const session = sessions.find((candidate) => candidate.id === sessionId);
	if (!session || session.endedAt === null)
		throw new Error('Sessão ausente ou ainda aberta após stop');
	const persistedRows = await readStore<{
		id: string;
		data: InterceptedResponse;
	}>(page, 'requests');
	const expectedSequences = new Set(sequences);
	const select = (requests: Record<string, InterceptedResponse>) =>
		Object.fromEntries(
			Object.entries(workloadRequests(requests)).filter(([, request]) =>
				expectedSequences.has(sequenceOf(request)),
			),
		);
	const persisted = select(Object.fromEntries(persistedRows.map((row) => [row.id, row.data])));
	const captured = select(captures);
	const replay = select(sessionEventsToRequestsRecord(session.events, session.endedAt));
	const events = session.events.filter(
		(event) => event.type === 'network' && new URL(event.url).pathname === REQUEST_PATH,
	);
	expect(events).toHaveLength(sequences.length);
	expect(Object.keys(captured)).toHaveLength(sequences.length);
	expect(Object.keys(persisted).sort()).toEqual(Object.keys(captured).sort());
	expect(Object.keys(replay).sort()).toEqual(Object.keys(captured).sort());
	expect(
		Object.values(replay)
			.map(sequenceOf)
			.sort((a, b) => a - b),
	).toEqual(sequences);
	for (const [id, capture] of Object.entries(captured)) {
		const expectedBody = JSON.stringify({
			seq: sequenceOf(capture),
			payload: 'recording-performance-'.repeat(100),
		});
		expect(capture.captureError, id).toBeUndefined();
		expect(capture.body, `${id}: body da captura`).toBe(expectedBody);
		expect(persisted[id].body, `${id}: body persistido`).toBe(expectedBody);
		expect(replay[id].body, `${id}: body no replay`).toBe(expectedBody);
		expect(persisted[id].duration, `${id}: IDB timing patch`).toBe(capture.duration);
		expect(replay[id].duration, `${id}: replay timing patch`).toBe(capture.duration);
		expect(replay[id].isWaiting, `${id}: replay pendente`).not.toBe(true);
		expect(JSON.parse(replay[id].body!).seq, `${id}: body final`).toBe(sequenceOf(capture));
	}
	expect(
		session.rrwebEvents?.some((event) => event.type === 2),
		'rrweb FullSnapshot real',
	).toBe(true);
	return {
		sessionId,
		sequences,
		captureIds: Object.keys(captured),
		persistedIds: Object.keys(persisted),
		replayIds: Object.keys(replay),
		events: session.events.length,
		rrwebEvents: session.rrwebEvents?.length,
		startedAt: session.startedAt,
		endedAt: session.endedAt,
		telemetry: session.telemetry,
	};
}

async function runRecording(
	testInfo: TestInfo,
	mode: 'short' | 'autostop' | 'successive' | 'size' | 'continuous' | 'inflight',
) {
	const fixture = await startRecordingFixture();
	const context = await launchExtensionContext();
	context.setDefaultTimeout(15_000);
	const diagnostics = watchRecordingErrors(context);
	const evidence: Record<string, unknown> = {
		mode,
		environment: performanceEnvironment(context),
		ledger: fixture.received,
		completed: fixture.completed,
		parity: [],
		notes: [
			'JSON bytes são estimativa UTF-8 por put, não tamanho físico em disco.',
			'Instrumentação mede seu próprio custo de serialização separadamente; durações não são benchmark sem observador.',
			'Mensagens contam entradas no service worker, inclusive polls do runner.',
			'Heap de target/service worker vem de CDP Runtime.getHeapUsage (sem GC forçado); performance.memory é apenas diagnóstico opcional.',
			'CPU do target vem de CDP Performance.getMetrics; CPU isolado do service worker não é medido.',
			'Paridade de replay usa o adapter de produção com a sessão real persistida; UI recebe smoke check da rota, sem validar cada página da tabela.',
		],
	};
	let worker: Worker | undefined;
	let sampler: Awaited<ReturnType<typeof createRecordingSampler>> | undefined;
	try {
		await context.tracing.start({ screenshots: true, snapshots: false });
		const extensionId = await getExtensionId(context);
		worker = context.serviceWorkers()[0];
		await installRecordingTelemetry(worker);
		const target = await context.newPage();
		await target.goto(`${fixture.origin}/recording-target.html`);
		const ui = await context.newPage();
		await ui.goto(`chrome-extension://${extensionId}/options.html`);
		const tabId = await worker.evaluate(async (url) => {
			const tab = (await chrome.tabs.query({})).find((candidate) => candidate.url === url);
			if (tab?.id === undefined) throw new Error(`Aba não encontrada: ${url}`);
			return tab.id;
		}, target.url());
		await send(ui, {
			action: 'setTargetTab',
			tabId,
			tabUrl: target.url(),
			tabTitle: 'Recording performance target',
		});
		sampler = await createRecordingSampler(context, target, ui, worker.url());
		const samples = [await sampler.sample('start')];
		evidence.runtimeSamples = samples;
		const sessionCount = mode === 'successive' ? 3 : 1;
		let sequence = 0;
		for (let index = 0; index < sessionCount; index++) {
			await send(ui, { action: 'startDebugging', tabId });
			const active = await send(ui, { action: 'getActiveSession', tabId });
			if (!active.session) throw new Error('Start debugging não iniciou gravação real');
			const sessionId = active.session.id;
			const sequences: number[] = [];
			if (mode === 'short' || mode === 'size' || mode === 'continuous' || mode === 'inflight') {
				for (let batch = 0; batch < 12; batch++) {
					const ids = Array.from({ length: 8 }, () => sequence++);
					sequences.push(...ids);
					await generateBatch(target, ids);
				}
			} else {
				// 118 requests espaçadas; para antes do limite para drenar os patches.
				// O autostop é acionado por um evento real DEPOIS dos 10min.
				while (Date.now() - active.session.startedAt < TEN_MINUTES - 15_000) {
					const ids = [sequence++];
					sequences.push(...ids);
					await generateBatch(target, ids);
					await sampleRecordingTelemetry(worker);
					await target.waitForTimeout(5_000);
				}
			}
			if (mode === 'continuous') {
				const beganAt = Date.now();
				const writesBefore = (await sampleRecordingTelemetry(worker)).writes.filter(
					(write) => write.store === 'sessions',
				).length;
				// 60 requests sequenciais, sem janela ociosa de 200ms; pelo menos 3s reais.
				for (let tick = 0; tick < 60; tick++) {
					const ids = [sequence++];
					sequences.push(...ids);
					await generateBatch(target, ids);
					await target.waitForTimeout(30);
				}
				const writesAfter = (await sampleRecordingTelemetry(worker)).writes.filter(
					(write) => write.store === 'sessions',
				).length;
				evidence.continuousCheckpoint = {
					durationMs: Date.now() - beganAt,
					writesBefore,
					writesAfter,
				};
			}
			samples.push(await sampler.sample(`session-${index}-before-stop`));
			const captures = await capturesWithTiming(ui, sequences.length);
			if (mode === 'inflight') {
				// HTTP/1.1 limita conexões simultâneas por host. Quatro requests
				// deixam duas vagas e garantem que TODAS chegaram ao servidor antes do stop.
				const ids = Array.from({ length: 4 }, () => sequence++);
				evidence.responsesOutsideCaptureWindow = ids;
				await target.evaluate((pendingIds) => {
					(window as any).__heldTraffic = Promise.all(
						pendingIds.map(async (seq) => {
							const response = await fetch(`/recording-payload?seq=${seq}&hold=1`, {
								signal: AbortSignal.timeout(15_000),
							});
							const body = await response.json();
							if (
								!response.ok ||
								body.seq !== seq ||
								body.payload !== 'recording-performance-'.repeat(100)
							)
								throw new Error(`Resposta em voo inválida: ${seq}`);
							return seq;
						}),
					);
				}, ids);
				await expect
					.poll(() => fixture.received.filter((id) => ids.includes(id)).sort((a, b) => a - b), {
						timeout: 5_000,
					})
					.toEqual(ids);
				expect(fixture.completed).toHaveLength(sequences.length);
			}
			if (mode === 'size') {
				// Console real via CDP; 1 evento por rodada evita ultrapassar o limite com fila em voo.
				// Teto fixo de ~60MiB de tráfego: nunca crescer indefinidamente.
				let stopped = false;
				for (let marker = 0; marker < 1900; marker++) {
					await target.evaluate(
						(id) => console.info(`size-limit-${id}:` + 'x'.repeat(32 * 1024)),
						marker,
					);
					const status = await send(ui, { action: 'getRecordingStatus', tabId });
					if (marker % 100 === 0) samples.push(await sampler.sample(`size-${marker}`));
					if (status.active === false) {
						stopped = true;
						break;
					}
				}
				expect(stopped, 'limite real de 50MiB deve parar a sessão dentro da carga limitada').toBe(
					true,
				);
			} else if (mode === 'autostop' || mode === 'successive') {
				const remaining = active.session.startedAt + TEN_MINUTES + 100 - Date.now();
				if (remaining > 0) await target.waitForTimeout(remaining);
				await target.evaluate(() => console.info('recording-performance-time-limit'));
				await expect
					.poll(async () => (await send(ui, { action: 'getRecordingStatus', tabId })).active, {
						timeout: 20_000,
					})
					.toBe(false);
			}
			// Stop deve aguardar a última persistência, sem sleep do debounce no teste.
			const stopStartedAt = performance.now();
			await send(ui, { action: 'stopDebugging' });
			const stopMs = performance.now() - stopStartedAt;
			if (mode === 'inflight') {
				fixture.releaseHeld();
				const resolved = await target.evaluate<number[]>(() => (window as any).__heldTraffic);
				expect(resolved).toEqual(evidence.responsesOutsideCaptureWindow);
			}
			expect(stopMs, 'stop/flush limitado a 5s').toBeLessThan(5_000);
			const parity = await assertParity(ui, sessionId, sequences, captures);
			if (mode === 'size') {
				expect(parity.telemetry?.hitHardLimit).toBe(true);
				expect(parity.telemetry?.hardLimitReason).toBe('size');
				expect(parity.telemetry?.endedSizeBytes).toBeGreaterThanOrEqual(50 * 1024 * 1024);
			} else if (mode === 'autostop' || mode === 'successive') {
				expect(parity.telemetry?.hitHardLimit).toBe(true);
				expect(parity.telemetry?.hardLimitReason).toBe('time');
				expect(parity.endedAt - parity.startedAt).toBeGreaterThanOrEqual(TEN_MINUTES);
			}
			(evidence.parity as unknown[]).push({ ...parity, stopMs });
			expect((await send(ui, { action: 'getPendingResponses' })).pendingResponses).toEqual({});
			expect((await send(ui, { action: 'getPendingInterceptions' })).pendingInterceptions).toEqual(
				{},
			);
			expect((await send(ui, { action: 'getDebuggingStatus' })).isDebugging).toBe(false);
			expect((await send(ui, { action: 'getRecordingStatus', tabId })).active).toBe(false);
			await sampleRecordingTelemetry(worker);
			await ui.goto(`chrome-extension://${extensionId}/options.html#/replay/${sessionId}`);
			await expect(ui.getByRole('heading', { name: /^Replay —/ })).toBeVisible();
			await expect(ui.locator('.rrweb-player-host iframe')).toBeVisible();
		}
		expect([...fixture.received].sort((a, b) => a - b)).toEqual(
			Array.from({ length: sequence }, (_, id) => id),
		);
		expect([...fixture.completed].sort((a, b) => a - b)).toEqual(
			[...fixture.received].sort((a, b) => a - b),
		);
		const sessions = await readStore<Session>(ui, 'sessions');
		expect(sessions).toHaveLength(sessionCount);
		expect(sessions.every((session) => session.endedAt !== null)).toBe(true);
		samples.push(await sampler.sample('end'));
		await sampler.close();
		sampler = undefined;
		const telemetry = await sampleRecordingTelemetry(worker);
		evidence.telemetry = telemetry;
		expect(telemetry.errors).toEqual([]);
		expect(telemetry.writes.filter((write) => write.store === 'sessions').length).toBeGreaterThan(
			0,
		);
		// Falhas de persistência/recorder são fatais mesmo quando a UI parece funcionar.
		const persistenceFailures = diagnostics.filter((entry) =>
			/flush|persist|indexeddb|transa[çc][aã]o|salvar|addEvent.*falhou|patchNetwork.*falhou|auto-stop.*falhou/i.test(
				entry.text,
			),
		);
		expect(persistenceFailures).toEqual([]);
		expect(diagnostics.filter((entry) => entry.type === 'uncaught')).toEqual([]);
		expect(
			telemetry.writes.filter((write) => write.store === 'requests').length,
			'write amplification de requests (baseline: 2 puts/request)',
		).toBeLessThanOrEqual(sequence * 3);
		const heapBudget = mode === 'size' ? 512 * 1024 * 1024 : 128 * 1024 * 1024;
		for (const sample of samples) {
			expect(
				sample.target.heap.usedSize - samples[0].target.heap.usedSize,
				`${sample.label}: crescimento heap target`,
			).toBeLessThan(heapBudget);
			const heap = sample.serviceWorkerHeap as { usedSize: number };
			const firstHeap = samples[0].serviceWorkerHeap as { usedSize: number };
			expect(
				heap.usedSize - firstHeap.usedSize,
				`${sample.label}: crescimento heap SW`,
			).toBeLessThan(heapBudget);
		}
		const sessionWrites = telemetry.writes.filter((write) => write.store === 'sessions');
		// Inclui o commit do auto-stop: medir só stopDebugging depois de active=false
		// deixaria um flush final lento fora do orçamento.
		for (const write of sessionWrites) {
			expect(write.transactionMs, `commit de sessão ${write.key}`).toBeDefined();
			expect(write.transactionMs!, 'cada commit de sessão, inclusive auto-stop').toBeLessThan(
				5_000,
			);
		}
		const maxSessionBytes = Math.max(...sessionWrites.map((write) => write.jsonBytes));
		const bytesBudgetMultiplier =
			mode === 'short' || mode === 'continuous' || mode === 'inflight' ? 20 : 250 * sessionCount;
		expect(
			sessionWrites.reduce((sum, write) => sum + write.jsonBytes, 0),
			'limite de bytes regravados no sessions store',
		).toBeLessThan(maxSessionBytes * bytesBudgetMultiplier);
		evidence.budgets = {
			stopMs: 5_000,
			heapGrowthBytes: heapBudget,
			requestsPutsPerRequest: 3,
			sessionBytesMultiplier: bytesBudgetMultiplier,
		};
		if (mode === 'continuous') {
			const checkpoint = evidence.continuousCheckpoint as {
				durationMs: number;
				writesBefore: number;
				writesAfter: number;
			};
			expect(checkpoint.durationMs).toBeGreaterThanOrEqual(3_000);
			expect(
				checkpoint.writesAfter,
				'checkpoint precisa persistir durante tráfego contínuo, antes de stop',
			).toBeGreaterThan(checkpoint.writesBefore);
		}
	} finally {
		evidence.diagnostics = diagnostics;
		if (sampler) {
			try {
				await sampler.close();
			} catch (error) {
				evidence.samplerCloseError = String(error);
			}
		}
		if (worker) {
			try {
				const telemetry = await sampleRecordingTelemetry(worker);
				evidence.telemetry = telemetry;
				evidence.summary = summarizeRecordingTelemetry(telemetry);
			} catch (error) {
				evidence.telemetryReadError = String(error);
			}
		}
		try {
			const evidencePath = testInfo.outputPath('recording-evidence.json');
			await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
			await testInfo.attach('recording-evidence', {
				path: evidencePath,
				contentType: 'application/json',
			});
			await context.tracing.stop({
				path: testInfo.outputPath('recording-first-run-trace.zip'),
			});
		} finally {
			try {
				await context.close();
			} finally {
				await fixture.close();
			}
		}
	}
}

test('gravação real: servidor, captura, IDB, replay e flush final', async ({
	browserName,
}, testInfo) => {
	test.setTimeout(120_000);
	await runRecording(testInfo, 'short');
});

test('autostop real de 10 minutos preserva gravação @soak', async ({ browserName }, testInfo) => {
	test.setTimeout(TEN_MINUTES + 120_000);
	await runRecording(testInfo, 'autostop');
});

test('30 minutos: três sessões reais sucessivas sem órfãos @soak', async ({
	browserName,
}, testInfo) => {
	test.setTimeout(3 * TEN_MINUTES + 180_000);
	await runRecording(testInfo, 'successive');
});

test('limite real de 50MiB encerra sessão com flush final @soak', async ({
	browserName,
}, testInfo) => {
	test.setTimeout(8 * 60_000);
	await runRecording(testInfo, 'size');
});

test('checkpoint durante tráfego contínuo sub-200ms', async ({ browserName }, testInfo) => {
	test.setTimeout(120_000);
	await runRecording(testInfo, 'continuous');
});

test('parar durante tráfego libera requests em voo e preserva a janela capturada', async ({
	browserName,
}, testInfo) => {
	test.setTimeout(120_000);
	await runRecording(testInfo, 'inflight');
});
