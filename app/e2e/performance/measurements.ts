import { expect, type Page, type Locator } from '@playwright/test';

export interface InteractionSample {
	action: string;
	ms: number;
}

export function distribution(values: number[]) {
	if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0)) {
		throw new Error('Medição ausente ou inválida');
	}
	const ordered = [...values].sort((a, b) => a - b);
	return {
		count: ordered.length,
		p50: ordered[Math.ceil(ordered.length * 0.5) - 1],
		p95: ordered[Math.ceil(ordered.length * 0.95) - 1],
		max: ordered[ordered.length - 1],
	};
}

// Entrada real -> conteúdo visível -> frame seguinte. O auto-wait do runner
// não entra no orçamento. Timeout próprio preserva artifacts se o feedback sumir.
export async function interact(
	page: Page,
	trigger: Locator,
	feedbackSelector: string,
	feedbackText?: string,
) {
	await page.evaluate(
		({ selector, text }) => {
			(window as any).__interaction = new Promise<number>((resolve, reject) => {
				document.addEventListener(
					'pointerdown',
					() => {
						const start = performance.now();
						const deadline = start + 5000;
						const check = () => {
							if (performance.now() > deadline) {
								reject(new Error(`Feedback não apareceu: ${selector}`));
								return;
							}
							const element = document.querySelector(selector);
							if (
								element &&
								element.getBoundingClientRect().height > 0 &&
								(text === undefined || element.textContent?.includes(text))
							) {
								requestAnimationFrame(() => resolve(performance.now() - start));
							} else requestAnimationFrame(check);
						};
						requestAnimationFrame(check);
					},
					{ once: true, capture: true },
				);
			});
		},
		{ selector: feedbackSelector, text: feedbackText },
	);
	await trigger.click();
	return page.evaluate<number>(() => (window as any).__interaction);
}

export function assertInteractionBudgets(samples: InteractionSample[], live: boolean) {
	if (samples.length === 0) throw new Error('Nenhuma interação medida');
	const groups = new Map<string, InteractionSample[]>();
	for (const sample of samples) {
		const group = groups.get(sample.action);
		if (group) group.push(sample);
		else groups.set(sample.action, [sample]);
	}
	for (const [action, group] of groups) {
		const summary = distribution(group.map((sample) => sample.ms));
		expect(summary.p95, `${action} p95`).toBeLessThan(live ? 500 : 250);
		expect(summary.max, `${action} máximo`).toBeLessThan(live ? 1000 : 500);
	}
}
