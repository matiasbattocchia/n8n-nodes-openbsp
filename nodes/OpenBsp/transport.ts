import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

export type OpenBspContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions;

function stripTrailingSlash(url: string): string {
	return url.replace(/\/$/, '');
}

export interface RestOptions {
	qs?: IDataObject;
	body?: IDataObject | IDataObject[];
	/** Extra `Prefer` directives, e.g. `return=representation`, `count=exact`. */
	prefer?: string[];
	/** Return a single object instead of an array (PostgREST singular accept). */
	single?: boolean;
}

/**
 * Call the OpenBSP REST API (PostgREST). Authentication headers (`apikey` +
 * `api-key`) are injected by the credential's generic `authenticate`.
 */
export async function openbspRestRequest(
	this: OpenBspContext,
	method: IHttpRequestMethods,
	resource: string,
	options: RestOptions = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('openBspApi');
	const url = `${stripTrailingSlash(credentials.url as string)}/rest/v1/${resource}`;

	const headers: IDataObject = { 'Content-Type': 'application/json' };
	const prefer = [...(options.prefer ?? [])];
	if (prefer.length) headers.Prefer = prefer.join(',');
	if (options.single) headers.Accept = 'application/vnd.pgrst.object+json';

	return this.helpers.httpRequestWithAuthentication.call(this, 'openBspApi', {
		method,
		url,
		qs: options.qs,
		body: options.body,
		headers,
		json: true,
	});
}

/**
 * Call an OpenBSP Edge Function (e.g. whatsapp-management). Edge functions
 * authenticate the OpenBSP key via `Authorization: Bearer <key>` (see AUTH.md);
 * the credential's `authenticate` detects the `/functions/v1/` path and sets
 * that header automatically.
 */
export async function openbspEdgeRequest(
	this: OpenBspContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
): Promise<unknown> {
	const credentials = await this.getCredentials('openBspApi');
	const url = `${stripTrailingSlash(credentials.url as string)}/functions/v1/${path}`;

	return this.helpers.httpRequestWithAuthentication.call(this, 'openBspApi', {
		method,
		url,
		body,
		headers: { 'Content-Type': 'application/json' },
		json: true,
	});
}

/**
 * Resolve `organization_id` for the authenticated API key. OpenBSP RLS scopes
 * `organizations` to the key's organization, so the first row is the org.
 */
export async function resolveOrganizationId(this: OpenBspContext): Promise<string> {
	const rows = (await openbspRestRequest.call(this, 'GET', 'organizations', {
		qs: { select: 'id', limit: 1 },
	})) as Array<{ id: string }>;

	if (!rows?.length) {
		throw new Error('Could not resolve an organization for this API key.');
	}
	return rows[0].id;
}
