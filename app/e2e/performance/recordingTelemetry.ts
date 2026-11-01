import type { BrowserContext, Worker } from '@playwright/test';

export interface RecordingWrite {
	store: string;
	key: string;
	at: number;
	jsonBytes: number;
	measurementMs: number;
	requestMs?: number;
	transactionMs?: number;
	error?: string;
}
export interface RecordingTelemetry {
	writes: RecordingWrite[];
	messages: Record<string, number>;
	errors: string[];
	diagnostics: string[];
	startedAt: number;
	memory: {
		supported: boolean;
		samples: Array<{ at: number; usedJSHeapSize: number }>;
	};
}

declare global {
	var __recordingPerformance: RecordingTelemetry;
}

/** Instrumentação apenas no runner; contabiliza JSON UTF-8, não bytes físicos do IDB. */
export async function installRecordingTelemetry(worker: Worker) {
	await worker.evaluate(() => {
		const telemetry: RecordingTelemetry = {
			writes: [],
			messages: {},
			errors: [],
			diagnostics: [],
			startedAt: Date.now(),
			memory: { supported: false, samples: [] },
		};
		globalThis.__recordingPerformance = telemetry;
		for (const level of ['warn', 'error'] as const) {
			const original = console[level];
			console[level] = (...args: unknown[]) => {
				const message = args.map(String).join(' ');
				telemetry.diagnostics.push(message);
				if (
					/flush|persist|indexeddb|transa[çc][aã]o|salvar|addEvent.*falhou|patchNetwork.*falhou|auto-stop.*falhou/i.test(
						message,
					)
				)
					telemetry.errors.push(message);
				original.apply(console, args);
			};
		}
		const originalPut = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (value, key) {
			const measurementStart = performance.now();
			const jsonBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
			const measurementMs = performance.now() - measurementStart;
			const at = performance.now();
			const row: RecordingWrite = {
				store: this.name,
				key: String(value.id),
				at: Date.now(),
				jsonBytes,
				measurementMs,
			};
			telemetry.writes.push(row);
			try {
				const request =
					key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
				request.addEventListener('success', () => {
					row.requestMs = performance.now() - at;
				});
				request.addEventListener('error', () => {
					row.error = String(request.error);
					telemetry.errors.push(`IDB put ${this.name}: ${request.error}`);
				});
				this.transaction.addEventListener('complete', () => {
					row.transactionMs = performance.now() - at;
				});
				this.transaction.addEventListener('abort', () => {
					row.error = String(this.transaction.error);
					telemetry.errors.push(`IDB abort ${this.name}: ${this.transaction.error}`);
				});
				return request;
			} catch (error) {
				row.error = String(error);
				telemetry.errors.push(`IDB put lançou: ${error}`);
				throw error;
			}
		};
		chrome.runtime.onMessage.addListener((message) => {
			const action = message.action;
			if (typeof action === 'string')
				telemetry.messages[action] = (telemetry.messages[action] ?? 0) + 1;
			return false;
		});
	});
}

export function watchRecordingErrors(context: BrowserContext) {
	const diagnostics: Array<{
		at: number;
		type: string;
		text: string;
		url: string;
	}> = [];
	context.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') {
			diagnostics.push({
				at: Date.now(),
				type: message.type(),
				text: message.text(),
				url: message.location().url,
			});
		}
	});
	context.on('weberror', (event) => {
		diagnostics.push({
			at: Date.now(),
			type: 'uncaught',
			text: String(event.error()),
			url: event.page()?.url() ?? 'service-worker',
		});
	});
	return diagnostics;
}

export async function sampleRecordingTelemetry(worker: Worker) {
	return worker.evaluate(() => {
		const telemetry = globalThis.__recordingPerformance;
		if (!telemetry)
			throw new Error('Telemetria perdida: service worker reiniciou durante a medição');
		const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
		if (memory) {
			telemetry.memory.supported = true;
			telemetry.memory.samples.push({
				at: Date.now(),
				usedJSHeapSize: memory.usedJSHeapSize,
			});
		}
		return telemetry;
	});
}

