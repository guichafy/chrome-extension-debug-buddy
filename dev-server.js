const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DIST_DIR = path.join(__dirname, 'dist');

const server = http.createServer((req, res) => {
  // Obter o caminho do arquivo solicitado
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'main.html' : req.url);
  
  // Se o caminho não tiver extensão, assumimos que é uma rota do React Router
  // e servimos o arquivo main.html
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'main.html');
  }

  // Obter a extensão do arquivo
  const extname = String(path.extname(filePath)).toLowerCase();
  
  // Tipos MIME
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  // Tipo de conteúdo
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // Ler o arquivo
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Arquivo não encontrado
        fs.readFile(path.join(DIST_DIR, '404.html'), (err, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // Erro de servidor
        res.writeHead(500);
        res.end(`Erro de servidor: ${error.code}`);
      }
    } else {
      // Sucesso
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Pressione Ctrl+C para encerrar`);
});
