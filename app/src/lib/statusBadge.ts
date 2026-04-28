/**
 * Maps an HTTP status code to a semantic Tailwind class set for badge styling.
 *
 * - 1xx (informational): muted (rare; we don't have a dedicated token)
 * - 2xx (success):       success token
 * - 3xx (redirect):      info token
 * - 4xx (client error):  warning token
 * - 5xx (server error):  destructive token
 *
 * Returns CSS classes that compose bg + text + border for use on a `<Badge>`.
 */
export function getStatusBadgeClass(status: number): string {
	if (status >= 500) {
		return 'bg-destructive/15 text-destructive border-destructive/40';
	}
	if (status >= 400) {
		return 'bg-warning/15 text-warning border-warning/40';
	}
	if (status >= 300) {
		return 'bg-info/15 text-info border-info/40';
	}
	if (status >= 200) {
		return 'bg-success/15 text-success border-success/40';
	}
	if (status >= 100) {
		return 'bg-muted text-muted-foreground border-muted-foreground/30';
	}
	// Unknown/0/negative — treat as muted to avoid lying about success
	return 'bg-muted text-muted-foreground border-muted-foreground/30';
}

/**
 * Returns a short human label for a status code's category.
 * Used as fallback text when statusText from the response is missing.
 */
export function getStatusCategory(status: number): string {
	if (status >= 500) return 'Server Error';
	if (status >= 400) return 'Client Error';
	if (status >= 300) return 'Redirect';
	if (status >= 200) return 'Success';
	if (status >= 100) return 'Informational';
	return 'Unknown';
}
