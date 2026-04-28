import * as React from 'react';

export function useIsMobile() {
	const [isMobile, setIsMobile] = React.useState(false);

	React.useEffect(() => {
		const checkIsMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};

		// Verificar inicialmente
		checkIsMobile();

		// Adicionar listener para redimensionamento da janela
		window.addEventListener('resize', checkIsMobile);

		// Limpar listener ao desmontar
		return () => {
			window.removeEventListener('resize', checkIsMobile);
		};
	}, []);

	return isMobile;
}
