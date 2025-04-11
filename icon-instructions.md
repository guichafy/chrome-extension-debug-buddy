# Instruções para Criação de Ícones Adicionais

Para publicar a extensão na Chrome Web Store, é necessário criar ícones adicionais que foram referenciados no `manifest.json`:

## Ícones Necessários

- `icon_16px.png` (16x16 pixels)
- `icon_128px.png` (128x128 pixels)

## Como Criar os Ícones

### Usando ImageMagick (Linha de Comando)

Se você tiver o ImageMagick instalado, execute os seguintes comandos:

```bash
# Criar ícone de 16x16 pixels
convert images/icon_32px.png -resize 16x16 images/icon_16px.png

# Criar ícone de 128x128 pixels
convert images/icon_64px.png -resize 128x128 images/icon_128px.png
```

### Usando um Editor de Imagens (Alternativa)

Se não tiver o ImageMagick, você pode usar qualquer editor de imagens (como GIMP, Photoshop, ou até mesmo ferramentas online) para:

1. Abrir o ícone existente (por exemplo, `icon_64px.png`)
2. Redimensionar para 16x16 e 128x128 pixels
3. Salvar como `icon_16px.png` e `icon_128px.png` na pasta `images/`

## Verificação

Após criar os ícones, verifique se eles estão na pasta `images/` e se têm os tamanhos corretos:

- `images/icon_16px.png` (16x16 pixels)
- `images/icon_32px.png` (32x32 pixels)
- `images/icon_48px.png` (48x48 pixels)
- `images/icon_64px.png` (64x64 pixels)
- `images/icon_128px.png` (128x128 pixels)

## Requisitos da Chrome Web Store

A Chrome Web Store requer pelo menos um ícone de 128x128 pixels. Os outros tamanhos são recomendados para melhor compatibilidade em diferentes contextos da interface do Chrome.
