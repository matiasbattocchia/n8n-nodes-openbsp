import type { INodeProperties } from 'n8n-workflow';

const SEND_OPS = ['sendText', 'sendMedia', 'sendTemplate', 'sendLocation', 'sendContacts'];

/** The sender account (organization_address / phone number ID). */
function accountField(operations: string[], required = true): INodeProperties {
	return {
		displayName: 'Account',
		name: 'account',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required,
		description: 'The WhatsApp/Instagram sender to use (your phone number ID)',
		displayOptions: {
			show: { resource: ['message', 'template'], operation: operations },
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'getAccounts', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				hint: 'Meta phone number ID',
				placeholder: 'e.g. 123456789012345',
			},
		],
	};
}

function serviceField(operations: string[]): INodeProperties {
	return {
		displayName: 'Service',
		name: 'service',
		type: 'options',
		default: 'whatsapp',
		options: [
			{ name: 'WhatsApp', value: 'whatsapp' },
			{ name: 'Instagram', value: 'instagram' },
		],
		displayOptions: { show: { resource: ['message'], operation: operations } },
	};
}

function toField(operations: string[]): INodeProperties {
	return {
		displayName: 'To',
		name: 'to',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 5491155551234',
		description:
			'Recipient address: bare digits for WhatsApp (no +, no spaces), or the scoped user ID for Instagram',
		displayOptions: { show: { resource: ['message'], operation: operations } },
	};
}

