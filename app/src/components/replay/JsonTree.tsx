import { useState } from 'react';

interface Props {
	value: unknown;
	name?: string;
	depth?: number;
}

export function JsonTree({ value, name, depth = 0 }: Props) {
	const [open, setOpen] = useState(depth < 2);
	const indent = { paddingLeft: `${depth * 12}px` };

	if (value === null) {
		return (
			<div style={indent} className="font-mono text-xs">
				{name !== undefined && <span className="text-muted-foreground">{name}: </span>}
				<span className="text-purple-600">null</span>
			</div>
		);
	}
	const t = typeof value;
	if (t !== 'object') {
		const color =
			t === 'string' ? 'text-emerald-700' : t === 'number' ? 'text-sky-700' : 'text-amber-700';
		return (
			<div style={indent} className="font-mono text-xs">
				{name !== undefined && <span className="text-muted-foreground">{name}: </span>}
				<span className={color}>{t === 'string' ? `"${String(value)}"` : String(value)}</span>
			</div>
		);
	}
	const isArray = Array.isArray(value);
	const entries = isArray
		? (value as unknown[]).map((v, i) => [i, v] as const)
		: Object.entries(value as Record<string, unknown>);

	return (
		<div style={indent} className="font-mono text-xs">
			<button
				type="button"
				className="cursor-pointer text-muted-foreground"
				onClick={() => setOpen((o) => !o)}
			>
				{open ? '▼' : '▶'}
			</button>{' '}
			{name !== undefined && <span className="text-muted-foreground">{name}: </span>}
			<span>{isArray ? `Array(${entries.length})` : `Object(${entries.length})`}</span>
			{open &&
				entries.map(([k, v]) => (
					<JsonTree key={String(k)} name={String(k)} value={v} depth={depth + 1} />
				))}
		</div>
	);
}
