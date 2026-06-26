import type { IDataObject } from "n8n-workflow";
import { type OpenBspContext, openbspRestRequest } from "./transport";

/**
 * Assemble a conversation "context" the way the OpenBSP agent-client edge
 * function does: the organization, the conversation, the contact, and the last
 * N messages within a time window, in chronological order. Webhooks deliver a
 * single row, so this enriches it by querying the rest of the thread.
 *
 * Defaults mirror agent-client (50 messages / 7 days).
 */

export const DEFAULT_MESSAGE_LIMIT = 50;
export const DEFAULT_TIME_WINDOW_DAYS = 7;

export interface ContextOptions {
  conversationId?: string;
  organizationAddress?: string;
  contactAddress?: string;
  service?: string;
  messageLimit?: number;
  timeWindowDays?: number;
}

export interface ConversationContext {
  organization: IDataObject | null;
  conversation: IDataObject;
  contact: IDataObject | null;
  contact_address: IDataObject | null;
  messages: IDataObject[];
}

const CONVERSATION_SELECT =
  "*,organizations(*),contacts_addresses(*,contacts(*))";

export async function buildConversationContext(
  this: OpenBspContext,
  opts: ContextOptions,
): Promise<ConversationContext> {
  let conversation: IDataObject | undefined;

  if (opts.conversationId) {
    conversation =
      (await openbspRestRequest.call(this, "GET", "conversations", {
        qs: { id: `eq.${opts.conversationId}`, select: CONVERSATION_SELECT },
        single: true,
      })) as IDataObject;
  } else {
    if (!opts.organizationAddress || !opts.contactAddress) {
      throw new Error(
        "Provide either a Conversation ID, or both an Account and a Contact address, to build context.",
      );
    }
    const rows = (await openbspRestRequest.call(this, "GET", "conversations", {
      qs: {
        organization_address: `eq.${opts.organizationAddress}`,
        contact_address: `eq.${opts.contactAddress}`,
        service: `eq.${opts.service ?? "whatsapp"}`,
        select: CONVERSATION_SELECT,
        limit: 1,
      },
    })) as IDataObject[];
    conversation = rows[0];
  }

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const conversationId = conversation.id as string;
  const limit = opts.messageLimit ?? DEFAULT_MESSAGE_LIMIT;
  const windowDays = opts.timeWindowDays ?? DEFAULT_TIME_WINDOW_DAYS;
  const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString();
  const nowIso = new Date().toISOString();

  const messages = (await openbspRestRequest.call(this, "GET", "messages", {
    qs: {
      conversation_id: `eq.${conversationId}`,
      // gte window start AND lte now (exclude future scheduled messages)
      and: `(timestamp.gte.${sinceIso},timestamp.lte.${nowIso})`,
      order: "timestamp.desc",
      limit,
    },
  })) as IDataObject[];

  // Queried descending to apply the limit; return chronological.
  messages.reverse();

  const { organizations, contacts_addresses, ...rest } = conversation as
    & IDataObject
    & {
      organizations?: IDataObject;
      contacts_addresses?: IDataObject & { contacts?: IDataObject };
    };

  const contactAddress = (contacts_addresses as IDataObject | undefined) ??
    null;
  const contact = (contacts_addresses?.contacts as IDataObject | undefined) ??
    null;

  return {
    organization: (organizations as IDataObject | undefined) ?? null,
    conversation: rest,
    contact,
    contact_address: contactAddress,
    messages,
  };
}
