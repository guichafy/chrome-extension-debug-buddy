// Módulo puro que aplica operações declarativas em documentos JSON usando um
// subset de JSONPath. Suporta:
//   $              raiz
//   .nome          acesso a propriedade (apenas [A-Za-z_][A-Za-z0-9_]*)
//   ['nome']       acesso a propriedade com nome arbitrário entre aspas simples
//   ["nome"]       acesso a propriedade com nome arbitrário entre aspas duplas
//   [0]            acesso a índice de array
//
// Não suporta filtros (`?(...)`), descida recursiva (`..`) ou slices.
//
// Filosofia: nenhuma operação retorna fallback silencioso. Caminho inválido,
// chave inexistente ou tipo incompatível com a operação retornam erro tipado.

import type { TransformOperation, TransformOperationType } from '@/types/rules';

export type PathSegment = { kind: 'prop'; name: string } | { kind: 'index'; index: number };

export type PathParseResult = { ok: true; segments: PathSegment[] } | { ok: false; error: string };

export type ValueParseResult = { ok: true; value: unknown } | { ok: false; error: string };

export type OperationResult<T = unknown> = { ok: true; output: T } | { ok: false; error: string };

export type OperationsResult =
	| { ok: true; output: unknown }
	| { ok: false; error: string; failedAtIndex: number };

export function parseJsonPath(input: string): PathParseResult {
	const trimmed = input.trim();
	if (trimmed.length === 0) return { ok: false, error: 'Caminho vazio' };
	if (trimmed[0] !== '$') return { ok: false, error: 'Caminho deve iniciar com `$`' };

	const segments: PathSegment[] = [];
	let i = 1;
	const len = trimmed.length;

	const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
	const isIdentRest = (c: string): boolean => /[A-Za-z0-9_]/.test(c);

	while (i < len) {
		const c = trimmed[i];
		if (c === '.') {
			i += 1;
			if (i >= len) return { ok: false, error: 'Esperado nome de propriedade após `.`' };
			const start = i;
			if (!isIdentStart(trimmed[i])) {
				return {
					ok: false,
					error: `Nome de propriedade inválido na posição ${i}: "${trimmed[i]}"`,
				};
			}
			while (i < len && isIdentRest(trimmed[i])) i += 1;
			segments.push({ kind: 'prop', name: trimmed.slice(start, i) });
			continue;
		}
		if (c === '[') {
			i += 1;
			if (i >= len) return { ok: false, error: 'Colchete não fechado' };
			const inner = trimmed[i];
			if (inner === '"' || inner === "'") {
				const quote = inner;
				i += 1;
				const start = i;
				while (i < len && trimmed[i] !== quote) i += 1;
				if (i >= len) return { ok: false, error: 'Aspas não fechadas no caminho' };
				const name = trimmed.slice(start, i);
				i += 1;
				if (trimmed[i] !== ']')
					return { ok: false, error: `Esperado \`]\` após nome quoted na posição ${i}` };
				i += 1;
				segments.push({ kind: 'prop', name });
				continue;
			}
			const start = i;
			while (i < len && /[0-9]/.test(trimmed[i])) i += 1;
			if (start === i) {
				return {
					ok: false,
					error: `Esperado índice numérico ou nome quoted após \`[\` na posição ${start}`,
				};
			}
			const indexStr = trimmed.slice(start, i);
			if (trimmed[i] !== ']')
				return { ok: false, error: `Esperado \`]\` após índice na posição ${i}` };
			i += 1;
			segments.push({ kind: 'index', index: Number.parseInt(indexStr, 10) });
			continue;
		}
		return { ok: false, error: `Caractere inesperado "${c}" na posição ${i}` };
	}

	return { ok: true, segments };
}

export function parseOperationValue(raw: string | undefined): ValueParseResult {
	if (raw === undefined) return { ok: true, value: undefined };
	if (raw.length === 0) return { ok: true, value: '' };
	try {
		return { ok: true, value: JSON.parse(raw) };
	} catch (e) {
		return { ok: false, error: `Valor inválido como JSON: ${(e as Error).message}` };
	}
}

