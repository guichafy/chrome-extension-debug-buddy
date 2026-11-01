import {
	createTable,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type ColumnDef,
} from '@tanstack/react-table';
import { createRequestRowsCache, getStableFlatCoreRowModel } from '../flatRequestRowModels';
import type { InterceptedResponse } from '@/types/intercepted';

interface Datum {
	id: string;
	value: number | undefined;
	name: string;
}
const a: Datum = { id: 'a', value: 3, name: 'três' };
const b: Datum = { id: 'b', value: 1, name: 'um' };
const c: Datum = { id: 'c', value: 1, name: 'outro' };
const columns: ColumnDef<Datum>[] = [
	{ accessorKey: 'value', sortingFn: 'basic' },
	{ accessorKey: 'name' },
	{ id: 'position', accessorFn: (_, index) => index },
];

function makeTable(data = [a, b, c], stock = false, definitions = columns) {
	const table = createTable<Datum>({
		data,
		columns: definitions,
		getRowId: (row) => row.id,
		getCoreRowModel: stock ? getCoreRowModel() : getStableFlatCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onStateChange: () => {},
		renderFallbackValue: null,
		state: {
			sorting: [{ id: 'value', desc: false }],
			columnFilters: [],
			pagination: { pageIndex: 0, pageSize: 2 },
		},
	});
	return table;
}

test('reutiliza linhas e caches inalterados, substituindo somente a request modificada', () => {
	const table = makeTable();
	const first = table.getCoreRowModel();
	expect(first.rowsById.b.getValue('value')).toBe(1);
	const updated = { ...b, value: 9 };
	table.setOptions((options) => ({ ...options, data: [a, updated, c] }));
	const second = table.getCoreRowModel();
	expect(second.rowsById.a).toBe(first.rowsById.a);
	expect(second.rowsById.c).toBe(first.rowsById.c);
	expect(second.rowsById.b).not.toBe(first.rowsById.b);
	expect(second.rowsById.b.getValue('value')).toBe(9);
	expect(table.getRowModel().rows.map((row) => row.id)).toEqual(['c', 'a']);
	expect(table.getCoreRowModel()).toBe(second);
});

test('reordenação atualiza índices e restauração reaproveita objetos ainda pertencentes ao histórico', () => {
	const table = makeTable();
	const first = table.getCoreRowModel();
	expect(first.rowsById.c.getValue('position')).toBe(2);
	table.setOptions((options) => ({ ...options, data: [c, a] }));
	const second = table.getCoreRowModel();
	expect(second.rowsById.c.index).toBe(0);
	expect(second.rowsById.c.getValue('position')).toBe(0);
	expect(second.rowsById.b).toBeUndefined();
	table.setOptions((options) => ({ ...options, data: [a, b, c] }));
	expect(table.getCoreRowModel().rowsById.b).toBe(first.rowsById.b);
	expect(table.getCoreRowModel().rowsById.c.getValue('position')).toBe(2);
});

test('filtrar e remover filtro mantém linhas inalteradas e invalida substituições com mesmo ID', () => {
	const table = makeTable();
	const first = table.getCoreRowModel();
	table.setOptions((options) => ({ ...options, data: [a] }));
	expect(Object.keys(table.getCoreRowModel().rowsById)).toEqual(['a']);
	table.setOptions((options) => ({ ...options, data: [a, b, c] }));
	const restored = table.getCoreRowModel();
	expect(restored.rowsById.a).toBe(first.rowsById.a);
	expect(restored.rowsById.b).toBe(first.rowsById.b);
	expect(restored.rowsById.c).toBe(first.rowsById.c);
	table.setOptions((options) => ({ ...options, data: [a, { ...b, value: 15 }, c] }));
	expect(table.getCoreRowModel().rowsById.b).not.toBe(first.rowsById.b);
	expect(table.getCoreRowModel().rowsById.b.getValue('value')).toBe(15);
});

test('trocar colunas com filtro ativo invalida também linhas temporariamente ocultas', () => {
	const table = makeTable();
	const old = table.getCoreRowModel().rowsById.b;
	expect(old.getValue('value')).toBe(1);
	table.setOptions((options) => ({ ...options, data: [a] }));
	table.getCoreRowModel();
	table.setOptions((options) => ({
		...options,
		columns: [{ id: 'value', accessorFn: (row) => row.value! * 10 }],
	}));
	table.getCoreRowModel();
	table.setOptions((options) => ({ ...options, data: [a, b, c] }));
	const restored = table.getCoreRowModel().rowsById.b;
	expect(restored).not.toBe(old);
	expect(restored.getValue('value')).toBe(10);
});

test('dataset vazio descarta também caches fracos mesmo com objetos antigos retidos externamente', () => {
	const table = makeTable();
	const original = table.getCoreRowModel().rowsById.a;
	table.setOptions((options) => ({ ...options, data: [] }));
	expect(table.getCoreRowModel().rows).toEqual([]);
	table.setOptions((options) => ({ ...options, data: [a, b, c] }));
	expect(table.getCoreRowModel().rowsById.a).not.toBe(original);
});