export function summarizeRecordingTelemetry(telemetry: RecordingTelemetry) {
	return Object.fromEntries(
		['requests', 'sessions'].map((store) => {
			const writes = telemetry.writes.filter((write) => write.store === store);
			const durations = writes
				.flatMap((write) => (write.transactionMs === undefined ? [] : [write.transactionMs]))
				.sort((a, b) => a - b);
			const first = writes[0];
			const last = writes[writes.length - 1];
			const spanMs = first && last ? last.at - first.at : null;
			return [
				store,
				{
					puts: writes.length,
					committed: durations.length,
					jsonBytesWritten: writes.reduce((sum, write) => sum + write.jsonBytes, 0),
					measurementOverheadMs: writes.reduce((sum, write) => sum + write.measurementMs, 0),
					spanMs,
					putsPerSecond: spanMs !== null && spanMs > 0 ? (writes.length * 1000) / spanMs : null,
					transactionP50Ms: durations.length
						? durations[Math.floor((durations.length - 1) * 0.5)]
						: null,
					transactionP95Ms: durations.length
						? durations[Math.floor((durations.length - 1) * 0.95)]
						: null,
					transactionMaxMs: durations.length ? durations[durations.length - 1] : null,
				},
			];
		}),
	);
}

/** CDP separado do debugger da extensão; não coleta heap snapshot nem força GC. */
export async function createRecordingSampler(
	context: BrowserContext,
	target: import('@playwright/test').Page,
	ui: import('@playwright/test').Page,
	workerUrl: string,
) {
	const pageSession = await context.newCDPSession(target);
	await pageSession.send('Performance.enable');
	const router = await context.newCDPSession(ui);
	const targets = await router.send('Target.getTargets');
	const workerTarget = targets.targetInfos.find(
		(candidate) => candidate.type === 'service_worker' && candidate.url === workerUrl,
	);
	if (!workerTarget) throw new Error('Target CDP do service worker não encontrado');
	const attached = await router.send('Target.attachToTarget', {
		targetId: workerTarget.targetId,
		flatten: false,
	});
	let nextId = 0;
	async function workerHeap() {
		const id = ++nextId;
		return new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				router.off('Target.receivedMessageFromTarget', onMessage);
				reject(new Error('Timeout de Runtime.getHeapUsage do service worker'));
			}, 5_000);
			const onMessage = (event: { sessionId: string; message: string }) => {
				if (event.sessionId !== attached.sessionId) return;
				const response = JSON.parse(event.message);
				if (response.id !== id) return;
				clearTimeout(timeout);
				router.off('Target.receivedMessageFromTarget', onMessage);
				if (response.error) reject(new Error(JSON.stringify(response.error)));
				else resolve(response.result);
			};
			router.on('Target.receivedMessageFromTarget', onMessage);
			void router
				.send('Target.sendMessageToTarget', {
					sessionId: attached.sessionId,
					message: JSON.stringify({ id, method: 'Runtime.getHeapUsage' }),
				})
				.catch((error) => {
					clearTimeout(timeout);
					router.off('Target.receivedMessageFromTarget', onMessage);
					reject(error);
				});
		});
	}
	return {
		sample: async (label: string) => {
			const [performance, heap, dom, serviceWorkerHeap, storage] = await Promise.all([
				pageSession.send('Performance.getMetrics'),
				pageSession.send('Runtime.getHeapUsage'),
				pageSession.send('Memory.getDOMCounters'),
				workerHeap(),
				ui.evaluate(() => navigator.storage.estimate()),
			]);
			return {
				label,
				at: Date.now(),
				target: {
					performance: Object.fromEntries(
						performance.metrics.map((metric) => [metric.name, metric.value]),
					),
					heap,
					dom,
				},
				serviceWorkerHeap,
				storage,
			};
		},
		close: async () => {
			await router.send('Target.detachFromTarget', { sessionId: attached.sessionId });
			await router.detach();
			await pageSession.detach();
		},
	};
}
