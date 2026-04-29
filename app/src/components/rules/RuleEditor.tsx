import React, { useEffect, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createPresetRule } from '@/domain/rulePresets';
import { Action, Matcher, Rule, RulePresetId } from '@/types/rules';
import { ActionEditor } from './ActionEditor';
import { MatcherEditor } from './MatcherEditor';
import { PresetWelcome } from './PresetWelcome';

interface RuleEditorProps {
	open: boolean;
	mode: 'create' | 'edit';
	rule?: Rule;
	onOpenChange: (open: boolean) => void;
	onSave: (rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
}

type EditorView = 'welcome' | 'editor';

const DEFAULT_MATCHERS: Matcher[] = [
	{ type: 'url', enabled: true, pattern: '', isRegex: false },
	{ type: 'method', enabled: true, method: 'ANY' },
];

const DEFAULT_ACTION: Action = {
	type: 'mock',
	enabled: true,
	status: 200,
	headers: {},
};

const RuleEditor: React.FC<RuleEditorProps> = ({ open, mode, rule, onOpenChange, onSave }) => {
	const [view, setView] = useState<EditorView>(mode === 'edit' ? 'editor' : 'welcome');
	const [cameFromWelcome, setCameFromWelcome] = useState(false);
	const [name, setName] = useState(rule?.name || 'Nova Regra');
	const [matchers, setMatchers] = useState<Matcher[]>(rule?.matchers ?? DEFAULT_MATCHERS);
	const [action, setAction] = useState<Action>(rule?.action ?? DEFAULT_ACTION);
	const [enabled, setEnabled] = useState(rule?.enabled !== false);
	const [activeTab, setActiveTab] = useState<'match' | 'then'>('match');
	const [isSaving, setIsSaving] = useState(false);

	const restoreBodyPointerEvents = () => {
		document.body.style.pointerEvents = '';
	};

	const handleOpenChange = (newOpen: boolean) => {
		onOpenChange(newOpen);
		if (!newOpen) {
			restoreBodyPointerEvents();
			requestAnimationFrame(restoreBodyPointerEvents);
			setTimeout(restoreBodyPointerEvents, 50);
			setTimeout(restoreBodyPointerEvents, 200);
			setTimeout(restoreBodyPointerEvents, 500);
		}
	};

	useEffect(() => {
		const reset = () => {
			document.body.style.pointerEvents = '';
		};
		if (!open) {
			reset();
			const t1 = setTimeout(reset, 50);
			const t2 = setTimeout(reset, 200);
			const t3 = setTimeout(reset, 500);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
				clearTimeout(t3);
			};
		}
		return reset;
	}, [open]);

	useEffect(() => {
		if (!open) return;
		if (mode === 'edit' && rule) {
			setName(rule.name);
			setMatchers(rule.matchers);
			setAction(rule.action);
			setEnabled(rule.enabled);
			setView('editor');
			setCameFromWelcome(false);
			setActiveTab('match');
			return;
		}
		if (mode === 'create') {
			setName('Nova Regra');
			setMatchers(DEFAULT_MATCHERS);
			setAction(DEFAULT_ACTION);
			setEnabled(true);
			setView('welcome');
			setCameFromWelcome(false);
			setActiveTab('match');
		}
	}, [open, mode, rule]);

	const applyPresetDraft = (presetId: RulePresetId) => {
		const draft = createPresetRule(presetId);
		const matchersForEditing = draft.matchers.map((m) =>
			m.type === 'url' ? { ...m, enabled: true } : m,
		);
		setName(draft.name);
		setMatchers(matchersForEditing);
		setAction(draft.action);
		setEnabled(draft.enabled);
		setActiveTab('match');
		setCameFromWelcome(true);
		setView('editor');
	};

	const startBlank = () => {
		setName('Nova Regra');
		setMatchers(DEFAULT_MATCHERS);
		setAction(DEFAULT_ACTION);
		setEnabled(true);
		setActiveTab('match');
		setCameFromWelcome(true);
		setView('editor');
	};

	const goBackToWelcome = () => {
		setView('welcome');
	};

	const addMatcher = (type: Matcher['type']) => {
		let newMatcher: Matcher;
		switch (type) {
			case 'url':
				newMatcher = { type: 'url', enabled: true, pattern: '', isRegex: false };
				break;
			case 'method':
				newMatcher = { type: 'method', enabled: true, method: 'ANY' };
				break;
			case 'header':
				newMatcher = {
					type: 'header',
					enabled: true,
					name: '',
					value: '',
					headerType: 'request',
				};
				break;
			case 'body':
				newMatcher = { type: 'body', enabled: true, pattern: '', isRegex: false };
				break;
			default:
				return;
		}
		setMatchers([...matchers, newMatcher]);
	};

	const removeMatcher = (index: number) => {
		const newMatchers = [...matchers];
		newMatchers.splice(index, 1);
		setMatchers(newMatchers);
	};

	const updateMatcher = (index: number, updatedMatcher: Matcher) => {
		const newMatchers = [...matchers];
		newMatchers[index] = updatedMatcher;
		setMatchers(newMatchers);
	};

