import React from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIconName } from '@/components/ui/lucide-icon';
import { NavMain } from '@/components/layout/NavMain';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
} from '@/components/ui/sidebar';

type AppSidebarProps = React.ComponentProps<typeof Sidebar>;

export function AppSidebar({ ...props }: AppSidebarProps) {
	const navItems: Array<{ title: string; path: string; icon: LucideIconName; count: number }> = [
		{ title: 'Command Center', path: '/command-center', icon: 'layout', count: 0 },
		{ title: 'Rules Lab', path: '/rules-lab', icon: 'flask', count: 0 },
	];

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
				<NavMain items={navItems} />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
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
