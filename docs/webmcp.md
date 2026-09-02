# AgentCast WebMCP

AgentCast dogfoods [Mulder](https://mulder.coey.dev) to compile its OpenAPI 3.1 control-plane document into native WebMCP tools. The same compiled descriptors are served by remote MCP; there is no handwritten second catalog.

## Source of truth

`AGENTCAST_CONTROL_PLANE_OPENAPI` is exported from `agentcast/mcp`. An operation enters both generated surfaces only when it carries:

```yaml
x-webmcp-enabled: true
```

Mulder currently accepts explicitly enabled read-only `GET` operations with bounded scalar path or query parameters. It rejects enabled mutations, request bodies, references, unsupported serialization, and undeclared input properties before publication.

## Exposed tools

| Tool | Authentication | Result |
| --- | --- | --- |
| `agentcast_platform_info` | Public | Sanitized control-plane identity and protocols |
| `agentcast_session_status` | Authenticated AgentCast web session | Session UUID, lifecycle status, and page origin |

The OpenAPI document includes `agentcast_stop_session` as a disabled operation. Mulder must not publish it.

## Browser integration

The AgentCast server injects Mulder's external bootstrap module into HTML responses. In browsers exposing `document.modelContext`, the module registers the generated descriptors and sends calls to the unchanged same-origin control-plane API. Browsers without WebMCP continue normally.

Authentication cookies remain in the browser and are forwarded only by the trusted same-origin server dispatch. Tool results never contain cookies or capability grants.

## Excluded authority

Generated WebMCP does not expose:

- Cookies, passwords, passkeys, browser storage, or capability grants.
- Raw CDP or arbitrary JavaScript evaluation.
- Clipboard contents, uploads, or downloads.
- Navigation, clicks, typing, messages, stop, restore, or other mutations.

Writes require a separate server-enforced approval design. MCP annotations are not authorization.

## Proof

The release proof runs Mulder's native harness against Chrome 151. It requires discovery of exactly the two enabled tools, invokes `agentcast_platform_info`, verifies the unchanged API response, and proves the disabled mutation is absent through manifest parity tests.
