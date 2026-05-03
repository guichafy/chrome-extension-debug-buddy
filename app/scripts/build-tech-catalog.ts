#!/usr/bin/env tsx
// Build do catálogo de tecnologias do Live Insights.
// Lê whitelist + repo upstream do webappanalyzer e popula
// app/src/lib/insights/catalog/ com subset curado.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const WHITELIST_PATH = path.join(REPO_ROOT, 'scripts/tech-whitelist.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'src/lib/insights/catalog');
const UPSTREAM = process.env.WAPPALYZER_SRC ?? '/Users/guichafy/Workspaces/webappanalyzer-main/src';

const TechSchema = z.object({
	cats: z.array(z.number()).min(1),
	website: z.string().min(1),
	description: z.string().optional(),
	icon: z.string().optional(),
	cookies: z.record(z.string()).optional(),
	dom: z.union([z.array(z.string()), z.string(), z.record(z.unknown())]).optional(),
	js: z.record(z.string()).optional(),
	headers: z.record(z.string()).optional(),
	html: z.array(z.string()).optional(),
	text: z.array(z.string()).optional(),
	css: z.array(z.string()).optional(),
	meta: z.record(z.union([z.string(), z.array(z.string())])).optional(),
	scriptSrc: z.array(z.string()).optional(),
	scripts: z.array(z.string()).optional(),
	url: z.array(z.string()).optional(),
	xhr: z.array(z.string()).optional(),
	implies: z.array(z.string()).optional(),
	requires: z.array(z.string()).optional(),
	requiresCategory: z.array(z.number()).optional(),
	excludes: z.array(z.string()).optional(),
}).passthrough();

type RawTech = z.infer<typeof TechSchema>;

function readJson<T>(p: string): T {
	return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function writeJson(p: string, data: unknown): void {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, `${JSON.stringify(data, null, '\t')}\n`, 'utf8');
}

function bucketLetter(name: string): string {
	const ch = name[0]?.toLowerCase() ?? '_';
	return /[a-z]/.test(ch) ? ch : '_';
}

function loadUpstreamTech(): Map<string, RawTech> {
	const all = new Map<string, RawTech>();
	const files = fs.readdirSync(path.join(UPSTREAM, 'technologies'));
	for (const file of files) {
		if (!file.endsWith('.json')) continue;
		const data = readJson<Record<string, RawTech>>(
			path.join(UPSTREAM, 'technologies', file),
		);
		for (const [name, raw] of Object.entries(data)) {
			all.set(name, raw);
		}
	}
	return all;
}

function main(): void {
	const whitelist = readJson<string[]>(WHITELIST_PATH);
	const upstream = loadUpstreamTech();

	const subset = new Map<string, RawTech>();
	const missing: string[] = [];
	for (const name of whitelist) {
		const raw = upstream.get(name);
		if (!raw) {
			missing.push(name);
			continue;
		}
		// Valida — falha = erro fatal.
		try {
			TechSchema.parse(raw);
		} catch (err) {
			throw new Error(`[catalog] '${name}' falhou validação Zod: ${(err as Error).message}`);
		}
		subset.set(name, raw);
	}

	if (missing.length > 0) {
		console.error(
			`[catalog] aviso: ${missing.length} tech(s) na whitelist não encontrados no upstream:`,
		);
		for (const m of missing) console.error(`  - ${m}`);
	}

	// Avisos para implies/requires/excludes fora da whitelist.
	const inWhitelist = new Set(subset.keys());
	const orphans: Array<{ tech: string; field: string; target: string }> = [];
	for (const [name, raw] of subset) {
		for (const dep of raw.implies ?? []) {
			const targetName = dep.split('\\;')[0];
			if (!inWhitelist.has(targetName)) {
				orphans.push({ tech: name, field: 'implies', target: targetName });
			}
		}
		for (const r of raw.requires ?? []) {
			if (!inWhitelist.has(r)) orphans.push({ tech: name, field: 'requires', target: r });
		}
		for (const e of raw.excludes ?? []) {
			if (!inWhitelist.has(e)) orphans.push({ tech: name, field: 'excludes', target: e });
		}
	}
	if (orphans.length > 0) {
		console.error(
			`[catalog] aviso: ${orphans.length} referência(s) órfã (target fora da whitelist):`,
		);
		for (const o of orphans) {
			console.error(`  - ${o.tech}.${o.field} -> ${o.target}`);
		}
	}

	// Limpa output dir.
	if (fs.existsSync(OUTPUT_DIR)) {
		for (const f of fs.readdirSync(OUTPUT_DIR)) {
			if (f.endsWith('.json')) fs.unlinkSync(path.join(OUTPUT_DIR, f));
		}
	}

	// Buckets por letra inicial (mirroring upstream).
	const buckets = new Map<string, Record<string, RawTech>>();
	for (const [name, raw] of subset) {
		const letter = bucketLetter(name);
		const bucket = buckets.get(letter) ?? {};
		bucket[name] = raw;
		buckets.set(letter, bucket);
	}
	for (const [letter, bucket] of buckets) {
		writeJson(path.join(OUTPUT_DIR, `${letter}.json`), bucket);
	}

	// Filtra categories.json + groups.json.
	const upCats = readJson<Record<string, { name: string; priority: number; groups?: number[] }>>(
		path.join(UPSTREAM, 'categories.json'),
	);
	const upGroups = readJson<Record<string, { name: string }>>(
		path.join(UPSTREAM, 'groups.json'),
	);
	const usedCatIds = new Set<number>();
	for (const raw of subset.values()) for (const c of raw.cats) usedCatIds.add(c);
	const subsetCats: Record<string, { name: string; priority: number; groups?: number[] }> = {};
	const usedGroupIds = new Set<number>();
	for (const id of usedCatIds) {
		const c = upCats[String(id)];
		if (!c) continue;
		subsetCats[String(id)] = c;
		for (const g of c.groups ?? []) usedGroupIds.add(g);
	}
	const subsetGroups: Record<string, { name: string }> = {};
	for (const id of usedGroupIds) {
		const g = upGroups[String(id)];
		if (g) subsetGroups[String(id)] = g;
	}
	writeJson(path.join(OUTPUT_DIR, 'categories.json'), subsetCats);
	writeJson(path.join(OUTPUT_DIR, 'groups.json'), subsetGroups);

	// Sumário.
	const totalSize = fs.readdirSync(OUTPUT_DIR)
		.filter((f) => f.endsWith('.json'))
		.reduce((acc, f) => acc + fs.statSync(path.join(OUTPUT_DIR, f)).size, 0);
	console.log(
		`[catalog] sucesso: ${subset.size} techs, ${usedCatIds.size} categorias, ` +
			`${usedGroupIds.size} grupos, ${(totalSize / 1024).toFixed(1)} KB`,
	);
}

main();
