#!/usr/bin/env node
/**
 * Sinaliza para o GitHub Actions que o semantic-release publicou uma
 * nova versão. Chamado pelo `publishCmd` do plugin @semantic-release/exec:
 *   node scripts/notify-release-published.mjs ${nextRelease.version} ${channel}
 *
 * Por que existe: o `release.yml` precisa decidir se executa o publish
 * para a Chrome Web Store após o semantic-release. Como o `publishCmd`
 * só roda quando há uma nova versão a publicar, basta escrevermos as
 * variáveis em $GITHUB_OUTPUT — o step seguinte usa
 * `if: steps.release.outputs.new_version_published == 'true'`.
 *
 * Sem fallbacks: argumentos faltando ou variáveis de ambiente ausentes
 * fazem o processo abortar.
 */

import { appendFileSync } from 'node:fs';

const version = process.argv[2];
const channel = process.argv[3];

if (!version) {
	console.error('✘ Missing version argument');
	console.error('  Usage: node scripts/notify-release-published.mjs <version> <channel>');
	process.exit(1);
}

if (!channel) {
	console.error('✘ Missing channel argument');
	process.exit(1);
}

const githubOutput = process.env.GITHUB_OUTPUT;
if (!githubOutput) {
	console.error('✘ GITHUB_OUTPUT não definido — script só faz sentido dentro de GitHub Actions');
	process.exit(1);
}

const lines = [
	'new_version_published=true',
	`new_version=${version}`,
	`release_channel=${channel}`,
	'',
].join('\n');

appendFileSync(githubOutput, lines);

console.log(`✓ release sinalizado para o workflow: ${version} (channel=${channel})`);
