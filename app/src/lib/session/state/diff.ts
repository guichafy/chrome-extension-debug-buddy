import LZString from 'lz-string';
import diff from 'microdiff';

export type DiffOp =
	| { type: 'CREATE'; path: (string | number)[]; value: unknown }
	| { type: 'CHANGE'; path: (string | number)[]; value: unknown; oldValue: unknown }
	| { type: 'REMOVE'; path: (string | number)[]; oldValue: unknown };

export type DiffOps = DiffOp[];

export function computeDiff(prev: unknown, next: unknown): DiffOps {
	if (typeof prev !== 'object' || prev === null || typeof next !== 'object' || next === null) {
		throw new Error('computeDiff aceita apenas objetos no root (state de store).');
	}
	return diff(
		prev as Record<string, unknown>,
		next as Record<string, unknown>,
	) as DiffOps;
}

export function applyDiff(state: unknown, ops: DiffOps): unknown {
	if (typeof state !== 'object' || state === null) {
		throw new Error('applyDiff aceita apenas objeto/array como base.');
	}
	const next: unknown = JSON.parse(JSON.stringify(state));
	for (const op of ops) {
		applyOpInPlace(next, op);
	}
	return next;
}

function applyOpInPlace(root: unknown, op: DiffOp): void {
	if (op.path.length === 0) {
		throw new Error('Path vazio em DiffOp não suportado (root replace).');
	}
	const parentPath = op.path.slice(0, -1);
	const lastKey = op.path[op.path.length - 1];
	let parent: unknown = root;
	for (const key of parentPath) {
		if (typeof parent !== 'object' || parent === null) {
			throw new Error(`Caminho inválido em applyDiff: ${JSON.stringify(op.path)}`);
		}
		parent = (parent as Record<string | number, unknown>)[key];
	}
	if (typeof parent !== 'object' || parent === null) {
		throw new Error(`Parent inválido em applyDiff: ${JSON.stringify(op.path)}`);
	}
	const target = parent as Record<string | number, unknown>;
	if (op.type === 'CREATE' || op.type === 'CHANGE') {
		target[lastKey] = op.value;
	} else if (op.type === 'REMOVE') {
		if (Array.isArray(parent)) {
			(parent as unknown[]).splice(Number(lastKey), 1);
		} else {
			delete target[lastKey];
		}
	}
}

export function compressDiff(ops: DiffOps): string {
	return LZString.compressToBase64(JSON.stringify(ops));
}

export function decompressDiff(s: string): DiffOps {
	const text = LZString.decompressFromBase64(s);
	if (text === null || text === '') {
		throw new Error('Falha ao descomprimir diff (saída vazia).');
	}
	return JSON.parse(text) as DiffOps;
}

export function compressSnapshot(data: unknown): string {
	return LZString.compressToBase64(JSON.stringify(data));
}

export function decompressSnapshot(s: string): unknown {
	const text = LZString.decompressFromBase64(s);
	if (text === null || text === '') {
		throw new Error('Falha ao descomprimir snapshot (saída vazia).');
	}
	return JSON.parse(text);
}
