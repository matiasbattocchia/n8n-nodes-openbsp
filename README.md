# n8n-nodes-openbsp

n8n community nodes for
[OpenBSP](https://github.com/matiasbattocchia/open-bsp-api) — the open-source
WhatsApp & Instagram Business Platform built on Meta's official Cloud API.

Send and receive WhatsApp/Instagram messages from your n8n workflows: trigger on
incoming messages and delivery-status changes, and send text, media, templates,
locations and contacts — plus read conversations, contacts and templates.

This package provides two nodes:

- **OpenBSP** — actions, organized by resource: **Message** (Send Text / Media /
  Template / Location / Contacts, Get Status, **Get Context**),
  **Conversation**, **Contact**, **Template**, **Account**.
- **OpenBSP Trigger** — starts a workflow on **On Message**, **On Message
  Status**, or **On Conversation** events. It **registers and removes the
  OpenBSP webhook for you** when the workflow is activated/deactivated — no
  manual setup.

[Installation](#installation) · [Credentials](#credentials) ·
[Quickstart](#quickstart-your-first-workflow) ·
[Example workflows](#example-workflows) · [Get Context](#get-context) ·
[Operations](#operations) · [Development](#development) ·
[Compatibility](#compatibility)

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter
`n8n-nodes-openbsp`. See the n8n
[community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/).

![Install the community node](images/01-install-community-node.png)

## Credentials

Create one **OpenBSP API** credential:

| Field                        | Notes                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| **OpenBSP API Key**          | OpenBSP UI → Settings → API Keys. Admin role required for the Trigger node. |
| **Supabase Publishable Key** | Pre-filled for the hosted instance. Self-hosters use their own.             |
| **Supabase Project URL**     | Pre-filled for the hosted instance. Self-hosters use their own project URL. |

Hosted-instance users only paste the **API key**; the other two default to
`web.openbsp.dev`. The credential authenticates REST calls with the
`apikey`/`api-key` headers and Edge Function calls with `Authorization: Bearer`
automatically — see
[AUTH.md](https://github.com/matiasbattocchia/open-bsp-api/blob/main/AUTH.md).

![Create the OpenBSP API credential](images/02-create-credential.png)

## Quickstart: your first workflow

This walkthrough takes you from zero to a working WhatsApp auto-responder. It
assumes you've installed the node and have an OpenBSP API key.

### 1. Add the OpenBSP API credential

In n8n go to **Credentials → New → OpenBSP API**. Paste your **OpenBSP API
Key**. If you use the hosted instance at `web.openbsp.dev`, leave the publishable
key and project URL at their defaults; self-hosters override all three. Click
**Save** — n8n runs a connection test against your OpenBSP project.

> Use an **Admin** API key if you plan to use the **OpenBSP Trigger** — it needs
> permission to register webhooks.

### 2. Send your first message

1. Create a new workflow and add a **Manual Trigger** (“Trigger manually”).
2. Add an **OpenBSP** node. Set:
   - **Resource:** Message
   - **Operation:** Send Text
   - **Account:** pick your sender from the list (your WhatsApp number)
   - **To:** a recipient in international format, digits only (e.g.
     `5491155551234`)
   - **Text:** `Hello from n8n 👋`
3. Click **Execute step**.

![The OpenBSP Send Text action](images/03-send-text-node.png)

> **Service window:** plain text only reaches contacts inside the 24-hour
> customer-service window. To start a brand-new conversation, use **Send
> Template** with an approved template instead.

### 3. Auto-reply to incoming messages (echo bot)

1. Start a new workflow with an **OpenBSP Trigger** node.
   - **Event:** Message
   - **Direction:** Incoming Only
2. Add an **OpenBSP** node (Message → Send Text) connected to the trigger:
   - **Account:** `={{ $json.data.organization_address }}`
   - **To:** `={{ $json.data.contact_address }}`
   - **Service:** `={{ $json.data.service }}`
   - **Text:** `=You said: {{ $json.data.content.text }}`
3. **Activate** the workflow. Activating registers the OpenBSP webhook
   automatically — deactivating removes it.

![The echo-bot workflow](images/04-echo-bot-workflow.png)

Send a WhatsApp message to your number; the workflow echoes it back.

![Workflow execution output](images/05-execution-output.png)

### 4. See it in OpenBSP

Open the OpenBSP web UI — the conversation shows your message and the automated
reply, side by side with everything else your team handles.

![The conversation in OpenBSP](images/06-openbsp-conversation.png)

> Don't have time to drag nodes around? Import a ready-made workflow from
> [Example workflows](#example-workflows) below.

## Example workflows

Import via **Workflows → ⋯ (top-right) → Import from File** (or copy the JSON and
paste it onto the canvas). After importing, open each OpenBSP node and select
your **OpenBSP API** credential.

Ready-to-import files live in [`examples/`](examples):

| Workflow      | File                                                         | What it does                                                                                                                     |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Echo bot      | [`examples/echo-bot.json`](examples/echo-bot.json)           | Replies to every incoming message with its own text. The smallest end-to-end example.                                            |
| AI auto-reply | [`examples/ai-auto-reply.json`](examples/ai-auto-reply.json) | Loads the conversation thread as context, asks an LLM for a reply, and sends it. Requires a chat-model credential (e.g. OpenAI). |

<details>
<summary><strong>Echo bot</strong> — JSON</summary>

```json
{
	"name": "OpenBSP — Echo bot",
	"nodes": [
		{
			"parameters": { "event": "onMessage", "direction": "incoming", "serviceFilter": "any" },
			"name": "On incoming message",
			"type": "n8n-nodes-openbsp.openBspTrigger",
			"typeVersion": 1,
			"position": [380, 300],
			"credentials": { "openBspApi": { "id": "REPLACE_ME", "name": "OpenBSP account" } }
		},
		{
			"parameters": {
				"resource": "message",
				"operation": "sendText",
				"account": {
					"__rl": true,
					"value": "={{ $json.data.organization_address }}",
					"mode": "id"
				},
				"service": "={{ $json.data.service }}",
				"to": "={{ $json.data.contact_address }}",
				"text": "=You said: {{ $json.data.content.text }}"
			},
			"name": "Echo back",
			"type": "n8n-nodes-openbsp.openBsp",
			"typeVersion": 1,
			"position": [680, 300],
			"credentials": { "openBspApi": { "id": "REPLACE_ME", "name": "OpenBSP account" } }
		}
	],
	"connections": {
		"On incoming message": { "main": [[{ "node": "Echo back", "type": "main", "index": 0 }]] }
	}
}
```

</details>

<details>
<summary><strong>AI auto-reply (with conversation context)</strong> — JSON</summary>

Toggle **Load Conversation Context** on the trigger so the LLM sees the recent
thread. Connect any chat model to the AI Agent.

```json
{
	"name": "OpenBSP — AI auto-reply (with context)",
	"nodes": [
		{
			"parameters": {
				"event": "onMessage",
				"direction": "incoming",
				"serviceFilter": "any",
				"loadContext": true
			},
			"name": "On incoming message",
			"type": "n8n-nodes-openbsp.openBspTrigger",
			"typeVersion": 1,
			"position": [340, 320],
			"credentials": { "openBspApi": { "id": "REPLACE_ME", "name": "OpenBSP account" } }
		},
		{
			"parameters": {
				"promptType": "define",
				"text": "={{ $json.data.content.text }}",
				"options": {
					"systemMessage": "You are a helpful WhatsApp assistant for our business. Reply concisely."
				}
			},
			"name": "AI Agent",
			"type": "@n8n/n8n-nodes-langchain.agent",
			"typeVersion": 1.7,
			"position": [640, 320]
		},
		{
			"parameters": { "model": "gpt-4o-mini", "options": {} },
			"name": "OpenAI Chat Model",
			"type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
			"typeVersion": 1,
			"position": [640, 520],
			"credentials": { "openAiApi": { "id": "REPLACE_ME", "name": "OpenAI account" } }
		},
		{
			"parameters": {
				"resource": "message",
				"operation": "sendText",
				"account": {
					"__rl": true,
					"value": "={{ $('On incoming message').item.json.data.organization_address }}",
					"mode": "id"
				},
				"service": "={{ $('On incoming message').item.json.data.service }}",
				"to": "={{ $('On incoming message').item.json.data.contact_address }}",
				"text": "={{ $json.output }}"
			},
			"name": "Send reply",
			"type": "n8n-nodes-openbsp.openBsp",
			"typeVersion": 1,
			"position": [1000, 320],
			"credentials": { "openBspApi": { "id": "REPLACE_ME", "name": "OpenBSP account" } }
		}
	],
	"connections": {
		"On incoming message": { "main": [[{ "node": "AI Agent", "type": "main", "index": 0 }]] },
		"OpenAI Chat Model": {
			"ai_languageModel": [[{ "node": "AI Agent", "type": "ai_languageModel", "index": 0 }]]
		},
		"AI Agent": { "main": [[{ "node": "Send reply", "type": "main", "index": 0 }]] }
	}
}
```

</details>

## Get Context

Webhooks deliver a single row. The **Message → Get Context** action (and the
Trigger's **Load Conversation Context** option) enrich an event with the whole
thread — organization, contact, and the recent messages in chronological order —
the same shape OpenBSP's `agent-client` builds for an AI agent. Feed it straight
into an AI/LLM node.

The trigger emits the changed row under `data`, plus `entity` and `action`; with
context loading on, a `context` object is attached:

```
{ "data": { …message row… }, "entity": "messages", "action": "insert",
  "context": { "organization": {…}, "conversation": {…}, "contact": {…},
               "messages": [ …chronological… ] } }
```

## Operations

**Message** — Send Text · Send Media · Send Template · Send Location · Send
Contacts · Get Status · Get Context
**Conversation** — Get · Get Many
**Contact** — Search · Get · Create
**Template** — Get Many
**Account** — Get Many

**OpenBSP Trigger** events — On Message · On Message Status · On Conversation,
with **Direction** (incoming/outgoing/any) and **Service** (WhatsApp/Instagram/
any) filters and optional **Load Conversation Context**.

## Development

Requires **Node.js ≥ 22**, Docker, and Git.

```bash
npm install
npm run build      # compile to dist/
npm run lint       # eslint-plugin-n8n-nodes-base (+ n8n community rules)
npm run dev        # run n8n with this node loaded + hot reload (http://localhost:5678)
```

### Testing in a Docker container

`npm run dev` is the fastest loop. To instead test inside the official n8n
image, mount the built package as a custom extension:

```bash
docker volume create n8n_data
npm run build
docker run -it --rm --name n8n -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -v "$(pwd)":/home/node/.n8n/custom/n8n-nodes-openbsp \
  -e N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom \
  docker.n8n.io/n8nio/n8n
```

Open http://localhost:5678 and search the node panel for **OpenBSP**.

> **Triggers need a public URL.** Cloud OpenBSP can't reach `localhost`. Either
> run n8n with a tunnel, or point the credential at a local Supabase stack
> (`npx supabase start`). The action node needs neither.

## Compatibility

- n8n nodes API version 1; Node.js ≥ 22.
- OpenBSP runs on Meta's official Cloud API: no QR/session; messages outside the
  24-hour service window require an approved **template**; groups/status are not
  available.

## Resources

- [OpenBSP repo](https://github.com/matiasbattocchia/open-bsp-api)
- [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
