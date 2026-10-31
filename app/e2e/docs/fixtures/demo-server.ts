// Servidor da loja fictícia usada só para gerar as screenshots do README
// (`npm run docs:screenshots`). Fica isolado da fixture do E2E (porta 3100)
// para que mudanças aqui nunca afetem os specs de `e2e/tests`.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3200;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.get('/api/products', (_req, res) => {
	res.status(200).json({
		products: [
			{ id: 101, name: 'Mechanical Keyboard', price: 129.9, stock: 12 },
			{ id: 102, name: 'USB-C Dock', price: 89.0, stock: 4 },
			{ id: 103, name: '4K Monitor', price: 399.0, stock: 0 },
		],
	});
});

app.get('/api/profile', (req, res) => {
	res.status(200).json({
		id: 'u_42',
		name: 'Ada Lovelace',
		plan: 'pro',
		authorized: Boolean(req.headers.authorization),
	});
});

app.get('/api/cart', (_req, res) => {
	res.status(200).json({ items: [{ productId: 101, qty: 1 }], total: 129.9 });
});

app.get('/api/orders', (_req, res) => {
	res.status(200).json({ orders: [{ id: 'ord_9001', status: 'shipped', total: 218.9 }] });
});

app.get('/api/recommendations', (_req, res) => {
	res.status(500).json({ error: 'upstream timeout', service: 'recs' });
});

app.get('/api/promo/:code', (_req, res) => {
	res.status(404).json({ error: 'promo not found' });
});

app.get('/api/inventory', (_req, res) => {
	res.status(200).json({ warehouse: 'GRU-1', available: 37 });
});

app.post('/api/checkout', (_req, res) => {
	res.status(201).json({ orderId: 'ord_9002' });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
	console.log(`[docs fixture] Acme Store ouvindo em http://localhost:${PORT}`);
});
