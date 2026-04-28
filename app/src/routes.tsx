import React from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';
import Settings from './pages/Settings';
import RequestHistory from './pages/RequestHistory';

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
				element: <Navigate to="/request-history?view=pending" replace />,
			},
			{
				path: 'request-history',
				element: <RequestHistory />,
			},
		],
	},
]);

export default router;
