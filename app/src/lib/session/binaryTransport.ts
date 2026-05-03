// Helpers para transportar binários (zip, etc) através de chrome.runtime.sendMessage.
//
// chrome.runtime.sendMessage exige payload JSON-serializável: ArrayBuffer/Uint8Array
// chegam ao outro lado como `{}`. Quando o destinatário tenta `new Blob([{}])`, o
// objeto é coerced para `"[object Object]"` (15 bytes) e o download fica corrompido.
//
// Solução: encodar como base64 antes de enviar e decodar no destinatário. Overhead
// de 33% no transporte, mas funciona em todos os Chromes (MV2 e MV3).
//
// Performance: btoa/atob via fromCharCode em chunks de 0x8000 evita estouro de
// argumentos em arquivos grandes (apply() limita ~64k argumentos em alguns engines).

const CHUNK_SIZE = 0x8000;

export function arrayBufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		const chunk = bytes.subarray(i, i + CHUNK_SIZE);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
