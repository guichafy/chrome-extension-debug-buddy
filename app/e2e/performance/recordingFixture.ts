import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Servidor isolado por teste: ledger independente do navegador e da extensão. */
export async function startRecordingFixture() {
	const received: number[] = [];
	const completed: number[] = [];
	const held: Array<() => void> = [];
	const releaseHeld = () => {
		for (const respond of held.splice(0)) respond();
	};
	const server = createServer((request, response) => {
		const url = new URL(request.url!, 'http://localhost');
		response.setHeader('Cache-Control', 'no-store');
		if (url.pathname === '/recording-target.html') {
			response.setHeader('Content-Type', 'text/html');
			response.end(
				'<!doctype html><html><head><title>Recording performance target</title><link rel="icon" href="data:,"></head><body><h1>Recording performance</h1><output id="progress">0</output></body></html>',
			);
			return;
		}
		if (url.pathname !== '/recording-payload') {
			response.writeHead(404).end();
			return;
		}
		const seq = Number(url.searchParams.get('seq'));
		if (!Number.isSafeInteger(seq) || seq < 0 || !url.searchParams.has('seq')) {
			response.writeHead(400).end('seq inválida');
			return;
		}
		received.push(seq);
		response.once('finish', () => completed.push(seq));
		// Latência real, pequena e limitada; bodies abaixo do cap de replay (64 KiB).
		const respond = () => {
			response.setHeader('Content-Type', 'application/json');
			response.end(JSON.stringify({ seq, payload: 'recording-performance-'.repeat(100) }));
		};
		if (url.searchParams.get('hold') === '1') held.push(respond);
		else setTimeout(respond, 20);
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const { port } = server.address() as AddressInfo;
	return {
		origin: `http://127.0.0.1:${port}`,
		received,
		completed,
		releaseHeld,
		close: () => {
			releaseHeld();
			return new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		},
	};
}
