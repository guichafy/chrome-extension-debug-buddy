import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3100;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.get('/api/users', (_req, res) => {
	res.status(200).json({ users: [{ id: 1, name: 'real-user' }] });
});

// Echo: devolve cabeçalhos recebidos como JSON. Usado pelos specs Phase 8
// para verificar que requestModify realmente injetou headers na request real.
app.get('/api/echo', (req, res) => {
	res.status(200).json({ headers: req.headers });
});

// Counter: registra hits e expõe via GET. Permite ao spec requestMock
// confirmar que a request NÃO bateu na rede (counter permanece zero).
let counter = 0;
app.get('/api/counter', (_req, res) => {
	counter += 1;
	res.status(200).json({ count: counter });
});
app.get('/api/counter/value', (_req, res) => {
	res.status(200).json({ count: counter });
});
app.post('/api/counter/reset', (_req, res) => {
	counter = 0;
	res.status(200).json({ count: counter });
});

// Endpoint usado em chain specs (request adiciona header + response muda
// status). Devolve sempre 200 com o header recebido — a regra response
// reescreve para 503 em runtime.
app.get('/api/chain', (req, res) => {
	res
		.status(200)
		.set('content-type', 'application/json')
		.json({ receivedHeader: req.headers['x-injected'] ?? null });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
	console.log(`[e2e fixture] servidor ouvindo em http://localhost:${PORT}`);
});
