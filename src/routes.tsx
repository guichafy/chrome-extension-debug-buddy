import React from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';
import Settings from './pages/Settings';
import Requests from './pages/Requests';
import Mocks from './pages/Mocks';
import ForceRemount from './components/ForceRemount';

// Componente de wrapper para forçar remontagem completa
const RouteWrapper = ({ Component }: { Component: React.ComponentType }) => {
  return (
    <ForceRemount>
      <Component />
    </ForceRemount>
  );
};

// Usamos HashRouter (via createHashRouter) em vez de BrowserRouter para extensões Chrome
// porque as extensões Chrome não suportam history API da mesma forma que aplicações web normais
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <RouteWrapper Component={Settings} />,
      },
      {
        path: 'settings',
        element: <Navigate to="/" replace />,
      },
      {
        path: 'requests',
        element: <RouteWrapper Component={Requests} />,
      },
      {
        path: 'mocks',
        element: <RouteWrapper Component={Mocks} />,
      },
      // Rota de fallback para redirecionar para a página inicial
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

export default router;
