import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface TabProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
  onTabChange?: (value: string) => void;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

// Contexto para compartilhar o estado das abas
const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
}>({
  activeTab: '',
  setActiveTab: () => {},
});

export const CustomTabs: React.FC<TabsProps> & {
  List: React.FC<TabsListProps>;
  Trigger: React.FC<TabsTriggerProps>;
  Content: React.FC<TabsContentProps>;
} = ({ defaultValue, children, className, onTabChange }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const location = useLocation();
  const isFirstRender = useRef(true);
  const previousPathname = useRef(location.pathname);

  // Resetar para o valor padrão quando a rota muda
  useEffect(() => {
    // Ignorar o primeiro render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Verificar se a rota realmente mudou
    if (previousPathname.current !== location.pathname) {
      previousPathname.current = location.pathname;
      setActiveTab(defaultValue);

      if (onTabChange) {
        onTabChange(defaultValue);
      }

      console.log('Rota mudou, resetando aba para:', defaultValue);
    }
  }, [location.pathname, defaultValue, onTabChange]);

  // Ouvir o evento personalizado de mudança de rota
  useEffect(() => {
    const handleRouteChange = () => {
      console.log('Evento de mudança de rota detectado, resetando aba para:', defaultValue);
      setActiveTab(defaultValue);

      if (onTabChange) {
        onTabChange(defaultValue);
      }
    };

    window.addEventListener('route-changed', handleRouteChange);

    return () => {
      window.removeEventListener('route-changed', handleRouteChange);
    };
  }, [defaultValue, onTabChange]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (onTabChange) {
      onTabChange(value);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={cn('custom-tabs', className)} data-active-tab={activeTab}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList: React.FC<TabsListProps> = ({ children, className }) => {
  return (
    <div className={cn('custom-tabs-list grid w-full grid-cols-2 mb-4', className)}>
      {children}
    </div>
  );
};

const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, className, onClick }) => {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);

  const handleClick = () => {
    setActiveTab(value);
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      className={cn(
        'custom-tabs-trigger inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        activeTab === value ? 'bg-background text-foreground shadow-sm' : 'bg-muted text-muted-foreground',
        className
      )}
      onClick={handleClick}
      data-state={activeTab === value ? 'active' : 'inactive'}
    >
      {children}
    </button>
  );
};

const TabsContent: React.FC<TabsContentProps> = ({ value, children, className }) => {
  const { activeTab } = React.useContext(TabsContext);

  if (activeTab !== value) {
    return null;
  }

  return (
    <div
      className={cn('custom-tabs-content mt-2', className)}
      data-state={activeTab === value ? 'active' : 'inactive'}
    >
      {children}
    </div>
  );
};

// Atribuir componentes filhos
CustomTabs.List = TabsList;
CustomTabs.Trigger = TabsTrigger;
CustomTabs.Content = TabsContent;

export default CustomTabs;
