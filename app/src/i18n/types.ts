// Contrato entre o catálogo fonte (pt-BR) e as traduções.
//
// Cada namespace de um idioma é tipado com `Translation<typeof <ns pt-BR>>`:
// o tsc rejeita chave faltando ou sobrando em relação ao pt-BR. Chaves de
// plural (`_one`, `_many`, `_other`...) ficam opcionais no tipo porque cada
// idioma tem suas próprias categorias CLDR (pt: one/many/other; en:
// one/other) — o teste de paridade (`__tests__/catalogParity.test.ts`)
// verifica que cada idioma define exatamente as categorias que o
// Intl.PluralRules dele exige.
//
// Convenção de chaves: camelCase, sem `_` — o `_` fica reservado para o
// sufixo de plural do i18next.

export const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

type PluralSuffix = (typeof PLURAL_SUFFIXES)[number];
type PluralKey = `${string}_${PluralSuffix}`;
type PluralBase<K> = K extends `${infer Base}_${PluralSuffix}` ? Base : never;

export type Translation<T> = {
	[K in keyof T as K extends PluralKey ? never : K]: T[K] extends string
		? string
		: Translation<T[K]>;
} & {
	[K in `${PluralBase<keyof T>}_${PluralSuffix}`]?: string;
};