function deepClone<T>(input: T): T {
	return JSON.parse(JSON.stringify(input));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface ParentLookup {
	parent: Record<string, unknown> | unknown[];
	last: PathSegment;
}

function navigateToParent(
	root: unknown,
	segments: PathSegment[],
): { ok: true; lookup: ParentLookup } | { ok: false; error: string } {
	if (segments.length === 0) {
		return { ok: false, error: 'Caminho não pode ser apenas `$` para esta operação' };
	}
	let current: unknown = root;
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		if (seg.kind === 'prop') {
			if (!isPlainObject(current)) {
				return {
					ok: false,
					error: `Esperado objeto em \`${describeSegmentsUpTo(segments, i)}\` mas encontrou ${describeType(current)}`,
				};
			}
			if (!(seg.name in current)) {
				return {
					ok: false,
					error: `Propriedade "${seg.name}" não existe em \`${describeSegmentsUpTo(segments, i)}\``,
				};
			}
			current = current[seg.name];
		} else {
			if (!Array.isArray(current)) {
				return {
					ok: false,
					error: `Esperado array em \`${describeSegmentsUpTo(segments, i)}\` mas encontrou ${describeType(current)}`,
				};
			}
			if (seg.index < 0 || seg.index >= current.length) {
				return {
					ok: false,
					error: `Índice ${seg.index} fora dos limites em \`${describeSegmentsUpTo(segments, i)}\``,
				};
			}
			current = current[seg.index];
		}
	}
	const last = segments[segments.length - 1];
	if (last.kind === 'prop' && !isPlainObject(current)) {
		return {
			ok: false,
			error: `Esperado objeto pai mas encontrou ${describeType(current)}`,
		};
	}
	if (last.kind === 'index' && !Array.isArray(current)) {
		return {
			ok: false,
			error: `Esperado array pai mas encontrou ${describeType(current)}`,
		};
	}
	return {
		ok: true,
		lookup: { parent: current as Record<string, unknown> | unknown[], last },
	};
}

function describeType(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	return typeof value;
}

function describeSegmentsUpTo(segments: PathSegment[], upToExclusive: number): string {
	let out = '$';
	for (let i = 0; i < upToExclusive; i++) {
		const s = segments[i];
		out += s.kind === 'prop' ? `.${s.name}` : `[${s.index}]`;
	}
	return out;
}

export function applyOperation(input: unknown, op: TransformOperation): OperationResult {
	const parsedPath = parseJsonPath(op.path);
	if (!parsedPath.ok) return { ok: false, error: `Caminho inválido: ${parsedPath.error}` };

	const cloned = deepClone(input);

	if (parsedPath.segments.length === 0) {
		if (op.type === 'replace') {
			const parsedValue = parseOperationValue(op.value);
			if (!parsedValue.ok) return { ok: false, error: parsedValue.error };
			return { ok: true, output: parsedValue.value };
		}
		return {
			ok: false,
			error: `Operação \`${op.type}\` no root \`$\` não é suportada — use \`replace\``,
		};
	}

	const parsedValue =
		op.type === 'remove' ? { ok: true as const, value: undefined } : parseOperationValue(op.value);
	if (!parsedValue.ok) return { ok: false, error: parsedValue.error };

	const lookup = navigateToParent(cloned, parsedPath.segments);
	if (!lookup.ok) return { ok: false, error: lookup.error };

	const { parent, last } = lookup.lookup;

	if (last.kind === 'prop') {
		const obj = parent as Record<string, unknown>;
		const exists = Object.prototype.hasOwnProperty.call(obj, last.name);
		if (op.type === 'add') {
			if (exists) {
				return {
					ok: false,
					error: `Propriedade "${last.name}" já existe — use \`replace\` para sobrescrever`,
				};
			}
			obj[last.name] = parsedValue.value;
		} else if (op.type === 'replace') {
			if (!exists) {
				return {
					ok: false,
					error: `Propriedade "${last.name}" não existe — use \`add\` para criar`,
				};
			}
			obj[last.name] = parsedValue.value;
		} else {
			if (!exists) {
				return {
					ok: false,
					error: `Propriedade "${last.name}" não existe — nada a remover`,
				};
			}
			delete obj[last.name];
		}
	} else {
		const arr = parent as unknown[];
		const idx = last.index;
		if (op.type === 'add') {
			if (idx < 0 || idx > arr.length) {
				return {
					ok: false,
					error: `Índice ${idx} fora dos limites para inserção (tamanho atual ${arr.length})`,
				};
			}
			arr.splice(idx, 0, parsedValue.value);
		} else if (op.type === 'replace') {
			if (idx < 0 || idx >= arr.length) {
				return {
					ok: false,
					error: `Índice ${idx} fora dos limites (tamanho atual ${arr.length})`,
				};
			}
			arr[idx] = parsedValue.value;
		} else {
			if (idx < 0 || idx >= arr.length) {
				return {
					ok: false,
					error: `Índice ${idx} fora dos limites — nada a remover (tamanho atual ${arr.length})`,
				};
			}
			arr.splice(idx, 1);
		}
	}

	return { ok: true, output: cloned };
}

export function applyOperations(input: unknown, ops: TransformOperation[]): OperationsResult {
	let current = input;
	for (let i = 0; i < ops.length; i++) {
		const r = applyOperation(current, ops[i]);
		if (!r.ok) return { ok: false, error: r.error, failedAtIndex: i };
		current = r.output;
	}
	return { ok: true, output: current };
}

export function describeOperation(op: TransformOperation): string {
	const labels: Record<TransformOperationType, string> = {
		add: 'add',
		remove: 'remove',
		replace: 'replace',
	};
	return `${labels[op.type]} ${op.path}`;
}