export const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'Contact', value: 'contact' },
			{ name: 'Conversation', value: 'conversation' },
			{ name: 'Message', value: 'message' },
			{ name: 'Template', value: 'template' },
		],
		default: 'message',
	},

	// ---------------------------------------------------------------- Message
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Get Context',
				value: 'getContext',
				action: 'Get a conversation with context',
				description: 'Fetch a conversation thread (org, contact, recent messages) for an AI agent',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				action: 'Get the delivery status of a message',
				description: 'Fetch the current delivery status of a sent message',
			},
			{
				name: 'Send Contacts',
				value: 'sendContacts',
				action: 'Send contact cards',
				description: 'Share one or more contact cards',
			},
			{
				name: 'Send Location',
				value: 'sendLocation',
				action: 'Send a location',
				description: 'Send a latitude/longitude location',
			},
			{
				name: 'Send Media',
				value: 'sendMedia',
				action: 'Send a media message',
				description: 'Send an image, document, audio, video or sticker by URL',
			},
			{
				name: 'Send Template',
				value: 'sendTemplate',
				action: 'Send a template message',
				description: 'Send an approved template (opens a conversation / works after 24h)',
			},
			{
				name: 'Send Text',
				value: 'sendText',
				action: 'Send a text message',
				description: 'Send a plain text message (within the 24h service window)',
			},
		],
		default: 'sendText',
	},

	accountField([...SEND_OPS, 'getContext']),
	serviceField([...SEND_OPS, 'getContext']),
	toField([...SEND_OPS]),

	// Send Text
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['message'], operation: ['sendText'] },
		},
	},

	// Send Media
	{
		displayName: 'Media Type',
		name: 'mediaKind',
		type: 'options',
		default: 'image',
		options: [
			{ name: 'Audio', value: 'audio' },
			{ name: 'Document', value: 'document' },
			{ name: 'Image', value: 'image' },
			{ name: 'Sticker', value: 'sticker' },
			{ name: 'Video', value: 'video' },
		],
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'] },
		},
	},
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/file.pdf',
		description: 'Publicly reachable URL. Meta downloads the file from here.',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'mediaOptions',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['message'], operation: ['sendMedia'] },
		},
		options: [
			{ displayName: 'Caption', name: 'caption', type: 'string', default: '' },
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
			},
			{
				displayName: 'MIME Type',
				name: 'mimeType',
				type: 'string',
				default: '',
				placeholder: 'application/pdf',
			},
			{
				displayName: 'File Size (Bytes)',
				name: 'fileSize',
				type: 'number',
				default: 0,
			},
		],
	},

	// Send Template
	{
		displayName: 'Template Name or ID',
		name: 'templateName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'Choose an approved template. Depends on the selected Account.',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendTemplate'] },
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'getTemplates', searchable: true },
			},
			{
				displayName: 'By Name',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. hello_world',
			},
		],
	},
	{
		displayName: 'Language Code',
		name: 'languageCode',
		type: 'string',
		default: 'en_US',
		required: true,
		placeholder: 'en_US',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendTemplate'] },
		},
	},
	{
		displayName: 'Body Parameters',
		name: 'bodyParameters',
		type: 'string',
		typeOptions: {
			multipleValues: true,
			multipleValueButtonText: 'Add Parameter',
		},
		default: [],
		description: 'Positional {{1}}, {{2}}… values for the template BODY',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendTemplate'] },
			hide: { useRawComponents: [true] },
		},
	},
	{
		displayName: 'Use Raw Components JSON',
		name: 'useRawComponents',
		type: 'boolean',
		default: false,
		description:
			'Whether to provide the full template components array as JSON (for header/button/media parameters)',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendTemplate'] },
		},
	},
	{
		displayName: 'Components',
		name: 'componentsJson',
		type: 'json',
		default: '[]',
		description: 'The full template "components" array, as sent to the WhatsApp Cloud API',
		displayOptions: {
			show: {
				resource: ['message'],
				operation: ['sendTemplate'],
				useRawComponents: [true],
			},
		},
	},

	// Send Location
	{
		displayName: 'Latitude',
		name: 'latitude',
		type: 'number',
		default: 0,
		required: true,
		typeOptions: { numberPrecision: 7 },
		displayOptions: {
			show: { resource: ['message'], operation: ['sendLocation'] },
		},
	},
	{
		displayName: 'Longitude',
		name: 'longitude',
		type: 'number',
		default: 0,
		required: true,
		typeOptions: { numberPrecision: 7 },
		displayOptions: {
			show: { resource: ['message'], operation: ['sendLocation'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'locationOptions',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['message'], operation: ['sendLocation'] },
		},
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Address', name: 'address', type: 'string', default: '' },
		],
	},

	// Send Contacts
	{
		displayName: 'Contacts',
		name: 'contactsJson',
		type: 'json',
		default: '[]',
		required: true,
		description: 'Array of contact-card objects in WhatsApp Cloud API format',
		displayOptions: {
			show: { resource: ['message'], operation: ['sendContacts'] },
		},
	},

	// Get Status
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		default: '',
		required: true,
		description: 'The OpenBSP message ID (UUID) returned when the message was sent',
		displayOptions: {
			show: { resource: ['message'], operation: ['getStatus'] },
		},
	},

	// Get Context
	{
		displayName: 'Conversation ID',
		name: 'conversationId',
		type: 'string',
		default: '',
		description: 'Conversation UUID. Leave empty to resolve from the Account + To address above.',
		displayOptions: {
			show: { resource: ['message'], operation: ['getContext'] },
		},
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		default: '',
		description:
			'Contact address — used to resolve the conversation when no Conversation ID is set',
		displayOptions: {
			show: { resource: ['message'], operation: ['getContext'] },
		},
	},
	{
		displayName: 'Options',
		name: 'contextOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: ['message'], operation: ['getContext'] },
		},
		options: [
			{
				displayName: 'Message Limit',
				name: 'messageLimit',
				type: 'number',
				default: 50,
				description: 'Max number of recent messages to include',
			},
			{
				displayName: 'Time Window (Days)',
				name: 'timeWindowDays',
				type: 'number',
				default: 7,
				description: 'Only include messages newer than this many days',
			},
		],
	},

	// ----------------------------------------------------------- Conversation
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['conversation'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many conversations',
				description: 'List recent conversations',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a conversation',
				description: 'Get a single conversation by ID',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Conversation ID',
		name: 'conversationId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['conversation'], operation: ['get'] },
		},
	},

	// ----------------------------------------------------------------- Contact
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Search',
				value: 'search',
				action: 'Search contacts',
				description: 'Find contacts by name',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a contact',
				description: 'Get a contact by ID',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a contact',
				description: 'Create a new contact',
			},
		],
		default: 'search',
	},
	{
		displayName: 'Search Term',
		name: 'searchTerm',
		type: 'string',
		default: '',
		description: 'Matched against contact name (case-insensitive)',
		displayOptions: { show: { resource: ['contact'], operation: ['search'] } },
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['contact'], operation: ['get'] } },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
	},

	// ---------------------------------------------------------------- Template
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['template'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many templates',
				description: 'List approved message templates',
			},
		],
		default: 'getAll',
	},
	accountField(['getAll']),

	// ----------------------------------------------------------------- Account
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many accounts',
				description: 'List connected WhatsApp/Instagram accounts',
			},
		],
		default: 'getAll',
	},

	// Shared list controls (Get Many across resources)
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['conversation', 'contact', 'account'],
				operation: ['getAll', 'search'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['conversation', 'contact', 'account'],
				operation: ['getAll', 'search'],
				returnAll: [false],
			},
		},
	},
];
