import { arrayBufferToBase64, base64ToArrayBuffer } from '../binaryTransport';

describe('binaryTransport', () => {
	test('round-trip preserva bytes exatos', () => {
		const original = new Uint8Array([0, 1, 2, 254, 255, 65, 66, 67]);
		const b64 = arrayBufferToBase64(original.buffer);
		const round = new Uint8Array(base64ToArrayBuffer(b64));
		expect(round).toEqual(original);
	});

	test('encoda buffer vazio sem corromper', () => {
		const empty = new ArrayBuffer(0);
		const b64 = arrayBufferToBase64(empty);
		expect(b64).toBe('');
		const round = base64ToArrayBuffer(b64);
		expect(round.byteLength).toBe(0);
	});

	test('encoda buffer maior que CHUNK_SIZE (0x8000) sem stack overflow', () => {
		// 200KB — exercita o loop em chunks
		const size = 200 * 1024;
		const original = new Uint8Array(size);
		for (let i = 0; i < size; i++) original[i] = i % 256;
		const b64 = arrayBufferToBase64(original.buffer);
		const round = new Uint8Array(base64ToArrayBuffer(b64));
		expect(round.length).toBe(size);
		expect(round[0]).toBe(0);
		expect(round[255]).toBe(255);
		expect(round[size - 1]).toBe((size - 1) % 256);
	});
});
