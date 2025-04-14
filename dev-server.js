const http = require('http');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const webpack = require('webpack');
const webpackConfig = require('./webpack.config.js');

const PORT = 8080;
const DIST_DIR = path.join(__dirname, 'dist');

// Configurar o ambiente para desenvolvimento
process.env.NODE_ENV = 'development';

// Função para criar o arquivo last-update.json para hot-reload da extensão
function updateLastUpdateFile() {
  const updateInfo = {
    timestamp: Date.now(),
    message: 'Files updated'
  };

  fs.writeFileSync(
    path.join(DIST_DIR, 'last-update.json'),
    JSON.stringify(updateInfo),
    'utf-8'
  );

  console.log('📝 Arquivo last-update.json atualizado para hot-reload');
}

// Iniciar o webpack em modo watch
const compiler = webpack(webpackConfig);
let webpackWatcher = null;

function startWebpackWatch() {
  console.log('🔄 Iniciando webpack em modo watch...');

  webpackWatcher = compiler.watch(
    {
      aggregateTimeout: 300,
      poll: undefined,
      ignored: /node_modules/
    },
    (err, stats) => {
      if (err) {
        console.error('❌ Erro no webpack:', err);
        return;
      }

      const info = stats.toJson();

      if (stats.hasErrors()) {
        console.error('❌ Erros de compilação:');
        info.errors.forEach(error => console.error(error));
      }

      if (stats.hasWarnings()) {
        console.warn('⚠️ Avisos de compilação:');
        info.warnings.forEach(warning => console.warn(warning));
      }

      console.log(`✅ Compilação concluída em ${info.time}ms`);
      updateLastUpdateFile();
    }
  );
}

// Iniciar o servidor HTTP
const server = http.createServer((req, res) => {
  // Adicionar CORS headers para desenvolvimento
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Lidar com requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

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
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.woff2': 'application/font-woff2',
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
          if (err) {
            // Se 404.html não existir, enviar uma resposta 404 simples
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - Página não encontrada</h1>', 'utf-8');
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        // Erro de servidor
        res.writeHead(500);
        res.end(`Erro de servidor: ${error.code}`);
        console.error(`Erro ao servir ${filePath}:`, error);
      }
    } else {
      // Sucesso
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Iniciar o servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📂 Servindo arquivos de ${DIST_DIR}`);
  console.log(`🔍 Pressione Ctrl+C para encerrar`);

  // Iniciar webpack watch após o servidor estar rodando
  startWebpackWatch();

  // Configurar watcher para arquivos estáticos
  const staticWatcher = chokidar.watch([
    'main.html',
    '404.html',
    'styles.css',
    'manifest.json',
    'images/**/*',
    'lib/**/*'
  ], {
    ignored: /(^|[\/\\])\../, // ignorar arquivos ocultos
    persistent: true,
    ignoreInitial: true // Ignorar eventos iniciais para evitar loop
  });

  staticWatcher.on('change', (filePath) => {
    console.log(`📄 Arquivo estático alterado: ${filePath}`);
    updateLastUpdateFile();
  });

  console.log('👀 Observando arquivos estáticos para hot-reload');
});

// Lidar com encerramento do processo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor e webpack watch...');

  if (webpackWatcher) {
    webpackWatcher.close(() => {
      console.log('🔄 Webpack watch encerrado');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
