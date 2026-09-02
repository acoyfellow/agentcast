# AgentCast MCP

AgentCast exposes a small read-only control-plane surface over Streamable HTTP. Mulder compiles the same OpenAPI 3.1 document used by native WebMCP, so tool names and schemas cannot drift between adapters.

## Endpoint

```text
https://<agentcast-api>/mcp/<session-id>
```

The endpoint supports `initialize`, `ping`, `tools/list`, `tools/call`, and `notifications/initialized`. The legacy `/mcp?session=...` endpoint returns HTTP 410.

## Authentication

Send a short-lived capability only in the authorization header:

```text
Authorization: Bearer <capability>
```

It must contain the exact API origin as audience, the session UUID in the endpoint, the `mcp:run` permission, and a valid expiry. AgentCast rejects missing, expired, wrong-audience, wrong-session, and insufficient-permission capabilities before MCP dispatch.

Capabilities expire within 15 minutes. A trusted client-side command or broker must refresh them. Never save capabilities in a repository, URL, shell history, receipt, or chat message.

## Generated tools

| Tool | Effect | Additional enforcement |
| --- | --- | --- |
| `agentcast_platform_info` | Reads sanitized control-plane identity | None; contains no private state |
| `agentcast_session_status` | Reads lifecycle status and page origin | Its `sessionId` argument must equal the capability-bound endpoint session |

The OpenAPI document contains an unmarked stop operation to prove mutations remain absent. Navigation, clicking, typing, extraction, raw CDP, arbitrary JavaScript, cookies, and credentials are not exposed.

## Check the connection

```sh
export AGENTCAST_API_ORIGIN='https://api.agentcast.example.com'
export AGENTCAST_SESSION_ID='<session-uuid>'
read -rs AGENTCAST_CAPABILITY
export AGENTCAST_CAPABILITY
```

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $AGENTCAST_CAPABILITY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"colleague-check","version":"1"}}}' \
  "$AGENTCAST_API_ORIGIN/mcp/$AGENTCAST_SESSION_ID"
```

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $AGENTCAST_CAPABILITY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  "$AGENTCAST_API_ORIGIN/mcp/$AGENTCAST_SESSION_ID"
```

## Pi

Install and enable `pi-mcp-adapter`, then add a project `.mcp.json`:

```json
{
  "mcpServers": {
    "agentcast": {
      "url": "${AGENTCAST_MCP_URL}",
      "auth": "bearer",
      "bearerTokenEnv": "AGENTCAST_CAPABILITY",
      "protocolVersion": "legacy",
      "lifecycle": "lazy"
    }
  }
}
```

Set `AGENTCAST_MCP_URL` to the complete session-bound endpoint. Use `requestHeadersCommand` with a trusted capability broker for unattended refresh rather than storing a long-lived credential.

## Status call

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "agentcast_session_status",
    "arguments": { "sessionId": "<same-session-uuid>" }
  }
}
```

## Common failures

- **401 MCP capability denied:** Mint a fresh capability for this session, audience, and `mcp:run` permission.
- **Session capability mismatch:** The URL, tool argument, and capability session UUID must all match.
- **Pi reports authentication required:** Confirm its environment received a non-expired capability.
- **HTTP 410:** Replace `/mcp?session=` with `/mcp/<session-id>`.
