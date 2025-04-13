import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Componente de ordem superior (HOC) que força a remontagem completa
 * do componente filho quando a rota muda.
 */
interface ForceRemountProps {
  children: React.ReactNode;
}

const ForceRemount: React.FC<ForceRemountProps> = ({ children }) => {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  
  // Atualizar a key quando a rota muda para forçar remontagem
  useEffect(() => {
    setKey(location.pathname + Date.now());
    
    // Emitir um evento de remontagem forçada
    const event = new CustomEvent('force-remount', {
      detail: { pathname: location.pathname }
    });
    window.dispatchEvent(event);
    
    console.log('ForceRemount: Forçando remontagem para rota:', location.pathname);
  }, [location.pathname]);
  
  return (
    <React.Fragment key={key}>
      {children}
    </React.Fragment>
  );
};

export default ForceRemount;
