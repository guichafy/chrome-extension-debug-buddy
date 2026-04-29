import type { InterceptedResponse } from '@/types/intercepted';
import type { Filter } from '@/types/filters';
import { getRequestState, matchesFilter, matchesFilters } from '../filterMatching';

function makeRequest(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://api.example.com/users/42',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		mimeType: 'application/json',
		type: 'xhr',
		timestamp: 0,
		...overrides,
	};
}

function makeFilter(overrides: Partial<Filter>): Filter {
	return {
		id: 'test-filter',
		field: 'free',
		operator: 'contains',
		value: '',
		...overrides,
	};
}

describe('getRequestState', () => {
	test('captureError tem prioridade máxima', () => {
		expect(getRequestState(makeRequest({ captureError: 'boom', isWaiting: true }))).toBe('failed');
	});
	test('isWaiting=true → pending', () => {
		expect(getRequestState(makeRequest({ isWaiting: true }))).toBe('pending');
	});
	test('isMocked=true → mocked', () => {
		expect(getRequestState(makeRequest({ isMocked: true }))).toBe('mocked');
	});
	test('isWaiting=false → modified', () => {
		expect(getRequestState(makeRequest({ isWaiting: false }))).toBe('modified');
	});
	test('default → proxy', () => {
		expect(getRequestState(makeRequest())).toBe('proxy');
	});
});

describe('matchesFilter — free', () => {
	test('busca substring case-insensitive em URL', () => {
		const request = makeRequest({ url: 'https://api.example.com/USERS/42' });
		const filter = makeFilter({ field: 'free', value: 'users' });
		expect(matchesFilter(request, filter)).toBe(true);
	});
	test('busca em method', () => {
		const filter = makeFilter({ field: 'free', value: 'get' });
		expect(matchesFilter(makeRequest({ method: 'GET' }), filter)).toBe(true);
	});
	test('busca em status numérico como string', () => {
		const filter = makeFilter({ field: 'free', value: '404' });
		expect(matchesFilter(makeRequest({ status: 404 }), filter)).toBe(true);
	});
	test('valor vazio sempre casa', () => {
		const filter = makeFilter({ field: 'free', value: '' });
		expect(matchesFilter(makeRequest(), filter)).toBe(true);
	});
});

describe('matchesFilter — string fields', () => {
	test('method is GET', () => {
		const filter = makeFilter({ field: 'method', operator: 'is', value: 'GET' });
		expect(matchesFilter(makeRequest({ method: 'GET' }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ method: 'POST' }), filter)).toBe(false);
	});
	test('url contains /api', () => {
		const filter = makeFilter({ field: 'url', operator: 'contains', value: '/api' });
		expect(matchesFilter(makeRequest({ url: 'https://x.com/api/v1' }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ url: 'https://x.com/foo' }), filter)).toBe(false);
	});
	test('url startsWith é case-insensitive', () => {
		const filter = makeFilter({ field: 'url', operator: 'startsWith', value: 'HTTPS://' });
		expect(matchesFilter(makeRequest({ url: 'https://x.com' }), filter)).toBe(true);
	});
	test('mime is application/json', () => {
		const filter = makeFilter({ field: 'mime', operator: 'is', value: 'application/json' });
		expect(matchesFilter(makeRequest({ mimeType: 'application/json' }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ mimeType: 'text/html' }), filter)).toBe(false);
	});
	test('campo string undefined nunca casa', () => {
		const filter = makeFilter({ field: 'mime', operator: 'is', value: 'application/json' });
		expect(matchesFilter(makeRequest({ mimeType: undefined }), filter)).toBe(false);
	});
});

describe('matchesFilter — status', () => {
	test('status is 200', () => {
		const filter = makeFilter({ field: 'status', operator: 'is', value: '200' });
		expect(matchesFilter(makeRequest({ status: 200 }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ status: 201 }), filter)).toBe(false);
	});
	test('status gte 500', () => {
		const filter = makeFilter({ field: 'status', operator: 'gte', value: '500' });
		expect(matchesFilter(makeRequest({ status: 500 }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ status: 599 }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ status: 499 }), filter)).toBe(false);
	});
	test('status lte 299', () => {
		const filter = makeFilter({ field: 'status', operator: 'lte', value: '299' });
		expect(matchesFilter(makeRequest({ status: 200 }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ status: 300 }), filter)).toBe(false);
	});
	test('grupo 4xx casa apenas com operador is', () => {
		const filter = makeFilter({ field: 'status', operator: 'is', value: '4xx' });
		expect(matchesFilter(makeRequest({ status: 404 }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ status: 499 }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ status: 500 }), filter)).toBe(false);
	});
	test('valor não numérico não casa', () => {
		const filter = makeFilter({ field: 'status', operator: 'is', value: 'OK' });
		expect(matchesFilter(makeRequest({ status: 200 }), filter)).toBe(false);
	});
});

describe('matchesFilter — state', () => {
	test('state pending', () => {
		const filter = makeFilter({ field: 'state', operator: 'is', value: 'pending' });
		expect(matchesFilter(makeRequest({ isWaiting: true }), filter)).toBe(true);
		expect(matchesFilter(makeRequest({ isWaiting: false }), filter)).toBe(false);
	});
	test('state mocked', () => {
		const filter = makeFilter({ field: 'state', operator: 'is', value: 'mocked' });
		expect(matchesFilter(makeRequest({ isMocked: true }), filter)).toBe(true);
	});
	test('state failed quando captureError presente', () => {
		const filter = makeFilter({ field: 'state', operator: 'is', value: 'failed' });
		expect(matchesFilter(makeRequest({ captureError: 'oops' }), filter)).toBe(true);
	});
});

describe('matchesFilters — combinações', () => {
	test('lista vazia casa todas', () => {
		expect(matchesFilters(makeRequest(), [])).toBe(true);
	});
	test('AND entre campos diferentes', () => {
		const request = makeRequest({ method: 'POST', status: 503 });
		const filters: Filter[] = [
			makeFilter({ field: 'method', operator: 'is', value: 'POST' }),
			makeFilter({ field: 'status', operator: 'gte', value: '500' }),
		];
		expect(matchesFilters(request, filters)).toBe(true);

		const requestNonMatching = makeRequest({ method: 'GET', status: 503 });
		expect(matchesFilters(requestNonMatching, filters)).toBe(false);
	});
	test('OR dentro do mesmo campo', () => {
		const filters: Filter[] = [
			makeFilter({ field: 'method', operator: 'is', value: 'GET' }),
			makeFilter({ field: 'method', operator: 'is', value: 'POST' }),
		];
		expect(matchesFilters(makeRequest({ method: 'GET' }), filters)).toBe(true);
		expect(matchesFilters(makeRequest({ method: 'POST' }), filters)).toBe(true);
		expect(matchesFilters(makeRequest({ method: 'PUT' }), filters)).toBe(false);
	});
	test('AND entre campos + OR dentro do campo', () => {
		const filters: Filter[] = [
			makeFilter({ field: 'method', operator: 'is', value: 'GET' }),
			makeFilter({ field: 'method', operator: 'is', value: 'POST' }),
			makeFilter({ field: 'status', operator: 'is', value: '4xx' }),
		];
		expect(matchesFilters(makeRequest({ method: 'GET', status: 404 }), filters)).toBe(true);
		expect(matchesFilters(makeRequest({ method: 'POST', status: 422 }), filters)).toBe(true);
		expect(matchesFilters(makeRequest({ method: 'GET', status: 200 }), filters)).toBe(false);
		expect(matchesFilters(makeRequest({ method: 'PUT', status: 404 }), filters)).toBe(false);
	});
});
