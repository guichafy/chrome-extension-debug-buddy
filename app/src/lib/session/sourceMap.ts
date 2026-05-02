// Resolver lazy de source maps para callsites minificados.
// - Tenta GET <file>.map quando linha=1 e coluna alta (heurística "minificado").
// - Cache LRU por arquivo (50 entradas; falhas também são cacheadas como null).
// - Fallback silencioso para raw quando .map ausente, inválido, ou bloqueado por CORS.
// Sem fallbacks fabricados (CLAUDE.md): se o map não traduzir, `resolved` = undefined.

import { SourceMapConsumer } from 'source-map';
import type { RawCallsite, ResolvedCallsite } from './types';

const CACHE_MAX = 50;
const MIN_COLUMN_FOR_MINIFIED = 200; // heurística: builds reais raramente passam de 200 em col válida

interface CacheEntry {
	consumer: SourceMapConsumer | null; // null = tentado e falhou
	lastAccess: number;
}

const cache = new Map<string, CacheEntry>();

function evictIfNeeded(): void {
	if (cache.size <= CACHE_MAX) return;
	let oldestKey: string | null = null;
	let oldest = Infinity;
	for (const [k, v] of cache) {
		if (v.lastAccess < oldest) {
			oldest = v.lastAccess;
			oldestKey = k;
		}
	}
	if (oldestKey) cache.delete(oldestKey);
}

function looksMinified(call: RawCallsite): boolean {
	return call.line === 1 && (call.column ?? 0) >= MIN_COLUMN_FOR_MINIFIED;
}

async function loadConsumer(fileUrl: string): Promise<SourceMapConsumer | null> {
	const cached = cache.get(fileUrl);
	if (cached) {
		cached.lastAccess = Date.now();
		return cached.consumer;
	}
	const mapUrl = `${fileUrl}.map`;
	let consumer: SourceMapConsumer | null = null;
	try {
		const res = await fetch(mapUrl);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const raw = await res.json();
		consumer = await new SourceMapConsumer(raw);
	} catch {
		consumer = null;
	}
	cache.set(fileUrl, { consumer, lastAccess: Date.now() });
	evictIfNeeded();
	return consumer;
}

export async function resolveCallsite(raw: RawCallsite): Promise<ResolvedCallsite> {
	if (!looksMinified(raw)) {
		return { raw };
	}
	const consumer = await loadConsumer(raw.file);
	if (!consumer) return { raw };

	const original = consumer.originalPositionFor({
		line: raw.line,
		column: raw.column ?? 0,
	});

	if (!original.source || original.line === null) {
		return { raw };
	}

	return {
		raw,
		resolved: {
			file: original.source,
			line: original.line,
			column: original.column ?? undefined,
		},
	};
}

export function _resetCacheForTests(): void {
	for (const v of cache.values()) v.consumer?.destroy();
	cache.clear();
}