	const handleSave = async () => {
		if (!name.trim()) {
			alert('Por favor, insira um nome para a regra');
			return;
		}

		const enabledUrlMatcher = matchers.find((m) => m.type === 'url' && m.enabled);
		if (!enabledUrlMatcher) {
			alert('A regra precisa de um matcher de URL habilitado');
			return;
		}
		if (enabledUrlMatcher.type === 'url' && enabledUrlMatcher.pattern.trim().length === 0) {
			alert('Preencha o padrão da URL antes de salvar');
			return;
		}

		setIsSaving(true);
		try {
			const success = await onSave({
				name: name.trim(),
				enabled,
				matchers,
				action,
			});
			if (success) {
				handleOpenChange(false);
			}
		} finally {
			setIsSaving(false);
		}
	};

	const isWelcome = view === 'welcome';
	const showBackToWelcome = view === 'editor' && cameFromWelcome && mode === 'create';

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="flex max-h-[90vh] flex-col sm:max-w-2xl md:max-w-3xl"
				onCloseAutoFocus={(e) => {
					e.preventDefault();
					restoreBodyPointerEvents();
				}}
			>
				<DialogHeader>
					{showBackToWelcome && (
						<button
							type="button"
							onClick={goBackToWelcome}
							className="mb-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
						>
							<LucideIcon name="arrow-left" className="h-3 w-3" />
							Voltar
						</button>
					)}
					<DialogTitle>
						{mode === 'edit' ? 'Editar Regra' : isWelcome ? 'Nova regra' : 'Configurar regra'}
					</DialogTitle>
					<DialogDescription>
						{mode === 'edit'
							? 'Modifique os detalhes da regra de interceptação.'
							: isWelcome
								? 'Comece de um preset ou em branco.'
								: 'Configure uma nova regra de interceptação.'}
					</DialogDescription>
				</DialogHeader>

				{isWelcome ? (
					<PresetWelcome onSelectBlank={startBlank} onSelectPreset={applyPresetDraft} />
				) : (
					<>
						<ScrollArea className="flex-1 overflow-y-auto pr-4">
							<div className="mb-4">
								<Label htmlFor="ruleName">Nome da Regra</Label>
								<Input
									id="ruleName"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Ex: API de Login"
									className="w-full"
								/>
							</div>

							<Tabs
								value={activeTab}
								onValueChange={(value) => setActiveTab(value as 'match' | 'then')}
							>
								<TabsList className="mb-4 w-full">
									<TabsTrigger value="match" className="flex-1">
										Match
									</TabsTrigger>
									<TabsTrigger value="then" className="flex-1">
										Then
									</TabsTrigger>
								</TabsList>

								<TabsContent value="match" className="space-y-4">
									<div className="rounded-lg bg-muted p-4">
										<h3 className="mb-2 text-lg font-medium">Condições de Match</h3>
										<p className="mb-4 text-sm text-muted-foreground">
											Defina as condições para que esta regra seja aplicada a uma requisição.
										</p>

										{matchers.map((matcher, index) => (
											<div
												key={`${matcher.type}-${index}`}
												className="mb-4 rounded-lg border bg-card p-3"
											>
												<MatcherEditor
													matcher={matcher}
													onChange={(updatedMatcher) => updateMatcher(index, updatedMatcher)}
													onRemove={() => removeMatcher(index)}
													canRemove={matchers.length > 1}
												/>
											</div>
										))}

										<div className="mt-4">
											<Button
												type="button"
												variant="outline"
												onClick={() => addMatcher('url')}
												className="mr-2"
											>
												<LucideIcon name="plus" className="mr-1 h-4 w-4" />
												URL
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={() => addMatcher('method')}
												className="mr-2"
											>
												<LucideIcon name="plus" className="mr-1 h-4 w-4" />
												Método
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={() => addMatcher('header')}
												className="mr-2"
											>
												<LucideIcon name="plus" className="mr-1 h-4 w-4" />
												Header
											</Button>
											<Button type="button" variant="outline" onClick={() => addMatcher('body')}>
												<LucideIcon name="plus" className="mr-1 h-4 w-4" />
												Body
											</Button>
										</div>
									</div>
								</TabsContent>

								<TabsContent value="then" className="space-y-4">
									<div className="rounded-lg bg-muted p-4">
										<h3 className="mb-2 text-lg font-medium">Ação</h3>
										<p className="mb-4 text-sm text-muted-foreground">
											Defina a ação a ser executada quando a requisição corresponder às condições de
											match.
										</p>

										<ActionEditor action={action} onChange={setAction} />
									</div>
								</TabsContent>
							</Tabs>

							<div className="mt-4 flex items-center space-x-2">
								<Checkbox
									id="rule-enabled"
									checked={enabled}
									onCheckedChange={(checked) => setEnabled(checked === true)}
								/>
								<Label htmlFor="rule-enabled">Regra ativa</Label>
							</div>
						</ScrollArea>

						<DialogFooter className="mt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => handleOpenChange(false)}
								disabled={isSaving}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								onClick={handleSave}
								disabled={isSaving}
								className="primary-button flex items-center gap-2"
							>
								{isSaving ? (
									<LucideIcon name="refresh" className="h-4 w-4 animate-spin" />
								) : (
									<LucideIcon name={mode === 'create' ? 'plus' : 'save'} className="h-4 w-4" />
								)}
								{mode === 'create' ? 'Adicionar' : 'Salvar'}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default RuleEditor;
