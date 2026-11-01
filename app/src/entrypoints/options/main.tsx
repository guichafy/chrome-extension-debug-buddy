import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@/styles/globals.css';
import { initUiI18n } from '@/i18n/ui';
import router from '@/routes';

const MainApp: React.FC = () => {
	return <RouterProvider router={router} />;
};

// O idioma precisa estar resolvido (e o catálogo carregado) antes do primeiro
// render — começa já no carregamento do módulo, em paralelo ao parse do DOM.
const i18nReady = initUiI18n();

// Inicializar a aplicação React
document.addEventListener('DOMContentLoaded', () => {
	// Criar o container para o React
	const container = document.createElement('div');
	container.id = 'root';
	document.body.appendChild(container);

	// Renderizar o componente React
	const root = ReactDOM.createRoot(container);
	i18nReady.then(
		() => root.render(<MainApp />),
		(err: unknown) => {
			// Sem catálogo não há UI: mostra o erro em vez de uma tela em branco.
			container.textContent = `Debug Buddy: falha ao carregar traduções / failed to load translations — ${
				err instanceof Error ? err.message : String(err)
			}`;
			throw err;
		},
	);
});
