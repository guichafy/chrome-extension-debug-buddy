import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './globals.css';
import router from './routes';

const MainApp: React.FC = () => {
	return <RouterProvider router={router} />;
};

// Inicializar a aplicação React
document.addEventListener('DOMContentLoaded', () => {
	// Criar o container para o React
	const container = document.createElement('div');
	container.id = 'root';
	document.body.appendChild(container);

	// Renderizar o componente React
	const root = ReactDOM.createRoot(container);
	root.render(<MainApp />);
});
