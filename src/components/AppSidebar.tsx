import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/ui/icon';
import { NavMain } from '@/components/NavMain';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

// Dados de navegação
const navItems = [
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
    count: 0, // Será atualizado dinamicamente
    items: [
      {
        title: 'Histórico',
        path: '/requests/history',
      },
      {
        title: 'Favoritos',
        path: '/requests/favorites',
      },
    ],
  },
  {
    title: 'Mocks',
    path: '/mocks',
    icon: 'build',
    count: 0, // Será atualizado dinamicamente
    items: [
      {
        title: 'Criar Mock',
        path: '/mocks/create',
      },
      {
        title: 'Gerenciar',
        path: '/mocks/manage',
      },
    ],
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  pendingResponsesCount: number;
  mocksCount: number;
}

export function AppSidebar({
  pendingResponsesCount,
  mocksCount,
  ...props
}: AppSidebarProps) {
  // Atualizar contadores e verificar rotas ativas
  const items = React.useMemo(() => {
    return navItems.map(item => {
      let updatedItem = { ...item };

      if (item.path === '/requests') {
        updatedItem.count = pendingResponsesCount;
      }
      if (item.path === '/mocks') {
        updatedItem.count = mocksCount;
      }

      return updatedItem;
    });
  }, [pendingResponsesCount, mocksCount]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <NavLink to="/">
                <Icon name="code" className="h-5 w-5" />
                <span className="text-base font-semibold">Network Interceptor</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <Icon name="person" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Usuário</p>
              <p className="text-xs text-muted-foreground">Desenvolvedor</p>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
