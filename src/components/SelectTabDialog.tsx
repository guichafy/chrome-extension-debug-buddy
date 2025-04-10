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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecione a aba para interceptar</DialogTitle>
          <DialogDescription>
            Escolha a aba que deseja monitorar as requisições
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tabs.length === 0 ? (
            <div className="p-4 border rounded bg-muted text-center">
              Nenhuma aba disponível para interceptação
            </div>
          ) : (
            <div className="border rounded bg-card overflow-hidden max-h-[300px] overflow-y-auto">
              {tabs.map((tab, index) => (
                <div 
                  key={index} 
                  className="p-3 border-b last:border-b-0 hover:bg-accent cursor-pointer transition-colors flex items-center"
                  onClick={() => handleSelectTab(tab)}
                >
                  <div className="flex-1 overflow-hidden">
                    <div className="font-medium truncate">{tab.title}</div>
                    <div className="text-sm text-muted-foreground truncate">{tab.url}</div>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-2">
                    <Icon name="arrow_forward" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelectTabDialog;
