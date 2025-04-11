# Publicação na Chrome Web Store

Este documento contém instruções para preparar e publicar a extensão na Chrome Web Store.

## Pré-requisitos

1. Conta de desenvolvedor na Chrome Web Store (taxa única de $5.00 USD)
2. Todos os ícones necessários gerados (veja abaixo)
3. Versão de produção compilada da extensão

## Preparação dos Ícones

Antes de publicar, certifique-se de que todos os ícones necessários foram gerados:

1. Execute o script `generate-icons.sh` para criar os ícones de 16px e 128px:
   ```bash
   ./generate-icons.sh
   ```

2. Verifique se todos os ícones estão presentes na pasta `images/`:
   - `icon_16px.png` (16x16 pixels)
   - `icon_32px.png` (32x32 pixels)
   - `icon_48px.png` (48x48 pixels)
   - `icon_64px.png` (64x64 pixels)
   - `icon_128px.png` (128x128 pixels)

## Compilação da Extensão

1. Compile a versão de produção da extensão:
   ```bash
   npm run build
   ```

2. Isso criará uma pasta `dist/` com todos os arquivos necessários para a extensão.

## Empacotamento para Upload

1. Crie um arquivo ZIP da pasta `dist/`:
   ```bash
   cd dist
   zip -r ../chrome-interceptor.zip *
   cd ..
   ```

2. O arquivo `chrome-interceptor.zip` será usado para upload na Chrome Web Store.

## Upload na Chrome Web Store

1. Acesse o [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Clique em "Novo item" ou "Add new item"
3. Faça upload do arquivo ZIP criado anteriormente
4. Preencha todas as informações necessárias:
   - Nome da extensão: "Network Request Interceptor"
   - Descrição curta: "Intercepte e modifique requisições de rede para desenvolvimento web"
   - Descrição detalhada: Forneça uma descrição completa das funcionalidades
   - Categoria: Desenvolvimento Web
   - Idiomas: Português (Brasil), Inglês
   - Screenshots: Adicione capturas de tela da extensão em uso
   - Vídeo promocional (opcional): Link para um vídeo demonstrativo no YouTube
   - Site da extensão: Link para o repositório GitHub
   - Política de privacidade: URL para sua política de privacidade

5. Envie para revisão

## Tempo de Revisão

A revisão da Chrome Web Store pode levar de algumas horas a alguns dias. Você receberá um e-mail quando a extensão for aprovada ou se houver algum problema a ser corrigido.

## Atualizações Futuras

Para atualizar a extensão:
1. Atualize o número da versão no `manifest.json`
2. Compile a nova versão
3. Crie um novo arquivo ZIP
4. Faça upload no Developer Dashboard como uma atualização

## Recursos Adicionais

- [Documentação da Chrome Web Store](https://developer.chrome.com/docs/webstore/)
- [Requisitos de qualidade para extensões](https://developer.chrome.com/docs/webstore/program-policies/)
