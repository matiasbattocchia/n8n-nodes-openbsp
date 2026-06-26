import type {
  ILoadOptionsFunctions,
  INodeListSearchItems,
  INodeListSearchResult,
} from "n8n-workflow";
import {
  openbspEdgeRequest,
  openbspRestRequest,
  resolveOrganizationId,
} from "./transport";

interface AccountRow {
  address: string;
  status?: string;
  extra?: { verified_name?: string; phone_number?: string };
}

/** Searchable list of connected accounts (organization_address / phone number ID). */
export async function getAccounts(
  this: ILoadOptionsFunctions,
  filter?: string,
): Promise<INodeListSearchResult> {
  const rows =
    (await openbspRestRequest.call(this, "GET", "organizations_addresses", {
      qs: { select: "address,status,extra", order: "created_at.asc" },
    })) as AccountRow[];

  const results: INodeListSearchItems[] = rows
    .map((row) => {
      const label = row.extra?.verified_name ?? row.extra?.phone_number ??
        row.address;
      return { name: `${label} (${row.address})`, value: row.address };
    })
    .filter((item) =>
      !filter || item.name.toLowerCase().includes(filter.toLowerCase())
    );

  return { results };
}

interface TemplateRow {
  name: string;
  language?: string;
  status?: string;
}

/** Searchable list of approved templates for the currently selected Account. */
export async function getTemplates(
  this: ILoadOptionsFunctions,
  filter?: string,
): Promise<INodeListSearchResult> {
  const account = this.getCurrentNodeParameter("account", {
    extractValue: true,
  }) as string;
  if (!account) {
    return { results: [] };
  }

  const organizationId = await resolveOrganizationId.call(this);

  const response = (await openbspEdgeRequest.call(
    this,
    "GET",
    "whatsapp-management/templates",
    {
      organization_id: organizationId,
      organization_address: account,
    },
  )) as { data?: TemplateRow[] } | TemplateRow[];

  const templates: TemplateRow[] = Array.isArray(response)
    ? response
    : (response.data ?? []);

  const results: INodeListSearchItems[] = templates
    .filter((t) =>
      !filter || t.name.toLowerCase().includes(filter.toLowerCase())
    )
    .map((t) => ({
      name: t.language ? `${t.name} (${t.language})` : t.name,
      value: t.name,
      description: t.status,
    }));

  return { results };
}

export const listSearch = { getAccounts, getTemplates };
