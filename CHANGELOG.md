# Changelog

## 0.1.0

Initial release.

- **OpenBSP** action node with resources: Message (Send Text / Media / Template
  / Location / Contacts, Get Status, Get Context), Conversation, Contact,
  Template, Account.
- **OpenBSP Trigger** node: On Message / On Message Status / On Conversation,
  with automatic webhook registration and teardown, bearer-token verification,
  and direction/service filtering.
- **Get Context**: assembles an agent-client-style conversation thread
  (organization, contact, recent messages) for AI agent workflows.
- **OpenBSP API** credential with hosted-instance defaults and dual REST / Edge
  Function authentication.
