import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { useRules } from '@/hooks/useRules';
import { serializeRules, validateRuleImport } from '@/domain/rulesIO';
import type { Rule } from '@/types/rules';

export function RulesImportExport() {
	const { rules, addRule } = useRules();
	const [importPreview, setImportPreview] = useState<Rule[] | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');
	const fileInput = useRef<HTMLInputElement>(null);

	const handleExport = () => {
		const json = serializeRules(rules);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `debug-buddy-rules-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleFile = async (file: File) => {
		setImportError(null);
		setImportPreview(null);
		try {
			const text = await file.text();
			const parsed: unknown = JSON.parse(text);
			const result = validateRuleImport(parsed);
			if (!result.ok) {
				setImportError(result.error);
				return;
			}
			setImportPreview(result.rules);
		} catch (err) {
			setImportError(err instanceof Error ? err.message : 'JSON inválido');
		}
	};

	const handleConfirmImport = async () => {
		if (!importPreview) return;
		if (strategy === 'replace') {
			await chrome.storage.local.set({ rules: importPreview });
		} else {
			for (const rule of importPreview) {
				await addRule(rule.name, rule.matchers, rule.action);
			}
		}
		setImportPreview(null);
		if (fileInput.current) fileInput.current.value = '';
	};

	return (
		<Card className="panel">
			<CardHeader>
				<CardTitle>Exportar / Importar</CardTitle>
				<CardDescription>
					Exporte o conjunto de regras como JSON ou importe um arquivo previamente exportado.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={handleExport} className="gap-2">
						<LucideIcon name="download" className="h-4 w-4" />
						Exportar
					</Button>
					<Button variant="outline" onClick={() => fileInput.current?.click()} className="gap-2">
						<LucideIcon name="upload" className="h-4 w-4" />
						Importar
					</Button>
					<input
						ref={fileInput}
						type="file"
						accept="application/json"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) handleFile(f);
						}}
					/>
				</div>

				{importError && (
					<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						<LucideIcon name="alert-triangle" className="mr-2 inline h-4 w-4" />
						{importError}
					</div>
				)}

				{importPreview && (
					<div className="space-y-3 rounded-md border p-3">
						<h4 className="text-sm font-medium">
							{importPreview.length} regra(s) prontas para importar
						</h4>
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<label className="flex items-center gap-2">
								<input
									type="radio"
									checked={strategy === 'merge'}
									onChange={() => setStrategy('merge')}
									aria-label="Adicionar às regras existentes"
								/>
								Adicionar às regras existentes
							</label>
							<label className="flex items-center gap-2">
								<input
									type="radio"
									checked={strategy === 'replace'}
									onChange={() => setStrategy('replace')}
									aria-label="Substituir todas as regras"
								/>
								Substituir todas as regras
							</label>
						</div>
						<div className="flex gap-2">
							<Button onClick={handleConfirmImport}>Confirmar import</Button>
							<Button variant="outline" onClick={() => setImportPreview(null)}>
								Cancelar
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
