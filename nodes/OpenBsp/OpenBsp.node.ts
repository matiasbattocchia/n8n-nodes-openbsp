import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from "n8n-workflow";
import {
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
} from "n8n-workflow";

import { properties } from "./descriptions";
import { listSearch } from "./methods";
import {
  contactsContent,
  locationContent,
  mediaContent,
  type MediaKind,
  templateContent,
  textContent,
} from "./content";
import { buildConversationContext } from "./context";
import {
  openbspEdgeRequest,
  openbspRestRequest,
  resolveOrganizationId,
} from "./transport";

function parseJsonParam(
  value: unknown,
  fallback: IDataObject[] = [],
): IDataObject[] {
  if (Array.isArray(value)) return value as IDataObject[];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed)
      ? (parsed as IDataObject[])
      : [parsed as IDataObject];
  }
  if (value && typeof value === "object") return [value as IDataObject];
  return fallback;
}

function toItems(data: unknown): IDataObject[] {
  if (Array.isArray(data)) return data as IDataObject[];
  if (data && typeof data === "object") return [data as IDataObject];
  return [{ value: data } as IDataObject];
}

export class OpenBsp implements INodeType {
  description: INodeTypeDescription = {
    displayName: "OpenBSP",
    name: "openBsp",
    icon: { light: "file:openbsp.svg", dark: "file:openbsp.dark.svg" },
    group: ["output"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description:
      "Send WhatsApp/Instagram messages and read data through OpenBSP",
    defaults: { name: "OpenBSP" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: "openBspApi", required: true }],
    properties,
  };

  methods = { listSearch };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter("resource", i) as string;
        const operation = this.getNodeParameter("operation", i) as string;

        let responseItems: IDataObject[] = [];

        if (resource === "message") {
          responseItems = await handleMessage.call(this, operation, i);
        } else if (resource === "conversation") {
          responseItems = await handleConversation.call(this, operation, i);
        } else if (resource === "contact") {
          responseItems = await handleContact.call(this, operation, i);
        } else if (resource === "template") {
          responseItems = await handleTemplate.call(this, operation, i);
        } else if (resource === "account") {
          responseItems = await handleAccount.call(this, operation, i);
        } else {
          throw new NodeOperationError(
            this.getNode(),
            `Unknown resource: ${resource}`,
            {
              itemIndex: i,
            },
          );
        }

        for (const json of responseItems) {
          returnData.push({ json, pairedItem: { item: i } });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw new NodeApiError(this.getNode(), error as JsonObject, {
          itemIndex: i,
        });
      }
    }

    return [returnData];
  }
}

// --------------------------------------------------------------------- Message

