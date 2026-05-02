import type { DetectionPhase } from '@/lib/session/types';

interface Props {
	phases: DetectionPhase[];
}

export function PhaseList({ phases }: Props) {
	return (
		<div className="flex flex-col gap-2">
			<h2 className="font-semibold text-sm">Environment Phases ({phases.length})</h2>
			{phases.map((p, i) => (
				<div key={p.id} className="rounded border p-2 text-xs">
					<div className="font-medium">
						Fase {i + 1} — {p.fingerprint.framework.name}
						{p.fingerprint.framework.version && ` v${p.fingerprint.framework.version}`}
					</div>
					<div className="text-muted-foreground">
						{p.pages.length} {p.pages.length === 1 ? 'URL' : 'URLs'}
					</div>
					{p.fingerprint.dataFetching.length > 0 && (
						<div className="mt-1 flex flex-wrap gap-1">
							{p.fingerprint.dataFetching.map((lib) => (
								<span
									key={lib.name}
									className="rounded bg-slate-100 px-1 text-[10px]"
									title={
										lib.treatment === 'detection-only'
											? 'Detectada, sem tratamento dedicado nesta versão'
											: 'Tratada'
									}
								>
									{lib.name}
									{lib.treatment === 'detection-only' && ' (detection-only)'}
								</span>
							))}
						</div>
					)}
				</div>
			))}
		</div>
	);
}
