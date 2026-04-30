import { render, screen, fireEvent } from '@testing-library/react';
import { SiteHeader } from '../layout/SiteHeader';
import type { SessionMarker } from '@/types/sessionMarker';

const emptyMarker: SessionMarker = {
	sessionStartedAt: null,
	currentPageUrl: null,
	currentPageNavigatedAt: null,
};

vi.mock('../ui/separator', () => ({
	Separator: ({ orientation, className }: any) => (
		<div data-testid="separator" data-orientation={orientation} className={className} />
	),
}));

vi.mock('../ui/sidebar', () => ({
	SidebarTrigger: ({ className }: any) => (
		<button data-testid="sidebar-trigger" className={className}>
			Toggle
		</button>
	),
}));

vi.mock('../ui/button', () => ({
	Button: ({ children, onClick, variant, size, className, disabled }: any) => (
		<button
			data-testid="button"
			data-variant={variant}
			data-size={size}
			className={className}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</button>
	),
}));

vi.mock('../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<svg data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

vi.mock('../ui/tooltip', () => ({
	Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
	TooltipTrigger: ({ asChild, children }: any) => (
		<div data-testid="tooltip-trigger">{children}</div>
	),
	TooltipContent: ({ side, children }: any) => (
		<div data-testid="tooltip-content" data-side={side}>
			{children}
		</div>
	),
	TooltipProvider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
}));

vi.mock('../layout/NetworkMetricsBar', () => ({
	NetworkMetricsBar: () => <div data-testid="network-metrics-bar" />,
}));

const emptyAggregate = {
	totalRequests: 0,
	totalBytes: null,
	avgTtfbMs: null,
	slowCount: 0,
	failedCount: 0,
};

describe('SiteHeader Component', () => {
	const mockProps = {
		targetTab: { id: 123, title: 'Test Tab', url: 'https://example.com', closed: false },
		isDebugging: false,
		onSelectTabClick: vi.fn(),
		onStartDebugging: vi.fn(),
		onStopDebugging: vi.fn(),
		metrics: { session: emptyAggregate, currentPage: emptyAggregate },
		sessionMarker: emptyMarker,
	};

	test('renderiza corretamente', () => {
		render(<SiteHeader {...mockProps} />);

		expect(screen.getByTestId('sidebar-trigger')).toBeTruthy();
		expect(screen.getByTestId('separator')).toBeTruthy();

		const tabButtons = screen.getAllByText('Test Tab');
		expect(tabButtons.length).toBeGreaterThan(0);

		expect(screen.getByText('Iniciar Interceptação')).toBeTruthy();
	});

	test('chama onSelectTabClick quando o botão de selecionar aba é clicado', () => {
		render(<SiteHeader {...mockProps} />);

		const buttons = screen.getAllByRole('button');
		const selectTabButton = buttons.find(
			(button) =>
				button.textContent!.includes('Test Tab') &&
				!button.textContent!.includes('Iniciar') &&
				!button.textContent!.includes('Parar'),
		);

		fireEvent.click(selectTabButton!);

		expect(mockProps.onSelectTabClick).toHaveBeenCalledTimes(1);
	});

	test('chama onStartDebugging quando o botão de iniciar interceptação é clicado', () => {
		render(<SiteHeader {...mockProps} />);

		const startButton = screen.getByText('Iniciar Interceptação').closest('button');
		fireEvent.click(startButton!);

		expect(mockProps.onStartDebugging).toHaveBeenCalledTimes(1);
	});

	test('exibe o botão de parar interceptação quando isDebugging é true', () => {
		render(<SiteHeader {...{ ...mockProps, isDebugging: true }} />);

		expect(screen.getByText('Parar Interceptação')).toBeTruthy();
		expect(screen.queryByText('Iniciar Interceptação')).toBeNull();
	});

	test('não exibe mais o status de requisições interceptadas no header', () => {
		render(<SiteHeader {...{ ...mockProps, isDebugging: true }} />);
		expect(screen.queryByText(/aguardando/i)).toBeNull();
		expect(screen.queryByText('Nenhuma requisição interceptada')).toBeNull();
	});

	it('renderiza o ícone de aba como SVG (não texto Material Icons)', () => {
		render(
			<SiteHeader
				targetTab={{ id: 1, title: 'Tab', url: 'https://example.com', closed: false }}
				isDebugging={false}
				onSelectTabClick={vi.fn()}
				onStartDebugging={vi.fn()}
				onStopDebugging={vi.fn()}
				metrics={{ session: emptyAggregate, currentPage: emptyAggregate }}
				sessionMarker={emptyMarker}
			/>,
		);
		const tabButton = screen.getByRole('button', { name: /Tab/i });
		expect(tabButton.querySelector('svg')).not.toBeNull();
		expect(tabButton.textContent).not.toContain('tab');
	});

	test('exibe estado de aba indisponível quando closed=true', () => {
		const onSelectTabClick = vi.fn();
		const onStartDebugging = vi.fn();
		render(
			<SiteHeader
				targetTab={{ id: null, title: 'Aba Antiga', url: 'https://old.example.com', closed: true }}
				isDebugging={false}
				onSelectTabClick={onSelectTabClick}
				onStartDebugging={onStartDebugging}
				onStopDebugging={vi.fn()}
				metrics={{ session: emptyAggregate, currentPage: emptyAggregate }}
				sessionMarker={emptyMarker}
			/>,
		);

		// Deve mostrar o aviso e ícone de alerta no botão de seleção.
		expect(screen.getByText(/aba indispon[ií]vel/i)).toBeTruthy();
		const alertIcon = document.querySelector('[data-name="alert-triangle"]');
		expect(alertIcon).not.toBeNull();

		// Botão "Iniciar Interceptação" deve ficar desabilitado para evitar
		// tentativa de attach numa aba que já foi fechada.
		const startButton = screen.getByText('Iniciar Interceptação').closest('button');
		expect(startButton).not.toBeNull();
		expect((startButton as HTMLButtonElement).disabled).toBe(true);

		// Clicar no botão de seleção dispara o handler para abrir o modal.
		fireEvent.click(screen.getByText(/aba indispon[ií]vel/i).closest('button')!);
		expect(onSelectTabClick).toHaveBeenCalledTimes(1);
		expect(onStartDebugging).not.toHaveBeenCalled();
	});

	test('quando nenhuma aba foi selecionada, botão Iniciar fica desabilitado', () => {
		render(
			<SiteHeader
				{...{
					...mockProps,
					targetTab: { id: null, title: '', url: '', closed: false },
				}}
			/>,
		);

		const startButton = screen.getByText('Iniciar Interceptação').closest('button');
		expect((startButton as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByText('Selecionar Aba')).toBeTruthy();
	});
});
