import { lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';

const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const RulesLab = lazy(() => import('./pages/RulesLab'));
const PendingResponses = lazy(() => import('./pages/PendingResponses'));

const router = createHashRouter([
	{
		path: '/',
		element: <Layout />,
		children: [
			{ index: true, element: <Navigate to="/command-center" replace /> },
			{ path: 'command-center', element: <CommandCenter /> },
			{ path: 'rules-lab', element: <RulesLab /> },
			{ path: 'pending', element: <PendingResponses /> },
			{ path: 'request-history', element: <Navigate to="/command-center" replace /> },
			{ path: 'requests', element: <Navigate to="/command-center" replace /> },
		],
	},
]);

export default router;
