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
    <div className={cn("py-2", className)}>
      <div className="px-3 py-2">
        <h2 className="mb-2 px-2 text-xs font-semibold tracking-tight">
          Principal
        </h2>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(
                    isActive && "text-primary font-medium"
                  )}
                  // Adicionar replace e state para forçar remontagem completa
                  replace
                  state={{ timestamp: Date.now() }}
                  onClick={(e) => {
                    // Verificar se a aba "Histórico" está ativa
                    if (document.body.classList.contains('history-tab-active')) {
                      // Forçar um hard reload da página
                      e.preventDefault();

                      // Emitir um evento para notificar outros componentes
                      const event = new CustomEvent('history-tab-navigation', {
                        detail: { path: item.path }
                      });
                      window.dispatchEvent(event);

                      // Usar setTimeout para dar tempo aos componentes de reagirem
                      setTimeout(() => {
                        window.location.hash = item.path;
                        window.location.reload();
                      }, 50);
                    }
                  }}
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
