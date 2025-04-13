import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface SiteHeaderProps {
  targetTab: {
    id: number | null;
    title: string;
    url: string;
  };
  isDebugging: boolean;
  pendingResponsesCount: number;
  onSelectTabClick: () => void;
  onStartDebugging: () => void;
  onStopDebugging: () => void;
}

export function SiteHeader({
  targetTab,
  isDebugging,
  pendingResponsesCount,
  onSelectTabClick,
  onStartDebugging,
  onStopDebugging
}: SiteHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-6"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => navigate('/requests')}
                >
                  {/* <img src="images/icon_64px.png" alt="Logo" className="w-6 h-6" /> */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${isDebugging
                        ? pendingResponsesCount > 0
                          ? 'status-indicator-blinking'
                          : 'bg-green-500'
                        : 'bg-gray-400'}`}
                    ></span>
                    <h1 className="text-base font-medium">
                      {pendingResponsesCount > 0
                        ? `${pendingResponsesCount} ${pendingResponsesCount === 1 ? 'requisição' : 'requisições'} aguardando`
                        : 'Nenhuma requisição interceptada'}
                    </h1>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-sm">
                  {pendingResponsesCount > 0
                    ? `${pendingResponsesCount} requisição(ões) interceptada(s) aguardando ação`
                    : 'Nenhuma requisição interceptada'}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={`flex items-center gap-2 max-w-[200px] ${targetTab.id ? 'text-black' : 'text-black'}`}
                  onClick={onSelectTabClick}
                >
                  <Icon name="tab" className="flex-shrink-0" />
                  <span className="truncate">
                    {targetTab.id ? targetTab.title : 'Selecionar Aba'}
                  </span>
                </Button>
              </TooltipTrigger>
              {targetTab.id && (
                <TooltipContent side="bottom" className="max-w-[300px] break-words">
                  <div>
                    <div className="font-medium">{targetTab.title}</div>
                    <div className="text-xs text-muted-foreground">{targetTab.url}</div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {!isDebugging ? (
            <Button
              variant="default"
              className="flex items-center gap-2"
              onClick={onStartDebugging}
            >
              <Icon name="play_arrow" />
              <span className="hidden sm:inline">Iniciar Interceptação</span>
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={onStopDebugging}
            >
              <Icon name="stop" />
              <span className="hidden sm:inline">Parar Interceptação</span>
            </Button>
          )}

          {/* <div className="flex items-center gap-2 ml-2">
            <span className="hidden sm:inline">{isDebugging ? 'Ativo' : 'Inativo'}</span>
          </div> */}
        </div>
      </div>
    </header>
  );
}