test('trocar definição de coluna invalida valor e células mesmo com os mesmos dados', () => {
	const table = makeTable();
	const first = table.getCoreRowModel().rowsById.a;
	expect(first.getValue('value')).toBe(3);
	const oldCell = first.getAllCells()[0];
	table.setOptions((options) => ({
		...options,
		columns: [{ id: 'value', accessorFn: (row) => row.value! * 10 }],
	}));
	const next = table.getCoreRowModel().rowsById.a;
	expect(next.getValue('value')).toBe(30);
	expect(next.getAllCells()[0]).not.toBe(oldCell);
});

test('preserva ordenação e paginação sem alterar a ordem do modelo original', () => {
	const table = makeTable();
	const core = table.getCoreRowModel();
	const sorted = table.getSortedRowModel();
	expect(sorted.rows.map((row) => row.id)).toEqual(['b', 'c', 'a']);
	expect(core.rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
	expect(sorted.flatRows).toEqual(sorted.rows);
	const firstPage = table.getRowModel();
	expect(firstPage.rows.map((row) => row.id)).toEqual(['b', 'c']);
	table.setOptions((options) => ({
		...options,
		state: { ...options.state, pagination: { pageIndex: 1, pageSize: 2 } },
	}));
	expect(table.getRowModel().rows.map((row) => row.id)).toEqual(['a']);
});

test.each([false, -1, 1, 'first', 'last'] as const)(
	'preserva ordenação TanStack com undefined=%s, inversão e múltiplas colunas',
	(sortUndefined) => {
		for (const desc of [false, true]) {
			for (const invertSorting of [false, true]) {
				const definitions: ColumnDef<Datum>[] = [
					{ accessorKey: 'value', sortingFn: 'basic', sortUndefined, invertSorting },
					{ accessorKey: 'name', sortingFn: 'alphanumeric' },
				];
				const data = [a, { id: 'missing', value: undefined, name: 'sem' }, b, c];
				const actual = makeTable(data, false, definitions);
				const stock = makeTable(data, true, definitions);
				for (const table of [actual, stock]) {
					table.setOptions((options) => ({
						...options,
						state: {
							...options.state,
							sorting: [
								{ id: 'value', desc },
								{ id: 'name', desc: false },
							],
						},
					}));
				}
				expect(actual.getSortedRowModel().rows.map((row) => row.id)).toEqual(
					stock.getSortedRowModel().rows.map((row) => row.id),
				);
			}
		}
	},
);

test('filtro e paginação usam requests atualizadas sem manter linhas removidas', () => {
	const table = makeTable();
	table.setOptions((options) => ({
		...options,
		state: { ...options.state, columnFilters: [{ id: 'name', value: 'um' }] },
	}));
	expect(table.getRowModel().rows.map((row) => row.id)).toEqual(['b']);
	table.setOptions((options) => ({ ...options, data: [a, { ...b, name: 'mudou' }, c] }));
	expect(table.getRowModel().rows).toEqual([]);
	table.setOptions((options) => ({ ...options, data: [] }));
	expect(table.getCoreRowModel().rowsById).toEqual({});
});

test('wrapper conserva referências entre filtros, distinguindo IDs que compartilham a resposta', () => {
	const build = createRequestRowsCache();
	const request: InterceptedResponse = {
		url: 'https://example.test',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'Fetch',
		timestamp: 1,
	};
	const pending = { ...request, isWaiting: true };
	const first = build({ a: request, b: pending });
	const second = build({ a: request, b: { ...pending, isWaiting: false } });
	expect(second.rows[0]).toBe(first.rows[0]);
	expect(second.rows[1]).not.toBe(first.rows[1]);
	expect(first.pendingRowIds.has('b')).toBe(true);
	expect(second.pendingRowIds.size).toBe(0);
	build({ b: pending });
	const third = build({ b: pending, a: request });
	expect(third.rows.map((row) => row.id)).toEqual(['b', 'a']);
	expect(third.rows[1]).toBe(first.rows[0]);
	const aliases = build({ a: request, alias: request });
	expect(aliases.rows[0]).toBe(first.rows[0]);
	expect(aliases.rows[1]).not.toBe(aliases.rows[0]);
	expect(aliases.rows[1].id).toBe('alias');
	expect(aliases.rows[1].request).toBe(request);
	expect(build({}).rows).toEqual([]);
	expect(build({ a: request }).rows[0]).not.toBe(first.rows[0]);
	const replaced = build({ a: { ...request, status: 201 } });
	expect(replaced.rows[0]).not.toBe(first.rows[0]);
	expect(replaced.rows[0].request.status).toBe(201);
});
