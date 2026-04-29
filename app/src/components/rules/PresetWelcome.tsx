import { LucideIcon } from '@/components/ui/lucide-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PRESET_GROUPS, getPresetVisuals } from '@/components/rules-lab/rulePresetGroups';
import { PRESETS } from '@/domain/rulePresets';
import type { RulePresetId } from '@/types/rules';

interface PresetWelcomeProps {
	onSelectBlank: () => void;
	onSelectPreset: (presetId: RulePresetId) => void;
}

export function PresetWelcome({ onSelectBlank, onSelectPreset }: PresetWelcomeProps) {
	return (
		<ScrollArea className="flex-1 pr-2">
			<div className="space-y-4 pb-2">
				<button
					type="button"
					onClick={onSelectBlank}
					className="group flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
					data-testid="preset-blank"
				>
					<div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
						<LucideIcon name="plus" className="h-4 w-4" />
					</div>
					<div className="flex-1">
						<div className="text-sm font-medium">Começar em branco</div>
						<p className="text-xs text-muted-foreground">Configure manualmente match e ação.</p>
					</div>
					<LucideIcon
						name="arrow-right"
						className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
					/>
				</button>

				{PRESET_GROUPS.map((group) => (
					<section key={group.id}>
						<div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							{group.label}
						</div>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{group.presets.map((presetId) => {
								const preset = PRESETS[presetId];
								const visuals = getPresetVisuals(presetId);
								return (
									<button
										key={presetId}
										type="button"
										onClick={() => onSelectPreset(presetId)}
										className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
										data-testid={`preset-${presetId}`}
									>
										<div
											className={cn(
												'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
												visuals.bgClass,
												visuals.textClass,
											)}
										>
											<LucideIcon name={visuals.iconName} className="h-4 w-4" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="truncate text-sm font-medium">{preset.name}</div>
											<p className="text-xs leading-snug text-muted-foreground">
												{preset.description}
											</p>
										</div>
									</button>
								);
							})}
						</div>
					</section>
				))}
			</div>
		</ScrollArea>
	);
}

export default PresetWelcome;
