export const AGENTCAST_MCP_PROTOCOL_VERSION = '2025-11-25';
export const AGENTCAST_MCP_SERVER_NAME = 'agentcast';
export const AGENTCAST_MCP_SERVER_VERSION = '0.0.15';

const sessionIdSchema = {
  type: 'string',
  pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
};

const sessionPathParameter = {
  name: 'sessionId',
  in: 'path',
  required: true,
  schema: sessionIdSchema,
};

const targetSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'sessionIds'],
  properties: {
    mode: { type: 'string', enum: ['sessions', 'all'] },
    sessionIds: { type: 'array', minItems: 1, maxItems: 10, items: sessionIdSchema },
  },
};

const approvalIdSchema = { type: 'string', minLength: 1, maxLength: 100 };
const idempotencyKeySchema = { type: 'string', minLength: 36, maxLength: 100 };

function writeOperation(operationId: string, description: string, properties: Record<string, unknown>, required: string[]) {
  return {
    operationId,
    description,
    'x-webmcp-enabled': true,
    'x-webmcp-approval-required': true,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['idempotencyKey', ...required],
            properties: {
              approvalId: approvalIdSchema,
              idempotencyKey: idempotencyKeySchema,
              controllerSessionId: sessionIdSchema,
              target: targetSchema,
              ...properties,
            },
          },
        },
      },
    },
  };
}

export const AGENTCAST_CONTROL_PLANE_OPENAPI = {
  openapi: '3.1.0',
  paths: {
    '/api/control/platform': {
      get: {
        operationId: 'agentcast_platform_info',
        description: 'Read public AgentCast control-plane identity and protocol information.',
        'x-webmcp-enabled': true,
      },
    },
    '/api/control/sessions/{sessionId}': {
      get: {
        operationId: 'agentcast_session_status',
        description: 'Read sanitized status for one authorized AgentCast browser session.',
        'x-webmcp-enabled': true,
        parameters: [sessionPathParameter],
      },
      post: {
        operationId: 'agentcast_stop_session',
        description: 'Stop an AgentCast browser session.',
        'x-webmcp-enabled': false,
      },
    },
    '/api/control/sessions/{sessionId}/inbox': {
      get: {
        operationId: 'agentcast_session_inbox',
        description: 'Read bounded coordination messages for one authorized AgentCast session.',
        'x-webmcp-enabled': true,
        parameters: [sessionPathParameter],
      },
    },
    '/api/control/sessions/{sessionId}/state': {
      get: {
        operationId: 'agentcast_session_state',
        description: 'Read bounded shared state for one authorized AgentCast session.',
        'x-webmcp-enabled': true,
        parameters: [sessionPathParameter],
      },
    },
    '/api/control/sessions/{sessionId}/schedules': {
      get: {
        operationId: 'agentcast_session_schedules',
        description: 'Read scheduled AgentCast instructions for one authorized session.',
        'x-webmcp-enabled': true,
        parameters: [sessionPathParameter],
      },
    },
    '/api/control/coordination/messages': {
      post: writeOperation(
        'agentcast_send_message',
        'Send one bounded coordination message to one, selected, or all approved AgentCast sessions.',
        {
          type: { type: 'string', enum: ['instruction', 'data', 'state_update', 'response', 'error'] },
          message: { type: 'string', minLength: 1, maxLength: 4000 },
        },
        ['controllerSessionId', 'target', 'type', 'message'],
      ),
    },
    '/api/control/coordination/state': {
      post: writeOperation(
        'agentcast_set_state',
        'Set one bounded string state value on one, selected, or all approved AgentCast sessions.',
        {
          key: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9._-]+$' },
          value: { type: 'string', maxLength: 8000 },
        },
        ['controllerSessionId', 'target', 'key', 'value'],
      ),
    },
    '/api/control/coordination/schedules': {
      post: writeOperation(
        'agentcast_schedule_instruction',
        'Schedule an instruction on one, selected, or all approved AgentCast sessions.',
        {
          instruction: { type: 'string', minLength: 1, maxLength: 4000 },
          delaySeconds: { type: 'integer', minimum: 1, maximum: 86400 },
          intervalSeconds: { type: 'integer', minimum: 1, maximum: 86400 },
          maxRuns: { type: 'integer', minimum: 1, maximum: 100 },
        },
        ['controllerSessionId', 'target', 'instruction', 'delaySeconds', 'maxRuns'],
      ),
    },
    '/api/control/coordination/schedule-cancellations': {
      post: writeOperation(
        'agentcast_cancel_schedule',
        'Cancel one schedule on one, selected, or all approved AgentCast sessions.',
        { taskId: { type: 'string', minLength: 1, maxLength: 256 } },
        ['controllerSessionId', 'target', 'taskId'],
      ),
    },
  },
};
