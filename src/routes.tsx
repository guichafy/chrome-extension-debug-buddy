import React from 'react';
import { createHashRouter } from 'react-router-dom';
import Layout from './pages/Layout';
import Settings from './pages/Settings';
import Requests from './pages/Requests';
import Mocks from './pages/Mocks';

// Usamos HashRouter (via createHashRouter) em vez de BrowserRouter para extensões Chrome
// porque as extensões Chrome não suportam history API da mesma forma que aplicações web normais
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Settings />,
      },
      {
        path: 'requests',
        element: <Requests />,
      },
      {
        path: 'mocks',
        element: <Mocks />,
      },
    ],
  },
]);

export default router;
