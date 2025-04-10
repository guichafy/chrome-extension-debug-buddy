import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NavMain } from '../NavMain';

// Mock para os componentes do shadcn-ui
jest.mock('@/components/ui/sidebar', () => ({
  SidebarGroup: ({ children, className }) => (
    <div data-testid="sidebar-group" className={className}>{children}</div>
  ),
  SidebarGroupLabel: ({ children }) => (
    <div data-testid="sidebar-group-label">{children}</div>
  ),
  SidebarMenu: ({ children }) => (
    <ul data-testid="sidebar-menu">{children}</ul>
  ),
  SidebarMenuItem: ({ children }) => (
    <li data-testid="sidebar-menu-item">{children}</li>
  ),
  SidebarMenuButton: ({ children, tooltip }) => (
    <button data-testid="sidebar-menu-button" data-tooltip={tooltip}>{children}</button>
  ),
  SidebarMenuBadge: ({ children }) => (
    <span data-testid="sidebar-menu-badge">{children}</span>
  ),
  SidebarMenuSub: ({ children }) => (
    <ul data-testid="sidebar-menu-sub">{children}</ul>
  ),
  SidebarMenuSubItem: ({ children }) => (
    <li data-testid="sidebar-menu-sub-item">{children}</li>
  ),
  SidebarMenuSubButton: ({ children, asChild }) => (
    <button data-testid="sidebar-menu-sub-button" data-as-child={asChild}>{children}</button>
  ),
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, asChild, defaultOpen, className }) => (
    <div
      data-testid="collapsible"
      data-as-child={asChild}
      data-default-open={defaultOpen}
      className={className}
    >
      {children}
    </div>
  ),
  CollapsibleTrigger: ({ children, asChild }) => (
    <div data-testid="collapsible-trigger" data-as-child={asChild}>{children}</div>
  ),
  CollapsibleContent: ({ children }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}));

jest.mock('lucide-react', () => ({
  ChevronRight: () => <span data-testid="chevron-right">→</span>,
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: ({ name, className }) => (
    <span data-testid="icon" data-name={name} className={className}>{name}</span>
  ),
}));

const mockItems = [
  {
    title: 'Configurações',
    path: '/',
    icon: 'settings',
    isActive: true,
    items: [
      {
        title: 'Geral',
        path: '/settings/general',
      },
      {
        title: 'Avançado',
        path: '/settings/advanced',
      },
    ],
  },
  {
    title: 'Requisições',
    path: '/requests',
    icon: 'list',
    count: 5,
    items: [
      {
        title: 'Histórico',
        path: '/requests/history',
      },
    ],
  },
];

describe('NavMain', () => {
  it('renders correctly with items', () => {
    render(
      <BrowserRouter>
        <NavMain items={mockItems} />
      </BrowserRouter>
    );

    // Verifica se o título do grupo está correto
    expect(screen.getByTestId('sidebar-group-label')).toHaveTextContent('Principal');

    // Verifica se os itens principais estão sendo renderizados
    expect(screen.getAllByTestId('sidebar-menu-item')).toHaveLength(2);

    // Verifica se o primeiro item tem o título correto
    expect(screen.getAllByTestId('sidebar-menu-button')[0]).toHaveTextContent('Configurações');

    // Verifica se o badge está sendo renderizado para o item com count
    expect(screen.getByTestId('sidebar-menu-badge')).toHaveTextContent('5');

    // Verifica se os subitens estão sendo renderizados
    expect(screen.getAllByTestId('sidebar-menu-sub-item')).toHaveLength(5); // 3 do primeiro item (Visualizar + 2 subitens) + 2 do segundo (Visualizar + 1 subitem)
  });

  it('renders with className prop', () => {
    render(
      <BrowserRouter>
        <NavMain items={mockItems} className="test-class" />
      </BrowserRouter>
    );

    expect(screen.getByTestId('sidebar-group')).toHaveClass('test-class');
  });
});
