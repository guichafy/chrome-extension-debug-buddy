#!/bin/bash

# Limpar a pasta dist
rm -rf dist
mkdir -p dist

# Compilar arquivos TypeScript individualmente
npx tsc src/background.ts --outDir dist --target ES2020 --module none
npx tsc src/popup.ts --outDir dist --target ES2020 --module none

# Criar o arquivo main.js manualmente
echo '// Declarações para bibliotecas externas
declare const CodeMirror: any;
declare const prettier: {
  format: (content: string, options: {
    parser: string;
    printWidth: number;
    tabWidth: number;
    useTabs: boolean;
  }) => string;
};
' > dist/main_combined.ts
cat src/modules/urlPatterns.ts src/modules/responses.ts src/modules/mocks.ts src/modules/debugging.ts src/main.ts | grep -v "import" | grep -v "export" | grep -v "declare class" >> dist/main_combined.ts
npx tsc dist/main_combined.ts --outFile dist/main.js --target ES2020 --module none
rm dist/main_combined.ts

# Copiar arquivos estáticos
cp manifest.json dist/
cp -r images dist/
cp *.html dist/
cp styles.css dist/
cp -r lib dist/

echo "Build concluído com sucesso!"
