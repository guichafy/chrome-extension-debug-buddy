import { sessionStore } from '../storage';

export async function purgeOldSessions(
	retentionDays: number,
	now: number = Date.now(),
): Promise<number> {
	if (retentionDays < 1 || !Number.isFinite(retentionDays)) {
		throw new RangeError('retentionDays deve ser >= 1');
	}
	const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
	const sessions = await sessionStore.list();
	let deleted = 0;
	for (const s of sessions) {
		if (s.endedAt !== null && s.endedAt < cutoff) {
			await sessionStore.delete(s.id);
			deleted++;
		}
	}
	return deleted;
}
