import * as React from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildSuggestions, type FilterSuggestion } from '@/lib/filterSuggestions';
import type { Filter } from '@/types/filters';
import type { InterceptedResponse } from '@/types/intercepted';
import { FilterChip } from './FilterChip';

interface FilterBarProps {
	filters: Filter[];
	onFiltersChange: (filters: Filter[]) => void;
	requests: Record<string, InterceptedResponse>;
}

export function FilterBar({ filters, onFiltersChange, requests }: FilterBarProps) {
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [draft, setDraft] = React.useState('');
	const [open, setOpen] = React.useState(false);

	// Recomputa sugestões apenas quando o popover está aberto. Sem essa guarda,
	// rajadas de interceptação (`requests` muda muitas vezes/s) reconstruiriam
	// a lista de facets em background, mesmo o usuário não estando vendo.
	const suggestions = React.useMemo<FilterSuggestion[]>(
		() => (open ? buildSuggestions(draft, Object.values(requests)) : []),
		[draft, open, requests],
	);

	const focusInput = React.useCallback(() => {
		inputRef.current?.focus();
	}, []);

	const acceptSuggestion = React.useCallback(
		(suggestion: FilterSuggestion) => {
			// Sugestões "abre prefixo" (value vazio) só preenchem o draft sem criar chip,
			// permitindo ao usuário escolher um valor concreto.
			if (suggestion.apply.value === '' && suggestion.apply.field !== 'free') {
				setDraft(`${suggestion.apply.field}:`);
				setOpen(true);
				queueMicrotask(focusInput);
				return;
			}

			const newFilter: Filter = { id: crypto.randomUUID(), ...suggestion.apply };
			onFiltersChange([...filters, newFilter]);
			setDraft('');
			setOpen(false);
		},
		[filters, focusInput, onFiltersChange],
	);

	const removeFilter = React.useCallback(
		(id: string) => {
			onFiltersChange(filters.filter((f) => f.id !== id));
		},
		[filters, onFiltersChange],
	);

	const clearAll = React.useCallback(() => {
		onFiltersChange([]);
		setDraft('');
		focusInput();
	}, [focusInput, onFiltersChange]);

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setDraft(event.target.value);
		setOpen(true);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Backspace' && draft === '' && filters.length > 0) {
			event.preventDefault();
			const last = filters[filters.length - 1];
			if (last) removeFilter(last.id);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			const first = suggestions[0];
			if (first) acceptSuggestion(first);
			return;
		}
		if (event.key === 'Escape') {
			setOpen(false);
		}
	};

	const hasFilters = filters.length > 0;

	return (
		<div className="flex w-full flex-col gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverAnchor asChild>
					<div
						className={cn(
							'group relative flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm shadow-xs transition-colors',
							'focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
							hasFilters && 'border-primary/40',
						)}
						onClick={focusInput}
					>
						<LucideIcon
							name="filter"
							className={cn(
								'h-4 w-4 shrink-0 transition-colors',
								hasFilters ? 'text-primary' : 'text-muted-foreground',
							)}
						/>
						{filters.map((filter) => (
							<FilterChip key={filter.id} filter={filter} onRemove={removeFilter} />
						))}
						<input
							ref={inputRef}
							type="text"
							value={draft}
							onChange={handleInputChange}
							onFocus={() => setOpen(true)}
							onKeyDown={handleKeyDown}
							placeholder={
								hasFilters
									? 'Adicionar filtro…'
									: 'Filtrar por method:, status:, state: ou texto livre'
							}
							className="min-w-[12ch] flex-1 bg-transparent px-1 py-0.5 outline-hidden placeholder:text-muted-foreground"
						/>
						{hasFilters && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									clearAll();
								}}
								className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
							>
								Limpar
							</Button>
						)}
					</div>
				</PopoverAnchor>
				<PopoverContent
					align="start"
					sideOffset={6}
					className="w-[min(640px,calc(100vw-2rem))] p-0"
					onOpenAutoFocus={(event) => event.preventDefault()}
				>
					<Command shouldFilter={false}>
						<CommandList>
							{suggestions.length === 0 ? (
								<div className="px-3 py-6 text-center text-sm text-muted-foreground">
									Nenhuma sugestão para «{draft}»
								</div>
							) : (
								<CommandGroup heading={draft.length === 0 ? 'Sugestões' : 'Resultados'}>
									{suggestions.map((suggestion) => (
										<CommandItem
											key={suggestion.id}
											value={suggestion.id}
											onSelect={() => acceptSuggestion(suggestion)}
											className="flex items-center justify-between gap-3"
										>
											<span className="font-mono text-xs">{suggestion.display}</span>
											<span className="text-xs text-muted-foreground">{suggestion.hint}</span>
										</CommandItem>
									))}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{hasFilters && (
				<p className="text-xs text-muted-foreground">
					{filters.length} filtro{filters.length === 1 ? '' : 's'} ativo
					{filters.length === 1 ? '' : 's'} · campos diferentes combinam por <strong>E</strong>
					{'; '}mesmo campo combina por <strong>OU</strong>.
				</p>
			)}
		</div>
	);
}
