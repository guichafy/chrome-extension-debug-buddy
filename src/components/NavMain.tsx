import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
  path: string;
  icon: string;
  count?: number;
  isActive?: boolean;
  items?: {
    title: string;
    path: string;
  }[];
}

interface NavMainProps {
  items: NavItem[];
  className?: string;
}

export function NavMain({ items, className }: NavMainProps) {
  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel>Principal</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title}>
                  <Icon name={item.icon} className="mr-2" />
                  <span>{item.title}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                  )}
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) => cn(
                          isActive && "text-primary font-medium"
                        )}
                      >
                        <span>Visualizar</span>
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild>
                        <NavLink to={subItem.path}>
                          <span>{subItem.title}</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
