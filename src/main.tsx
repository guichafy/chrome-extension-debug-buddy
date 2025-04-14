import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './globals.css';
import './custom.css';
import router from './routes';
import { isDevEnvironment } from '@/utils/chromeAPI';

const MainApp: React.FC = () => {
  // Mostrar uma mensagem se estiver em ambiente de desenvolvimento
  if (isDevEnvironment()) {
    console.log('Executando em ambiente de desenvolvimento com APIs do Chrome mockadas');
  }

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