async function handleMessage(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject[]> {
  if (operation === "getStatus") {
    const messageId = this.getNodeParameter("messageId", i) as string;
    const row = await openbspRestRequest.call(this, "GET", "messages", {
      qs: {
        id: `eq.${messageId}`,
        select: "id,status,timestamp,content,direction",
      },
      single: true,
    });
    return toItems(row);
  }

  if (operation === "getContext") {
    const conversationId =
      (this.getNodeParameter("conversationId", i, "") as string) || undefined;
    const account = (this.getNodeParameter("account", i, "", {
      extractValue: true,
    }) as string) || undefined;
    const to = (this.getNodeParameter("to", i, "") as string) || undefined;
    const service = this.getNodeParameter("service", i, "whatsapp") as string;
    const opts = this.getNodeParameter("contextOptions", i, {}) as IDataObject;

    const context = await buildConversationContext.call(this, {
      conversationId,
      organizationAddress: account,
      contactAddress: to,
      service,
      messageLimit: opts.messageLimit as number | undefined,
      timeWindowDays: opts.timeWindowDays as number | undefined,
    });
    return [context as unknown as IDataObject];
  }

  // Send operations
  const account = this.getNodeParameter("account", i, "", {
    extractValue: true,
  }) as string;
  const service = this.getNodeParameter("service", i, "whatsapp") as string;
  const to = this.getNodeParameter("to", i) as string;

  let content: IDataObject;

  switch (operation) {
    case "sendText":
      content = textContent(this.getNodeParameter("text", i) as string);
      break;
    case "sendMedia": {
      const kind = this.getNodeParameter("mediaKind", i) as MediaKind;
      const fileUrl = this.getNodeParameter("fileUrl", i) as string;
      const extra = this.getNodeParameter("mediaOptions", i, {}) as IDataObject;
      content = mediaContent(
        kind,
        {
          uri: fileUrl,
          mime_type: extra.mimeType as string | undefined,
          name: extra.fileName as string | undefined,
          size: extra.fileSize as number | undefined,
        },
        extra.caption as string | undefined,
      );
      break;
    }
    case "sendTemplate": {
      const name = this.getNodeParameter("templateName", i, "", {
        extractValue: true,
      }) as string;
      const languageCode = this.getNodeParameter("languageCode", i) as string;
      const useRaw = this.getNodeParameter(
        "useRawComponents",
        i,
        false,
      ) as boolean;
      content = templateContent({
        name,
        languageCode,
        bodyParameters: useRaw
          ? undefined
          : (this.getNodeParameter("bodyParameters", i, []) as string[]),
        componentsJson: useRaw
          ? parseJsonParam(this.getNodeParameter("componentsJson", i, "[]"))
          : undefined,
      });
      break;
    }
    case "sendLocation":
      content = locationContent({
        latitude: this.getNodeParameter("latitude", i) as number,
        longitude: this.getNodeParameter("longitude", i) as number,
        ...(this.getNodeParameter("locationOptions", i, {}) as IDataObject),
      });
      break;
    case "sendContacts":
      content = contactsContent(
        parseJsonParam(this.getNodeParameter("contactsJson", i, "[]")),
      );
      break;
    default:
      throw new NodeOperationError(
        this.getNode(),
        `Unknown message operation: ${operation}`,
        {
          itemIndex: i,
        },
      );
  }

  const body: IDataObject = {
    organization_address: account,
    contact_address: to,
    service,
    direction: "outgoing",
    content,
  };

  const created = await openbspRestRequest.call(this, "POST", "messages", {
    body,
    prefer: ["return=representation"],
  });
  return toItems(created);
}

// ---------------------------------------------------------------- Conversation

async function handleConversation(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject[]> {
  if (operation === "get") {
    const conversationId = this.getNodeParameter("conversationId", i) as string;
    const row = await openbspRestRequest.call(this, "GET", "conversations", {
      qs: { id: `eq.${conversationId}`, select: "*" },
      single: true,
    });
    return toItems(row);
  }

  // getAll
  const returnAll = this.getNodeParameter("returnAll", i, false) as boolean;
  const qs: IDataObject = { select: "*", order: "updated_at.desc" };
  if (!returnAll) qs.limit = this.getNodeParameter("limit", i, 50) as number;

  const rows = await openbspRestRequest.call(this, "GET", "conversations", {
    qs,
  });
  return toItems(rows);
}

// --------------------------------------------------------------------- Contact

async function handleContact(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject[]> {
  if (operation === "get") {
    const contactId = this.getNodeParameter("contactId", i) as string;
    const row = await openbspRestRequest.call(this, "GET", "contacts", {
      qs: { id: `eq.${contactId}`, select: "*,contacts_addresses(*)" },
      single: true,
    });
    return toItems(row);
  }

  if (operation === "create") {
    const name = this.getNodeParameter("name", i) as string;
    const created = await openbspRestRequest.call(this, "POST", "contacts", {
      body: { name },
      prefer: ["return=representation"],
    });
    return toItems(created);
  }

  // search
  const searchTerm = this.getNodeParameter("searchTerm", i, "") as string;
  const returnAll = this.getNodeParameter("returnAll", i, false) as boolean;
  const qs: IDataObject = {
    select: "*,contacts_addresses(*)",
    order: "name.asc",
  };
  if (searchTerm) qs.name = `ilike.*${searchTerm}*`;
  if (!returnAll) qs.limit = this.getNodeParameter("limit", i, 50) as number;

  const rows = await openbspRestRequest.call(this, "GET", "contacts", { qs });
  return toItems(rows);
}

// -------------------------------------------------------------------- Template

async function handleTemplate(
  this: IExecuteFunctions,
  _operation: string,
  i: number,
): Promise<IDataObject[]> {
  const account = this.getNodeParameter("account", i, "", {
    extractValue: true,
  }) as string;
  const organizationId = await resolveOrganizationId.call(this);

  const response = (await openbspEdgeRequest.call(
    this,
    "GET",
    "whatsapp-management/templates",
    {
      organization_id: organizationId,
      organization_address: account,
    },
  )) as { data?: IDataObject[] } | IDataObject[];

  const templates = Array.isArray(response) ? response : (response.data ?? []);
  return toItems(templates);
}

// --------------------------------------------------------------------- Account

async function handleAccount(
  this: IExecuteFunctions,
  _operation: string,
  i: number,
): Promise<IDataObject[]> {
  const returnAll = this.getNodeParameter("returnAll", i, false) as boolean;
  const qs: IDataObject = {
    select: "service,address,status,extra",
    order: "created_at.asc",
  };
  if (!returnAll) qs.limit = this.getNodeParameter("limit", i, 50) as number;

  const rows = await openbspRestRequest.call(
    this,
    "GET",
    "organizations_addresses",
    { qs },
  );
  return toItems(rows);
}
