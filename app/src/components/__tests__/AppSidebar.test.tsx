import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { AppSidebar } from '../layout/AppSidebar';

// Mock para o react-router-dom
vi.mock('react-router-dom', () => ({
	NavLink: ({ children }: any) => <a href="#">{children}</a>,
}));

// Mock para os componentes do shadcn-ui sidebar
vi.mock('@/components/ui/sidebar', () => ({
	Sidebar: ({ children, className }: any) => (
		<div data-testid="shadcn-sidebar" className={className}>
			{children}
		</div>
	),
	SidebarContent: ({ children }: any) => <div data-testid="sidebar-content">{children}</div>,
	SidebarHeader: ({ children }: any) => <div data-testid="sidebar-header">{children}</div>,
	SidebarFooter: ({ children }: any) => <div data-testid="sidebar-footer">{children}</div>,
	SidebarMenu: ({ children }: any) => <div data-testid="sidebar-menu">{children}</div>,
	SidebarMenuItem: ({ children }: any) => <div data-testid="sidebar-menu-item">{children}</div>,
	SidebarMenuButton: ({ children, asChild, className, size }: any) => (
		<div data-testid="sidebar-menu-button" className={className} data-size={size}>
			{children}
		</div>
	),
	SidebarMenuBadge: ({ children }: any) => <div data-testid="sidebar-menu-badge">{children}</div>,
	SidebarProvider: ({ children }: any) => <div data-testid="sidebar-provider">{children}</div>,
	SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>,
	useSidebar: () => ({ isMobile: false }),
}));

// Mock para o componente NavMain
vi.mock('../layout/NavMain', () => ({
	NavMain: ({ items }: any) => (
		<div data-testid="nav-main">
			{items.map((item: any) => (
				<div key={item.path} data-testid="nav-item">
					{item.title}
					{item.count > 0 && <span data-testid="nav-item-count">{item.count}</span>}
				</div>
			))}
		</div>
	),
}));

// Mock para os componentes lucide-react
vi.mock('lucide-react', () => ({
	ChevronsUpDown: () => <span data-testid="icon-chevrons-updown">ChevronsUpDown</span>,
	LogOut: () => <span data-testid="icon-logout">LogOut</span>,
	Settings: () => <span data-testid="icon-settings">Settings</span>,
	User: () => <span data-testid="icon-user">User</span>,
}));

// Mock para os componentes Avatar
vi.mock('@/components/ui/avatar', () => ({
	Avatar: ({ children, className }: any) => (
		<div data-testid="avatar" className={className}>
			{children}
		</div>
	),
	AvatarFallback: ({ children, className }: any) => (
		<div data-testid="avatar-fallback" className={className}>
			{children}
		</div>
	),
}));

// Mock para os componentes DropdownMenu
vi.mock('@/components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
	DropdownMenuTrigger: ({ children, asChild }: any) => (
		<div data-testid="dropdown-menu-trigger" data-asChild={asChild}>
			{children}
		</div>
	),
	DropdownMenuContent: ({ children, className, side, align, sideOffset }: any) => (
		<div
			data-testid="dropdown-menu-content"
			className={className}
			data-side={side}
			data-align={align}
			data-sideOffset={sideOffset}
		>
			{children}
		</div>
	),
	DropdownMenuLabel: ({ children, className }: any) => (
		<div data-testid="dropdown-menu-label" className={className}>
			{children}
		</div>
	),
	DropdownMenuGroup: ({ children }: any) => <div data-testid="dropdown-menu-group">{children}</div>,
	DropdownMenuItem: ({ children }: any) => <div data-testid="dropdown-menu-item">{children}</div>,
	DropdownMenuSeparator: () => <div data-testid="dropdown-menu-separator" />,
}));

describe('AppSidebar Component', () => {
	// Teste básico de renderização
	test('renderiza corretamente', () => {
		render(<AppSidebar />);

		// Verifica se o componente shadcn-sidebar está presente
		expect(screen.getByTestId('shadcn-sidebar')).toBeTruthy();

		// Verifica se o header e footer estão presentes
		expect(screen.getByTestId('sidebar-header')).toBeTruthy();
		expect(screen.getByTestId('sidebar-footer')).toBeTruthy();

		// Verifica se o componente NavMain está presente
		expect(screen.getByTestId('nav-main')).toBeTruthy();

		// Verifica se o título está presente
		expect(screen.getByText('Debug Buddy')).toBeTruthy();

		// Verifica se os labels da navegação estão presentes
		expect(screen.getByText('Command Center')).toBeInTheDocument();
		expect(screen.getByText('Rules Lab')).toBeInTheDocument();
		expect(screen.getByText('Sessões')).toBeInTheDocument();
	});

	// Teste para verificar se o SidebarFooter exibe informações do desenvolvedor
	test('renderiza o SidebarFooter com informações do desenvolvedor', () => {
		render(<AppSidebar />);

		// Verifica se a mensagem de autoria está presente
		expect(screen.getByText('Desenvolvido por')).toBeTruthy();
		expect(screen.getByText('Guilherme Chafy')).toBeTruthy();
	});

	// Itens do menu: Command Center, Rules Lab, Sessões, Privacidade.
	test('expõe Command Center, Rules Lab, Sessões e Privacidade no menu', () => {
		render(<AppSidebar />);

		const navItems = screen.getAllByTestId('nav-item');
		expect(navItems.length).toBe(4);
		expect(screen.queryByText('Pausadas')).not.toBeInTheDocument();
		expect(screen.getByText('Sessões')).toBeInTheDocument();
		expect(screen.getByText('Privacidade')).toBeInTheDocument();

		// Nenhum item de navegação carrega contador.
		const counts = screen.queryAllByTestId('nav-item-count');
		expect(counts.length).toBe(0);
	});
});
