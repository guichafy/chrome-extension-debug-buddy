import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarMenuBadge,
} from '@/components/ui/sidebar';

interface NavItem {
	title: string;
	path: string;
	icon: string;
	count?: number;
}

interface NavMainProps {
	items: NavItem[];
	className?: string;
}

export function NavMain({ items, className }: NavMainProps) {
	return (
		<div className={cn('py-2', className)}>
			<div className="px-3 py-2">
				<h2 className="mb-2 px-2 text-xs font-semibold tracking-tight">Principal</h2>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.path}>
							<SidebarMenuButton asChild>
								<NavLink
									to={item.path}
									className={({ isActive }) =>
										cn(
											'transition-colors',
											isActive ? 'text-primary font-medium' : 'text-foreground',
										)
									}
									end={item.path === '/'}
								>
									<Icon name={item.icon} className="mr-2" />
									<span>{item.title}</span>
									{item.count !== undefined && item.count > 0 && (
										<SidebarMenuBadge>{item.count}</SidebarMenuBadge>
									)}
								</NavLink>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</div>
		</div>
	);
}
