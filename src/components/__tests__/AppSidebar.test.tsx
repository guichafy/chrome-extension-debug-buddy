import React from 'react';
import { render, screen } from '@testing-library/react';
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
  SidebarMenuButton: ({ children, asChild, className }) => <div data-testid="sidebar-menu-button" className={className}>{children}</div>,
  SidebarMenuBadge: ({ children }) => <div data-testid="sidebar-menu-badge">{children}</div>,
  SidebarProvider: ({ children }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle</button>
}));

// Mock para o componente NavMain
jest.mock('../NavMain', () => ({
  NavMain: ({ items }) => (
    <div data-testid="nav-main">
      {items.map((item) => (
        <div key={item.path} data-testid="nav-item" data-has-subitems={!!item.items}>
          {item.title}
          {item.count > 0 && <span data-testid="nav-item-count">{item.count}</span>}
          {item.items && (
            <div data-testid="nav-item-subitems">
              {item.items.map((subItem, idx) => (
                <div key={idx} data-testid="nav-subitem">{subItem.title}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
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

  // Teste para verificar se os contadores são passados corretamente para o NavMain
  test('passa os contadores corretamente para o NavMain', () => {
    render(
      <AppSidebar pendingResponsesCount={5} mocksCount={3} />
    );

    // Verifica se os itens de navegação estão presentes
    const navItems = screen.getAllByTestId('nav-item');
    expect(navItems.length).toBe(3); // Configurações, Requisições, Mocks

    // Verifica se os contadores estão presentes
    const counts = screen.getAllByTestId('nav-item-count');
    expect(counts.length).toBe(2); // Deve haver dois contadores (um para requisições e outro para mocks)

    // Verifica se os valores dos contadores estão corretos
    expect(counts[0].textContent).toBe('5'); // Requisições
    expect(counts[1].textContent).toBe('3'); // Mocks
  });

  // Teste para verificar se os subitens estão sendo passados corretamente
  test('passa os subitens corretamente para o NavMain', () => {
    render(
      <AppSidebar pendingResponsesCount={0} mocksCount={0} />
    );

    // Verifica se todos os itens têm subitens
    const navItems = screen.getAllByTestId('nav-item');
    navItems.forEach(item => {
      expect(item).toHaveAttribute('data-has-subitems', 'true');
    });

    // Verifica se os containers de subitens estão presentes
    const subitemContainers = screen.getAllByTestId('nav-item-subitems');
    expect(subitemContainers.length).toBe(3); // Um para cada item principal

    // Verifica se os subitens estão presentes
    const subitems = screen.getAllByTestId('nav-subitem');
    expect(subitems.length).toBe(6); // 2 para Configurações + 2 para Requisições + 2 para Mocks
  });
});
