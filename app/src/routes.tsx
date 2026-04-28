import React from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';
import CommandCenter from './pages/CommandCenter';
import RulesLab from './pages/RulesLab';

const router = createHashRouter([
	{
		path: '/',
		element: <Layout />,
		children: [
			{ index: true, element: <Navigate to="/command-center" replace /> },
			{ path: 'command-center', element: <CommandCenter /> },
			{ path: 'rules-lab', element: <RulesLab /> },
			{ path: 'request-history', element: <Navigate to="/command-center" replace /> },
			{ path: 'requests', element: <Navigate to="/command-center" replace /> },
		],
	},
]);

export default router;
