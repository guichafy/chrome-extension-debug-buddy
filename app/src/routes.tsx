import { lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';

const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const RulesLab = lazy(() => import('./pages/RulesLab'));

const router = createHashRouter([
	{
		path: '/',
		element: <Layout />,
		children: [
			{ index: true, element: <Navigate to="/command-center" replace /> },
			{ path: 'command-center', element: <CommandCenter /> },
			{ path: 'rules-lab', element: <RulesLab /> },
			// Rota legada: a tela /pending foi removida; bookmarks antigos caem no
			// Command Center com o filtro state:pending pré-aplicado.
			{
				path: 'pending',
				element: <Navigate to="/command-center?filter=state:pending" replace />,
			},
			{ path: 'request-history', element: <Navigate to="/command-center" replace /> },
			{ path: 'requests', element: <Navigate to="/command-center" replace /> },
		],
	},
]);

export default router;
