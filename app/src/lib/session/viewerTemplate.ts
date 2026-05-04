// Template HTML standalone que renderiza uma session offline + visual rrweb.
// JSON.stringify(session) é injetado como literal JavaScript.
// rrweb-player JS+CSS é embutido inline a partir do node_modules em build time.
//
// Vite 6 já declara `*?raw` em `vite/client.d.ts` — não precisamos de
// `// @ts-expect-error` aqui. O bundle UMD expõe o construtor como
// `window.rrwebPlayer` (objeto `{ Player, default }` em alpha.20).
//
// `rrweb-player-umd` e `rrweb-player-css` são aliases declarados em
// vite.config.mts e vitest.config.ts — necessários porque o package
// `rrweb-player` tem `exports` field travado e não permite import de
// `dist/rrweb-player.umd.min.cjs` direto.

import rrwebPlayerJs from 'rrweb-player-umd?raw';
import rrwebPlayerCss from 'rrweb-player-css?raw';

export function buildViewerHtml(sessionJson: string): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Debug Buddy — Session Viewer</title>
<style>
	body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 16px; color: #1f2937; }
	header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
	h1 { font-size: 18px; margin: 0; font-weight: 600; }
	.meta { color: #6b7280; font-size: 12px; }
	main { display: grid; grid-template-columns: 65% 1fr; gap: 12px; height: calc(100vh - 80px); }
	#player { background: #000; border-radius: 4px; overflow: hidden; }
	.right { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
	.timeline { flex: 1; overflow: auto; border: 1px solid #e5e7eb; border-radius: 4px; }
	.row { display: grid; grid-template-columns: auto 1fr; gap: 12px; padding: 4px 12px; border-bottom: 1px solid #f3f4f6; font-family: ui-monospace, monospace; font-size: 11px; }
	.offset { color: #6b7280; }
	.t-network { color: #1d4ed8; }
	.t-console { color: #334155; }
	.t-route { color: #7c3aed; }
	.t-error { color: #b91c1c; }
	.t-detection { color: #047857; }
	.phase { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; font-size: 11px; margin-bottom: 8px; }
	.banner { background: #fef3c7; color: #92400e; padding: 6px 12px; font-size: 12px; border-radius: 4px; margin-bottom: 12px; }
	.fallback { display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280; font-size: 13px; padding: 24px; text-align: center; }
	.recs { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; font-size: 11px; margin-top: 8px; max-height: 240px; overflow: auto; }
	.recs h2 { font-size: 12px; margin: 0 0 6px 0; color: #374151; }
	.rec { border-bottom: 1px solid #f3f4f6; padding: 4px 0; }
	.rec summary { cursor: pointer; display: flex; gap: 6px; align-items: baseline; font-family: ui-monospace, monospace; }
	.rec .sev { font-weight: 600; padding: 1px 4px; border-radius: 3px; font-size: 10px; }
	.rec-info .sev { background: #dbeafe; color: #1e40af; }
	.rec-warn .sev { background: #fef3c7; color: #92400e; }
	.rec-error .sev { background: #fee2e2; color: #991b1b; }
	.rec .rule { color: #4b5563; font-size: 11px; }
	.rec .host { color: #6b7280; font-size: 10px; margin-left: auto; }
	.rec p { margin: 4px 0; color: #1f2937; }
	.rec .summary { font-style: italic; }
	.rec .suggestion { color: #047857; }
	.rec table.evidence { font-size: 10px; border-collapse: collapse; margin: 2px 0; }
	.rec table.evidence th { text-align: left; color: #6b7280; padding-right: 8px; vertical-align: top; font-weight: 500; }
	.rec table.evidence td { color: #1f2937; }
${rrwebPlayerCss}
</style>
</head>
<body>
<div class="banner">Debug Buddy Session Viewer (offline standalone) — replay visual via rrweb embutido.</div>
<header>
	<h1 id="title">Carregando…</h1>
	<span class="meta" id="meta"></span>
</header>
<main>
	<div id="player"></div>
	<div class="right">
		<div class="timeline" id="timeline"></div>
		<aside id="phases"></aside>
		<section class="recs" id="recs"></section>
	</div>
</main>
<script>
${rrwebPlayerJs}
</script>
<script>
const SESSION = ${sessionJson};

function escape(s) {
	return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function eventLabel(ev) {
	switch (ev.type) {
		case 'network': return '[' + ev.method + '] ' + ev.url + ' → ' + ev.status;
		case 'console': {
			const text = (ev.args || []).map(a => a.description).join(' ');
			const count = ev.coalesceCount > 1 ? ' (×' + ev.coalesceCount + ')' : '';
			return '[' + (ev.level || '').toUpperCase() + '] ' + text + count;
		}
		case 'route': return '[ROUTE/' + ev.triggerType + '] ' + ev.url;
		case 'error': return '[ERROR] ' + ev.message;
		case 'detection': return '[PHASE START] ' + ev.phaseId;
		default: return '[' + ev.type + ']';
	}
}

function offsetSec(ev, startedAt) {
	const ms = ev.timestamp >= 1e12 ? (ev.timestamp - startedAt) : (ev.timestamp * 1000 - startedAt);
	return (ms / 1000).toFixed(2);
}

document.getElementById('title').textContent = 'Replay — ' + (SESSION.metadata && SESSION.metadata.initialUrl || 'sem URL');
document.getElementById('meta').textContent = (SESSION.events || []).length + ' eventos · ' + (SESSION.detectionPhases || []).length + ' fases · ' + ((SESSION.rrwebEvents || []).length) + ' eventos visuais';

const playerHost = document.getElementById('player');
// UMD em alpha.20 expõe { Player, default } como global rrwebPlayer.
// O construtor real é .default (ESM) ou .Player. Tentar ambos sem fabricar fallback silencioso:
// se nenhum existir e houver eventos visuais, é erro real (versão incompatível) — não rendereza fake.
const PlayerCtor = (typeof rrwebPlayer !== 'undefined')
	? (rrwebPlayer.default || rrwebPlayer.Player || (typeof rrwebPlayer === 'function' ? rrwebPlayer : null))
	: null;

if ((SESSION.rrwebEvents || []).length >= 2 && PlayerCtor) {
	new PlayerCtor({
		target: playerHost,
		props: {
			events: SESSION.rrwebEvents,
			showController: true,
			autoPlay: false,
		},
	});
} else {
	if ((SESSION.rrwebEvents || []).length >= 2 && !PlayerCtor) {
		// Eventos visuais existem mas o construtor não bateu — versão futura do rrweb-player
		// pode ter renomeado o global. Loga pra ser diagnosticável via DevTools em vez de
		// silenciar. Não faz fallback (no-fallbacks): UI continua mostrando que não há replay.
		console.warn('[debug-buddy viewer] rrweb-player constructor não encontrado em globalThis.rrwebPlayer:', typeof rrwebPlayer === 'undefined' ? 'undefined' : rrwebPlayer);
	}
	playerHost.innerHTML = '<div class="fallback">Sessão sem captura visual.<br/>Gravada antes da Fase 2 ou com rrweb desabilitado.</div>';
}

const timeline = document.getElementById('timeline');
(SESSION.events || []).forEach(ev => {
	const row = document.createElement('div');
	row.className = 'row';
	row.innerHTML = '<span class="offset">+' + offsetSec(ev, SESSION.startedAt) + 's</span><span class="t-' + ev.type + '">' + escape(eventLabel(ev)) + '</span>';
	timeline.appendChild(row);
});

const phases = document.getElementById('phases');
(SESSION.detectionPhases || []).forEach((p, i) => {
	const div = document.createElement('div');
	div.className = 'phase';
	const techs = (p.pages && p.pages[0] && p.pages[0].techs) || [];
	const topTech = techs[0] || {};
	const topName = topTech.name || 'sem detecção';
	const topVersion = topTech.version ? ' v' + escape(topTech.version) : '';
	div.innerHTML = '<strong>Fase ' + (i + 1) + ' — ' + escape(topName) + topVersion + '</strong><br>' + (p.pages || []).length + ' URL(s)';
	phases.appendChild(div);
});

// Recomendações — Phase E. Lista detectada pelo RecommendationEngine durante a
// gravação. Formato é um <details> por hit com severity/ruleId/host na summary.
const recsHost = document.getElementById('recs');
const recs = SESSION.recommendations || [];
if (recs.length === 0) {
	recsHost.innerHTML = '<h2>Recomendações</h2><p style="color:#6b7280;font-size:11px;margin:0;">Nenhuma recomendação registrada nesta sessão.</p>';
} else {
	const items = recs.map(function (r) {
		const evRows = Object.entries(r.evidence || {}).map(function (entry) {
			return '<tr><th>' + escape(entry[0]) + '</th><td>' + escape(entry[1]) + '</td></tr>';
		}).join('');
		const suggestion = r.suggestion ? '<p class="suggestion">' + escape(r.suggestion) + '</p>' : '';
		return '<details class="rec rec-' + escape(r.severity) + '">'
			+ '<summary>'
				+ '<span class="sev">' + escape(String(r.severity).toUpperCase()) + '</span>'
				+ '<span class="rule">' + escape(r.ruleId) + '</span>'
				+ '<span class="host">' + escape(r.host) + '</span>'
			+ '</summary>'
			+ '<p class="summary">' + escape(r.summary) + '</p>'
			+ '<table class="evidence">' + evRows + '</table>'
			+ suggestion
		+ '</details>';
	}).join('');
	recsHost.innerHTML = '<h2>Recomendações (' + recs.length + ')</h2>' + items;
}
</script>
</body>
</html>`;
}
