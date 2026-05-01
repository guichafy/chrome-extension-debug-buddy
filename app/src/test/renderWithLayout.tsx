import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '@/pages/Layout';

interface RenderWithLayoutOptions {
	initialEntries?: string[];
	// Mapa rota → elemento. Permite o teste declarar quais rotas existem
	// e o que cada uma renderiza (geralmente a página real ou um stub).
	routes: Array<{ path: string; element: React.ReactNode }>;
}

export function renderWithLayout(options: RenderWithLayoutOptions): RenderResult {
	const { initialEntries = ['/'], routes } = options;
	return render(
		<MemoryRouter initialEntries={initialEntries}>
			<Routes>
				<Route element={<Layout />}>
					{routes.map(({ path, element }) => (
						<Route key={path} path={path} element={element} />
					))}
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}
