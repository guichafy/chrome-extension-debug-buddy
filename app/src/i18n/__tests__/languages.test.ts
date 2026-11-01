import {
	DEFAULT_LANGUAGE,
	SUPPORTED_LANGUAGES,
	isSupportedLanguage,
	matchSupportedLanguage,
	resolveLanguage,
} from '../languages';

describe('matchSupportedLanguage', () => {
	it.each([
		['pt-BR', 'pt-BR'],
		['pt-br', 'pt-BR'],
		['pt_BR', 'pt-BR'],
		['pt', 'pt-BR'],
		['pt-PT', 'pt-BR'],
		['en', 'en'],
		['en-US', 'en'],
		['en_GB', 'en'],
		['EN', 'en'],
	])('casa %s com %s', (tag, expected) => {
		expect(matchSupportedLanguage(tag)).toBe(expected);
	});

	it.each(['fr', 'es-ES', 'zh-CN', '', '   '])('não casa idioma não suportado %j', (tag) => {
		expect(matchSupportedLanguage(tag)).toBeNull();
	});
});

describe('resolveLanguage', () => {
	it('preferência salva vence o idioma do navegador', () => {
		expect(resolveLanguage('en', 'pt-BR')).toBe('en');
		expect(resolveLanguage('pt-BR', 'en-US')).toBe('pt-BR');
	});

	it('sem preferência, segue o idioma do navegador', () => {
		expect(resolveLanguage(null, 'pt-BR')).toBe('pt-BR');
		expect(resolveLanguage(null, 'en-US')).toBe('en');
	});

	it('navegador em idioma não suportado usa o DEFAULT_LANGUAGE (en)', () => {
		expect(DEFAULT_LANGUAGE).toBe('en');
		expect(resolveLanguage(null, 'de-DE')).toBe('en');
	});
});

describe('isSupportedLanguage', () => {
	it('aceita só os códigos suportados', () => {
		for (const code of SUPPORTED_LANGUAGES) {
			expect(isSupportedLanguage(code)).toBe(true);
		}
		expect(isSupportedLanguage('pt')).toBe(false);
		expect(isSupportedLanguage('en-US')).toBe(false);
		expect(isSupportedLanguage(undefined)).toBe(false);
		expect(isSupportedLanguage(42)).toBe(false);
	});
});
