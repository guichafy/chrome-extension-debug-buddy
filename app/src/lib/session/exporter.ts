import JSZip from 'jszip';
import type { Session } from './types';
import { buildViewerHtml } from './viewerTemplate';

export interface DbSessionManifest {
	formatVersion: 1;
	createdAt: number;
	sessionId: string;
	sessionSchemaVersion: 1;
	exporterAgent: string;
}

export async function serializeSession(session: Session): Promise<ArrayBuffer> {
	const zip = new JSZip();
	const sessionJson = JSON.stringify(session, null, 2);
	const manifest: DbSessionManifest = {
		formatVersion: 1,
		createdAt: Date.now(),
		sessionId: session.id,
		sessionSchemaVersion: session.schemaVersion,
		exporterAgent: 'debug-buddy',
	};

	zip.file('manifest.json', JSON.stringify(manifest, null, 2));
	zip.file('session.json', sessionJson);
	zip.file('viewer.html', buildViewerHtml(sessionJson));

	return zip.generateAsync({ type: 'arraybuffer' });
}
