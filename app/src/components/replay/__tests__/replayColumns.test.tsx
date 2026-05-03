import { render } from '@testing-library/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { replayColumns } from '../replayColumns';
import type { ReplayRequestRow } from '@/lib/session/sessionNetworkAdapter';

function Harness({ rows }: { rows: ReplayRequestRow[] }) {
	const table = useReactTable({
		data: rows,
		columns: replayColumns,
		getCoreRowModel: getCoreRowModel(),
	});
	return (
		<table>
			<tbody>
				{table.getRowModel().rows.map((row) => (
					<tr key={row.id}>
						{row.getVisibleCells().map((cell) => (
							<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

describe('replayColumns', () => {
	test('renderiza método, URL e status', () => {
		const rows: ReplayRequestRow[] = [
			{
				id: 'r1',
				timestamp: 1700000000000,
				method: 'POST',
				url: 'https://api.example.com/users',
				status: 201,
				durationMs: 123,
			},
		];
		const { getByText } = render(<Harness rows={rows} />);
		expect(getByText('POST')).toBeInTheDocument();
		expect(getByText('https://api.example.com/users')).toBeInTheDocument();
		expect(getByText('201')).toBeInTheDocument();
	});

	test('mostra "—" para duração ausente sem fabricar valor', () => {
		const rows: ReplayRequestRow[] = [
			{
				id: 'r1',
				timestamp: 0,
				method: 'GET',
				url: 'https://x',
				status: 200,
			},
		];
		const { container } = render(<Harness rows={rows} />);
		expect(container.textContent).toContain('—');
	});
});
