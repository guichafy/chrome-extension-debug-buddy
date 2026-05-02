import { LucideIcon } from '@/components/ui/lucide-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getActionVisuals } from '@/components/rules-lab/ruleVisuals';
import { TEMPLATE_GROUPS, TEMPLATES } from '@/domain/ruleTemplates';
import type { RuleTemplateId } from '@/domain/ruleTemplates';

interface PresetWelcomeProps {
	onSelectBlank: () => void;
	onSelectPreset: (templateId: RuleTemplateId) => void;
}

export function PresetWelcome({ onSelectBlank, onSelectPreset }: PresetWelcomeProps) {
	return (
		<ScrollArea className="min-h-0 flex-1 pr-2">
			<div className="space-y-3 pb-1">
				<button
					type="button"
					onClick={onSelectBlank}
					className="group flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
					data-testid="preset-blank"
				>
					<div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
						<LucideIcon name="plus" className="h-4 w-4" />
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium">Começar do zero</div>
						<p className="text-xs text-muted-foreground">
							Configure manualmente o matcher e a ação.
						</p>
					</div>
					<LucideIcon
						name="arrow-right"
						className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
					/>
				</button>

				<div className="flex items-baseline justify-between gap-2 pt-1">
					<h3 className="text-sm font-medium">Usar template</h3>
					<p className="text-xs text-muted-foreground">
						Pré-preenche o wizard. Você ainda pode editar antes de salvar.
					</p>
				</div>

				{TEMPLATE_GROUPS.map((group) => (
					<section key={group.id} data-testid={`template-group-${group.id}`}>
						<div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							{group.label}
						</div>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{group.templates.map((templateId) => {
								const template = TEMPLATES[templateId];
								const visuals = getActionVisuals(template.action);
								return (
									<button
										key={templateId}
										type="button"
										onClick={() => onSelectPreset(templateId)}
										className="group flex items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
										data-testid={`preset-${templateId}`}
									>
										<div
											className={cn(
												'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
												visuals.bgClass,
												visuals.textClass,
											)}
										>
											<LucideIcon name={visuals.iconName} className="h-4 w-4" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="truncate text-sm font-medium">{template.name}</div>
											<p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
												{template.description}
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
