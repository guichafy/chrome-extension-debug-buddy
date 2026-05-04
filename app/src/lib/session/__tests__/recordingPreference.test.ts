import { getRecordingDisabled, setRecordingDisabled } from '../recordingPreference';

describe('recordingPreference', () => {
	beforeEach(() => {
		// limpa o storage entre testes
		(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
	});

	test('getRecordingDisabled retorna false por default', async () => {
		const v = await getRecordingDisabled();
		expect(v).toBe(false);
	});

	test('setRecordingDisabled persiste true', async () => {
		await setRecordingDisabled(true);
		const v = await getRecordingDisabled();
		expect(v).toBe(true);
	});

	test('setRecordingDisabled persiste false explicitamente', async () => {
		await setRecordingDisabled(true);
		await setRecordingDisabled(false);
		const v = await getRecordingDisabled();
		expect(v).toBe(false);
	});

	test('getRecordingDisabled rejeita valores nao-boolean (sanidade)', async () => {
		// chrome.storage corrompido — devemos lançar, não cair em fallback.
		(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {
			recordingDisabled: 'yes',
		};
		await expect(getRecordingDisabled()).rejects.toThrow(/recordingDisabled/);
	});
});
