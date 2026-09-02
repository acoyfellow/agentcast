import { describe, expect, it } from 'vitest';
import {
  AGENTCAST_CONTROL_PLANE_OPENAPI,
  AGENTCAST_MCP_PROTOCOL_VERSION,
  AGENTCAST_MCP_SERVER_NAME,
} from '../mcp.js';

describe('AgentCast MCP control-plane contract', () => {
  it('publishes one OpenAPI 3.1 source for MCP and WebMCP adapters', () => {
    expect(AGENTCAST_CONTROL_PLANE_OPENAPI.openapi).toBe('3.1.0');
    expect(AGENTCAST_MCP_PROTOCOL_VERSION).toBe('2025-11-25');
    expect(AGENTCAST_MCP_SERVER_NAME).toBe('agentcast');
  });

  it('opts in bounded reads and explicitly approval-managed writes', () => {
    const operations = Object.values(AGENTCAST_CONTROL_PLANE_OPENAPI.paths).flatMap((path) => Object.entries(path));
    const enabled = operations.filter(([, operation]) => operation['x-webmcp-enabled'] === true);
    expect(enabled.map(([, operation]) => operation.operationId)).toEqual([
      'agentcast_platform_info',
      'agentcast_session_status',
      'agentcast_session_inbox',
      'agentcast_session_state',
      'agentcast_session_schedules',
      'agentcast_send_message',
      'agentcast_set_state',
      'agentcast_schedule_instruction',
      'agentcast_cancel_schedule',
    ]);
    const writes = enabled.filter(([method]) => method !== 'get');
    expect(writes).toHaveLength(4);
    expect(writes.every(([, operation]) => operation['x-webmcp-approval-required'] === true)).toBe(true);
    expect(operations.find(([, operation]) => operation.operationId === 'agentcast_stop_session')?.[1]['x-webmcp-enabled']).toBe(false);
  });
});
