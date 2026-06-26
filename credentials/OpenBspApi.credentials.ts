import type {
  IAuthenticate,
  Icon,
  ICredentialTestRequest,
  ICredentialType,
  IHttpRequestOptions,
  INodeProperties,
} from "n8n-workflow";

/**
 * OpenBSP authenticates two kinds of endpoints differently:
 *
 *   - REST (PostgREST, `/rest/v1/…`): the publishable key goes in `apikey` and
 *     the OpenBSP key in `api-key`. The OpenBSP key is NOT a JWT and must never
 *     be sent as `Authorization: Bearer` — PostgREST rejects it (401 PGRST301).
 *
 *   - Edge Functions (`/functions/v1/…`): the OpenBSP key goes in
 *     `Authorization: Bearer …` (the function middleware reads it there).
 *
 * The custom `authenticate` function below branches on the request URL so a
 * single credential works for both. See AUTH.md in the OpenBSP repo.
 *
 * The publishable key and project URL default to the hosted instance at
 * web.openbsp.dev, so managed-service users only need to paste their OpenBSP API
 * key. Self-hosters override all three fields.
 */
export class OpenBspApi implements ICredentialType {
  name = "openBspApi";

  displayName = "OpenBSP API";

  documentationUrl =
    "https://github.com/matiasbattocchia/open-bsp-api/blob/main/N8N_NODE.md";

  icon: Icon = { light: "file:openbsp.svg", dark: "file:openbsp.dark.svg" };

  properties: INodeProperties[] = [
    {
      displayName: "OpenBSP API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description:
        "Your OpenBSP API key. Find it in the OpenBSP UI under Settings → API Keys. An Admin-role key is required for the OpenBSP Trigger node.",
    },
    {
      displayName: "Supabase Publishable Key",
      name: "publishableKey",
      type: "string",
      default: "sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd",
      description:
        "Defaults to the hosted OpenBSP instance — leave as-is unless self-hosting. The Supabase publishable key (sb_publishable_…) of your own project.",
    },
    {
      displayName: "Supabase Project URL",
      name: "url",
      type: "string",
      default: "https://nheelwshzbgenpavwhcy.supabase.co",
      placeholder: "https://your-project.supabase.co",
      description:
        "Defaults to the hosted OpenBSP instance — leave as-is unless self-hosting. The base URL of your own Supabase project.",
    },
  ];

  authenticate: IAuthenticate = (
    credentials,
    requestOptions: IHttpRequestOptions,
  ): Promise<IHttpRequestOptions> => {
    const target = `${requestOptions.baseURL ?? ""}${requestOptions.url ?? ""}`;
    const headers = { ...(requestOptions.headers ?? {}) } as Record<
      string,
      string
    >;

    headers.apikey = credentials.publishableKey as string;

    if (target.includes("/functions/v1/")) {
      headers.Authorization = `Bearer ${credentials.apiKey as string}`;
    } else {
      headers["api-key"] = credentials.apiKey as string;
    }

    requestOptions.headers = headers;
    return Promise.resolve(requestOptions);
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.url.replace(/\\/$/, "")}}/rest/v1',
      url: "/organizations_addresses",
      method: "GET",
      qs: { select: "organization_id", limit: 1 },
    },
  };
}
