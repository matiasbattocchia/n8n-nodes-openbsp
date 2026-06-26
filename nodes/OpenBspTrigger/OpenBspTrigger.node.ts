import { randomUUID } from 'node:crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { buildConversationContext } from '../OpenBsp/context';
import { listSearch } from '../OpenBsp/methods';
import { openbspRestRequest, resolveOrganizationId } from '../OpenBsp/transport';

type WebhookTable = 'messages' | 'conversations';
type WebhookOperation = 'insert' | 'update';

function mapEvent(event: string): { table: WebhookTable; operations: WebhookOperation[] } {
	switch (event) {
		case 'onMessageStatus':
			return { table: 'messages', operations: ['update'] };
		case 'onConversation':
			return { table: 'conversations', operations: ['insert', 'update'] };
		case 'onMessage':
		default:
			return { table: 'messages', operations: ['insert'] };
	}
}

export class OpenBspTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenBSP Trigger',
		name: 'openBspTrigger',
		icon: { light: 'file:openbsp.svg', dark: 'file:openbsp.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow on OpenBSP message or conversation events',
		defaults: { name: 'OpenBSP Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'openBspApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				default: 'onMessage',
				options: [
					{
						name: 'Conversation',
						value: 'onConversation',
						description: 'A conversation was created or updated',
					},
					{
						name: 'Message',
						value: 'onMessage',
						description: 'A new message was created (insert)',
					},
					{
						name: 'Message Status',
						value: 'onMessageStatus',
						description: 'A message delivery status changed (sent, delivered, read, failed)',
					},
				],
			},
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				default: 'incoming',
				description: 'Only trigger for messages in this direction',
				displayOptions: { show: { event: ['onMessage', 'onMessageStatus'] } },
				options: [
					{ name: 'Any', value: 'any' },
					{ name: 'Incoming Only', value: 'incoming' },
					{ name: 'Outgoing Only', value: 'outgoing' },
				],
			},
			{
				displayName: 'Service',
				name: 'serviceFilter',
				type: 'options',
				default: 'any',
				options: [
					{ name: 'Any', value: 'any' },
					{ name: 'Instagram', value: 'instagram' },
					{ name: 'WhatsApp', value: 'whatsapp' },
				],
			},
			{
				displayName: 'Load Conversation Context',
				name: 'loadContext',
				type: 'boolean',
				default: false,
				description:
					'Whether to attach the conversation thread (organization, contact, recent messages) to each event — useful for feeding an AI agent',
			},
			{
				displayName: 'Context Options',
				name: 'contextOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { loadContext: [true] } },
				options: [
					{
						displayName: 'Message Limit',
						name: 'messageLimit',
						type: 'number',
						default: 50,
					},
					{
						displayName: 'Time Window (Days)',
						name: 'timeWindowDays',
						type: 'number',
						default: 7,
					},
				],
			},
		],
	};

	methods = { listSearch };

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.webhookId) return false;
				try {
					const rows = (await openbspRestRequest.call(this, 'GET', 'webhooks', {
						qs: { id: `eq.${staticData.webhookId}`, select: 'id' },
					})) as IDataObject[];
					return Array.isArray(rows) && rows.length > 0;
				} catch {
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const event = this.getNodeParameter('event') as string;
				const { table, operations } = mapEvent(event);

				// API keys are organization-scoped, so the org is unambiguous.
				const organizationId = await resolveOrganizationId.call(this);

				const token = randomUUID();

				const created = (await openbspRestRequest.call(this, 'POST', 'webhooks', {
					body: {
						organization_id: organizationId,
						table_name: table,
						operations,
						url: webhookUrl,
						token,
					},
					prefer: ['return=representation'],
					single: true,
				})) as IDataObject;

				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookId = created.id;
				staticData.token = token;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.webhookId) return true;
				try {
					await openbspRestRequest.call(this, 'DELETE', 'webhooks', {
						qs: { id: `eq.${staticData.webhookId}` },
					});
				} catch {
					// best-effort cleanup; ignore if already gone
				}
				delete staticData.webhookId;
				delete staticData.token;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData() as IDataObject;
		const staticData = this.getWorkflowStaticData('node');

		// Verify the shared-secret token OpenBSP sends as a bearer token.
		if (staticData.token) {
			const headers = this.getHeaderData() as IDataObject;
			const auth = (headers.authorization ?? headers.Authorization) as string | undefined;
			if (auth !== `Bearer ${staticData.token}`) {
				const res = this.getResponseObject();
				res.status(403).json({ message: 'Invalid token' });
				return { noWebhookResponse: true };
			}
		}

		const data = (bodyData.data ?? {}) as IDataObject;

		// Apply filters — skip the event without starting the workflow.
		const direction = this.getNodeParameter('direction', 'any') as string;
		if (direction !== 'any' && data.direction && data.direction !== direction) {
			return { workflowData: undefined };
		}

		const serviceFilter = this.getNodeParameter('serviceFilter', 'any') as string;
		if (serviceFilter !== 'any' && data.service && data.service !== serviceFilter) {
			return { workflowData: undefined };
		}

		let outJson: IDataObject = bodyData;

		const loadContext = this.getNodeParameter('loadContext', false) as boolean;
		if (loadContext && data.conversation_id) {
			const opts = this.getNodeParameter('contextOptions', {}) as IDataObject;
			const context = await buildConversationContext.call(this, {
				conversationId: data.conversation_id as string,
				messageLimit: opts.messageLimit as number | undefined,
				timeWindowDays: opts.timeWindowDays as number | undefined,
			});
			outJson = { ...bodyData, context: context as unknown as IDataObject };
		}

		return { workflowData: [this.helpers.returnJsonArray([outJson])] };
	}
}
