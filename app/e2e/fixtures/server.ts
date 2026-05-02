import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 3100;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.get("/api/users", (_req, res) => {
	res.status(200).json({ users: [{ id: 1, name: "real-user" }] });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`[e2e fixture] servidor ouvindo em http://localhost:${PORT}`);
});
