import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Settings, User } from 'lucide-react';
import { Icon } from '@/ui/components/shadcn/icon';
import { NavMain } from '@/ui/components/NavMain';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	useSidebar,
} from '@/ui/components/shadcn/sidebar';
import { Avatar, AvatarFallback } from '@/ui/components/shadcn/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/ui/components/shadcn/dropdown-menu';

// Dados de navegação
const navItems = [
	{
		title: 'Histórico',
		path: '/request-history',
		icon: 'history',
		count: 0,
	},
	{
		title: 'Configurações',
		path: '/',
		icon: 'settings',
	},
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	pendingResponsesCount: number;
	mocksCount?: number; // Opcional agora que não usamos mais
}

export function AppSidebar({ pendingResponsesCount, mocksCount, ...props }: AppSidebarProps) {
	const { isMobile } = useSidebar();

	// Atualizar contadores
	const items = React.useMemo(() => {
		return navItems.map((item) => {
			// Não mostrar contador para requisições no sidebar, pois já está no header
			if (item.path === '/requests') {
				return { ...item, count: 0 };
			}
			return item;
		});
	}, []);

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
							<NavLink to="/">
								<img src="/images/icon_32px.png" alt="Logo" className="h-5 w-5" />
								<span className="text-base font-semibold">Debug Buddy</span>
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
					{/* <SidebarMenuItem>
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
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
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
          </SidebarMenuItem> */}
					<SidebarMenuItem>
						<div className="flex flex-col items-start px-3 py-2">
							<span className="text-xs text-muted-foreground">Desenvolvido por</span>
							<a
								href="https://github.com/guichafy/chrome-extension-debug-buddy"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm font-semibold hover:underline text-primary"
							>
								Guilherme Chafy
							</a>
							<span className="text-xs text-muted-foreground">
								© 2025 - Todos os direitos reservados
							</span>
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
