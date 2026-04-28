import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { findMatchingRuleAction } from '@/domain/ruleMatching';

export interface ReplayCaptured {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body?: string;
}

export interface ReplayMock {
	status: number;
	statusPhrase?: string;
	headers: Record<string, string>;
	body?: string;
	ruleId: string;
	ruleName: string;
}

export interface ReplayView {
	captured: ReplayCaptured;
	currentMock: ReplayMock | null;
}

export function buildReplayView(request: InterceptedResponse, rules: Rule[]): ReplayView {
	const captured: ReplayCaptured = {
		status: request.status,
		statusText: request.statusText,
		headers: request.response?.headers ?? request.headers,
		body: request.response?.body ?? request.body,
	};

	if (!request.method) {
		return { captured, currentMock: null };
	}

	const match = findMatchingRuleAction(rules, {
		url: request.url,
		method: request.method,
		headers: request.request?.headers ?? {},
		body: request.request?.postData,
	});

	if (!match || match.type !== 'mock') {
		return { captured, currentMock: null };
	}

	return {
		captured,
		currentMock: {
			status: match.action.status,
			statusPhrase: match.action.statusPhrase,
			headers: match.action.headers,
			body: match.action.body,
			ruleId: match.rule.id,
			ruleName: match.rule.name,
		},
	};
}
