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
[Get Context](#get-context) · [Development](#development) ·
[Compatibility](#compatibility)

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter
`n8n-nodes-openbsp`. See the n8n
[community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/).

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

## Get Context

Webhooks deliver a single row. The **Message → Get Context** action (and the
Trigger's **Load Conversation Context** option) enrich an event with the whole
thread — organization, contact, and the recent messages in chronological order —
the same shape OpenBSP's `agent-client` builds for an AI agent. Feed it straight
into an AI/LLM node.

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

- [OpenBSP n8n guide](https://github.com/matiasbattocchia/n8n-nodes-openbsp)
- [OpenBSP repo](https://github.com/matiasbattocchia/open-bsp-api)
- [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
