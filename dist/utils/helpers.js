"use strict";
/**
 * Utilitários e funções auxiliares para o interceptor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHeaders = parseHeaders;
exports.detectContentType = detectContentType;
exports.getCodeMirrorMode = getCodeMirrorMode;
/**
 * Converte texto de headers em um objeto
 */
function parseHeaders(headersText) {
    const headers = {};
    const lines = headersText.split('\n');
    lines.forEach(line => {
        line = line.trim();
        if (!line)
            return;
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            headers[key] = value;
        }
    });
    return headers;
}
/**
 * Detecta o tipo de conteúdo com base no texto
 */
function detectContentType(content) {
    content = content.trim();
    // Tentar detectar JSON
    if ((content.startsWith('{') && content.endsWith('}')) ||
        (content.startsWith('[') && content.endsWith(']'))) {
        try {
            JSON.parse(content);
            return 'json';
        }
        catch (e) {
            // Não é JSON válido
        }
    }
    // Tentar detectar HTML
    if ((content.startsWith('<') && content.endsWith('>')) ||
        content.includes('<!DOCTYPE html>') ||
        content.includes('<html') ||
        content.includes('<body') ||
        content.includes('<div')) {
        return 'html';
    }
    // Padrão para texto
    return 'text';
}
/**
 * Obtém o modo correto para o CodeMirror
 */
function getCodeMirrorMode(type) {
    switch (type) {
        case 'json':
            return { name: 'javascript', json: true };
        case 'html':
            return 'htmlmixed';
        default:
            return 'text';
    }
}
//# sourceMappingURL=helpers.js.map