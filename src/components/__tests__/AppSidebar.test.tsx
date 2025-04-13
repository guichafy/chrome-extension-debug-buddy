import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { AppSidebar } from '../AppSidebar';

// Mock para o react-router-dom
jest.mock('react-router-dom', () => ({
  NavLink: ({ children }) => (
    <a href="#">
      {children}
    </a>
  )
}));

// Mock para os componentes do shadcn-ui sidebar
jest.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children, className }) => <div data-testid="shadcn-sidebar" className={className}>{children}</div>,
  SidebarContent: ({ children }) => <div data-testid="sidebar-content">{children}</div>,
  SidebarHeader: ({ children }) => <div data-testid="sidebar-header">{children}</div>,
  SidebarFooter: ({ children }) => <div data-testid="sidebar-footer">{children}</div>,
  SidebarMenu: ({ children }) => <div data-testid="sidebar-menu">{children}</div>,
  SidebarMenuItem: ({ children }) => <div data-testid="sidebar-menu-item">{children}</div>,
  SidebarMenuButton: ({ children, asChild, className, size }) => <div data-testid="sidebar-menu-button" className={className} data-size={size}>{children}</div>,
  SidebarMenuBadge: ({ children }) => <div data-testid="sidebar-menu-badge">{children}</div>,
  SidebarProvider: ({ children }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>,
  useSidebar: () => ({ isMobile: false })
}));

// Mock para o componente NavMain
jest.mock('../NavMain', () => ({
  NavMain: ({ items }) => (
    <div data-testid="nav-main">
      {items.map((item) => (
        <div key={item.path} data-testid="nav-item">
          {item.title}
          {item.count > 0 && <span data-testid="nav-item-count">{item.count}</span>}
        </div>
      ))}
    </div>
  )
}));

// Mock para os componentes lucide-react
jest.mock('lucide-react', () => ({
  ChevronsUpDown: () => <span data-testid="icon-chevrons-updown">ChevronsUpDown</span>,
  LogOut: () => <span data-testid="icon-logout">LogOut</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  User: () => <span data-testid="icon-user">User</span>
}));

// Mock para os componentes Avatar
jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }) => <div data-testid="avatar" className={className}>{children}</div>,
  AvatarFallback: ({ children, className }) => <div data-testid="avatar-fallback" className={className}>{children}</div>
}));

// Mock para os componentes DropdownMenu
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }) => <div data-testid="dropdown-menu-trigger" data-asChild={asChild}>{children}</div>,
  DropdownMenuContent: ({ children, className, side, align, sideOffset }) => (
    <div data-testid="dropdown-menu-content" className={className} data-side={side} data-align={align} data-sideOffset={sideOffset}>{children}</div>
  ),
  DropdownMenuLabel: ({ children, className }) => <div data-testid="dropdown-menu-label" className={className}>{children}</div>,
  DropdownMenuGroup: ({ children }) => <div data-testid="dropdown-menu-group">{children}</div>,
  DropdownMenuItem: ({ children }) => <div data-testid="dropdown-menu-item">{children}</div>,
  DropdownMenuSeparator: () => <div data-testid="dropdown-menu-separator" />
}));

describe('AppSidebar Component', () => {
  // Teste básico de renderização
  test('renderiza corretamente', () => {
    render(
      <AppSidebar pendingResponsesCount={0} mocksCount={0} />
    );

    // Verifica se o componente shadcn-sidebar está presente
    expect(screen.getByTestId('shadcn-sidebar')).toBeTruthy();

    // Verifica se o header e footer estão presentes
    expect(screen.getByTestId('sidebar-header')).toBeTruthy();
    expect(screen.getByTestId('sidebar-footer')).toBeTruthy();

    // Verifica se o componente NavMain está presente
    expect(screen.getByTestId('nav-main')).toBeTruthy();

    // Verifica se o título está presente
    expect(screen.getByText('Network Interceptor')).toBeTruthy();
  });

  // Teste para verificar se o SidebarFooter está sendo renderizado corretamente
  test('renderiza o SidebarFooter com o dropdown menu', () => {
    render(
      <AppSidebar pendingResponsesCount={0} mocksCount={0} />
    );

    // Verifica se o dropdown menu está presente
    expect(screen.getByTestId('dropdown-menu')).toBeTruthy();

    // Verifica se os avatares estão presentes
    expect(screen.getAllByTestId('avatar').length).toBe(2);

    // Verifica se o texto do usuário está presente
    expect(screen.getAllByText('Usuário').length).toBe(2);
    expect(screen.getAllByText('Desenvolvedor').length).toBe(2);

    // Verifica se os ícones estão presentes
    expect(screen.getAllByTestId('icon-user').length).toBe(2);
    expect(screen.getAllByTestId('icon-chevrons-updown').length).toBe(1);
    expect(screen.getAllByTestId('icon-settings').length).toBe(1);
    expect(screen.getAllByTestId('icon-logout').length).toBe(1);

    // Verifica se os itens do dropdown menu estão presentes
    // Verifica se há pelo menos um item de menu com o texto 'Configurações' dentro do dropdown
    const dropdownContent = screen.getByTestId('dropdown-menu-content');
    expect(within(dropdownContent).getByText('Configurações')).toBeTruthy();
    expect(within(dropdownContent).getByText('Sair')).toBeTruthy();
  });

  // Teste para verificar se os contadores são passados corretamente para o NavMain
  test('passa os contadores corretamente para o NavMain', () => {
    render(
      <AppSidebar pendingResponsesCount={5} mocksCount={3} />
    );

    // Verifica se os itens de navegação estão presentes
    const navItems = screen.getAllByTestId('nav-item');
    expect(navItems.length).toBe(3); // Configurações, Requisições, Mocks

    // Verifica se apenas o contador de mocks está presente (o de requisições foi removido)
    const counts = screen.getAllByTestId('nav-item-count');
    expect(counts.length).toBe(1); // Deve haver apenas um contador (para mocks)

    // Verifica se o valor do contador está correto
    expect(counts[0].textContent).toBe('3'); // Mocks
  });
});
