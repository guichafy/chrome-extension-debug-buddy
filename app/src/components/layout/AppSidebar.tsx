import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import type { LucideIconName } from '@/components/ui/lucide-icon';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
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
	const { t } = useTranslation('layout');
	const navItems: Array<{ title: string; path: string; icon: LucideIconName; count: number }> = [
		{ title: t('nav.commandCenter'), path: '/command-center', icon: 'layout', count: 0 },
		{ title: t('nav.rulesLab'), path: '/rules-lab', icon: 'flask', count: 0 },
		{ title: t('nav.sessions'), path: '/sessions', icon: 'film', count: 0 },
		{ title: t('nav.privacy'), path: '/settings/privacy', icon: 'shield', count: 0 },
	];

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
							<NavLink to="/">
								<img src="/images/icon_32px.png" alt={t('sidebar.logoAlt')} className="h-5 w-5" />
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
					<SidebarMenuItem className="px-3 pt-2">
						<LanguageSwitcher />
					</SidebarMenuItem>
					<SidebarMenuItem>
						<div className="flex flex-col items-start px-3 py-2">
							<span className="text-xs text-muted-foreground">{t('sidebar.developedBy')}</span>
							<a
								href="https://github.com/guichafy/chrome-extension-debug-buddy"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm font-semibold hover:underline text-primary"
							>
								Guilherme Chafy
							</a>
							<span className="text-xs text-muted-foreground">{t('sidebar.copyright')}</span>
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
