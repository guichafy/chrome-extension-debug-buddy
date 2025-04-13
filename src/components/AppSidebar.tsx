import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Settings, User } from 'lucide-react';
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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Dados de navegação
const navItems = [
  {
    title: 'Requisições',
    path: '/requests',
    icon: 'list',
    count: 0, // Será atualizado dinamicamente
  },
  {
    title: 'Configurações',
    path: '/',
    icon: 'settings',
  },
  {
    title: 'Mocks',
    path: '/mocks',
    icon: 'build',
    count: 0, // Será atualizado dinamicamente
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
  const { isMobile } = useSidebar();

  // Atualizar contadores
  const items = React.useMemo(() => {
    return navItems.map(item => {
      // Não mostrar contador para requisições no sidebar, pois já está no header
      if (item.path === '/requests') {
        return { ...item, count: 0 };
      }
      if (item.path === '/mocks') {
        return { ...item, count: mocksCount };
      }
      return item;
    });
  }, [mocksCount]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <NavLink
                to="/"
                replace
                state={{ timestamp: Date.now() }}
              >
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
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Usuário</span>
                    <span className="truncate text-xs text-muted-foreground">Desenvolvedor</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Usuário</span>
                      <span className="truncate text-xs text-muted-foreground">Desenvolvedor</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
