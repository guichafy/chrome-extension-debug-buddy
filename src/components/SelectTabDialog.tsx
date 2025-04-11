import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from './ui/dialog';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface Tab {
  id?: number;
  title: string;
  url: string;
}

interface SelectTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTab: (tabId: number, tabTitle: string, tabUrl: string) => void;
}

const SelectTabDialog: React.FC<SelectTabDialogProps> = ({
  open,
  onOpenChange,
  onSelectTab
}) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      // Buscar abas disponíveis quando o modal for aberto
      chrome.tabs.query({ currentWindow: true }, (allTabs) => {
        // Filtrar a aba atual (interceptor)
        const filteredTabs = allTabs.filter(tab => {
          return tab.url &&
                 !tab.url.includes('chrome://') &&
                 !tab.url.includes('chrome-extension://');
        }).map(tab => ({
          id: tab.id,
          title: tab.title || 'Sem título',
          url: tab.url || ''
        }));

        setTabs(filteredTabs);
        setLoading(false);
      });
    }
  }, [open]);

  const handleSelectTab = (tab: Tab) => {
    if (tab.id) {
      onSelectTab(tab.id, tab.title, tab.url);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl w-[90vw] max-h-[80vh] overflow-hidden" style={{ width: '90vw', maxWidth: '600px', overflowX: 'hidden', maxHeight: '80vh' }}>
        <DialogHeader>
          <DialogTitle>Selecione a aba para interceptar</DialogTitle>
          <DialogDescription>
            Escolha a aba que deseja monitorar as requisições
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 w-full" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', maxHeight: 'calc(80vh - 100px)' }}>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tabs.length === 0 ? (
            <div className="p-4 border rounded bg-muted text-center">
              Nenhuma aba disponível para interceptação
            </div>
          ) : (
            <div className="border rounded bg-card overflow-hidden" style={{ width: '100%', maxWidth: '100%', height: '300px' }}>
              <ScrollArea className="h-[300px]" style={{ width: '100%' }}>
                <div className="w-full" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                  {tabs.map((tab, index) => (
                    <div
                      key={index}
                      className="p-3 border-b last:border-b-0 hover:bg-accent cursor-pointer transition-colors w-full"
                      onClick={() => handleSelectTab(tab)}
                      style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
                    >
                      <div className="flex items-center w-full" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                        <div className="flex-1 min-w-0 overflow-hidden" style={{ maxWidth: 'calc(100% - 50px)', width: 'calc(100% - 50px)', overflow: 'hidden' }}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="font-medium truncate" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{tab.title}</div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start" className="max-w-[300px] break-words">
                                {tab.title}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-sm text-muted-foreground truncate" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{tab.url}</div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="start" className="max-w-[300px] break-words">
                                {tab.url}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Button variant="ghost" size="icon" className="flex-shrink-0 ml-2" style={{ flexShrink: 0, width: '32px', minWidth: '32px' }}>
                          <Icon name="arrow_forward" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelectTabDialog;
