// Paridade dos catálogos: complementa a checagem do tsc (`Translation<T>`)
// com o que o sistema de tipos não enxerga — categorias de plural por idioma,
// variáveis de interpolação e strings vazias.
import { type LanguageCode, SUPPORTED_LANGUAGES } from '../languages';
import en from '../locales/en';
import ptBR from '../locales/pt-BR';
import { PLURAL_SUFFIXES } from '../types';

type Catalog = Record<string, unknown>;

const CATALOGS: Record<LanguageCode, Catalog> = { 'pt-BR': ptBR, en };

const PLURAL_RE = new RegExp(`^(.+)_(${PLURAL_SUFFIXES.join('|')})$`);

function flatten(node: Catalog, prefix = ''): Map<string, string> {
	const out = new Map<string, string>();
	for (const [key, value] of Object.entries(node)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === 'string') {
			out.set(path, value);
		} else if (value && typeof value === 'object') {
			for (const [k, v] of flatten(value as Catalog, path)) out.set(k, v);
		} else {
			throw new Error(`valor não-string no catálogo em ${path}: ${typeof value}`);
		}
	}
	return out;
}

interface Entry {
	// sufixos de plural definidos para a chave base ('' = chave sem plural)
	forms: Map<string, string>;
}

function group(flat: Map<string, string>): Map<string, Entry> {
	const out = new Map<string, Entry>();
	for (const [path, value] of flat) {
		const match = PLURAL_RE.exec(path);
		const base = match ? match[1] : path;
		const suffix = match ? match[2] : '';
		const entry = out.get(base) ?? { forms: new Map() };
		entry.forms.set(suffix, value);
		out.set(base, entry);
	}
	return out;
}

// Variáveis `{{nome}}` e tags de componente `<nome>` (usadas pelo <Trans>).
function placeholders(text: string): string[] {
	const variables = [...text.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)].map((m) => m[1]);
	const tags = [...text.matchAll(/<(\w+)>/g)].map((m) => `<${m[1]}>`);
	return [...variables, ...tags].sort();
}

const grouped = Object.fromEntries(
	SUPPORTED_LANGUAGES.map((lng) => [lng, group(flatten(CATALOGS[lng]))]),
) as Record<LanguageCode, Map<string, Entry>>;

const source = grouped['pt-BR'];

describe('catálogos de tradução', () => {
	it('todos os idiomas têm os mesmos namespaces', () => {
		for (const lng of SUPPORTED_LANGUAGES) {
			expect(Object.keys(CATALOGS[lng]).sort()).toEqual(Object.keys(ptBR).sort());
		}
	});

	it.each(SUPPORTED_LANGUAGES)('%s tem exatamente as chaves do catálogo fonte (pt-BR)', (lng) => {
		expect([...grouped[lng].keys()].sort()).toEqual([...source.keys()].sort());
	});

	it.each(SUPPORTED_LANGUAGES)(
		'%s define as categorias de plural exigidas pelo Intl.PluralRules',
		(lng) => {
			const required = [...new Intl.PluralRules(lng).resolvedOptions().pluralCategories].sort();
			const problems: string[] = [];
			for (const [base, entry] of grouped[lng]) {
				const isPluralInSource = !source.get(base)?.forms.has('');
				const suffixes = [...entry.forms.keys()].sort();
				if (!isPluralInSource) {
					if (suffixes.join() !== '') problems.push(`${base}: plural só neste idioma`);
					continue;
				}
				// `_zero` é opcional em qualquer idioma: o i18next usa a forma quando
				// count === 0 (ex.: preservar "0 abas", já que o CLDR do pt trata 0
				// como singular).
				const withoutZero = suffixes.filter((suffix) => suffix !== 'zero');
				if (withoutZero.join() !== required.filter((c) => c !== 'zero').join()) {
					problems.push(`${base}: tem [${suffixes}] mas ${lng} exige [${required}]`);
				}
			}
			expect(problems).toEqual([]);
		},
	);

	it.each(SUPPORTED_LANGUAGES)('%s usa as mesmas variáveis de interpolação que o pt-BR', (lng) => {
		const problems: string[] = [];
		for (const [base, entry] of grouped[lng]) {
			const expected = placeholders([...(source.get(base)?.forms.values() ?? [])].join(' '));
			const expectedSet = [...new Set(expected)].sort();
			for (const [suffix, text] of entry.forms) {
				const got = [...new Set(placeholders(text))].sort();
				// Uma forma de plural pode omitir {{count}} ("one request").
				const missing = expectedSet.filter((v) => !got.includes(v) && v !== 'count');
				const extra = got.filter((v) => !expectedSet.includes(v));
				if (missing.length > 0 || extra.length > 0) {
					problems.push(
						`${base}${suffix ? `_${suffix}` : ''}: faltando [${missing}] sobrando [${extra}]`,
					);
				}
			}
		}
		expect(problems).toEqual([]);
	});

	it.each(SUPPORTED_LANGUAGES)('%s não tem traduções vazias', (lng) => {
		const empty = [...flatten(CATALOGS[lng])]
			.filter(([, value]) => value.trim() === '')
			.map(([key]) => key);
		expect(empty).toEqual([]);
	});

	it('chaves seguem a convenção camelCase sem "_" (reservado para plural)', () => {
		const bad = [...flatten(ptBR).keys()].filter((path) => {
			const withoutPlural = path.replace(PLURAL_RE, '$1');
			return withoutPlural.split('.').some((segment) => !/^[a-z][a-zA-Z0-9]*$/.test(segment));
		});
		expect(bad).toEqual([]);
	});
});
