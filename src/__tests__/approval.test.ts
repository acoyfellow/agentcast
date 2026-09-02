import { describe, expect, it } from 'vitest';
import { signAgentCastApprovalAssertion, verifyAgentCastApprovalAssertion, type AgentCastApprovalAssertion } from '../approval.js';

const assertion: AgentCastApprovalAssertion = {
  controllerSessionId: '96ca3514-05f7-49a8-aa48-0b3b235d8747',
  operation: 'agentcast_send_message',
  input: { idempotencyKey: '4e6d28ac-006a-4cf7-96a1-e013406588b5', message: 'hello' },
  subject: 'owner',
  browserSessionId: '019fd391-aa11-7719-9c9c-d9bc68c3f904',
  platformSessionExpiresAt: 2_000_000_000_000,
  approvalExpiresAt: 1_900_000_120_000,
  policyVersion: 'agentcast-coordination-v1',
  issuedAt: 1_900_000_000_000,
  nonce: '217a5c95-ec90-4f92-8cb4-6317fec11dbf',
};

describe('approval assertions', () => {
  it('binds every approval field with an HMAC', async () => {
    const signature = await signAgentCastApprovalAssertion('approval-secret', assertion);
    expect(await verifyAgentCastApprovalAssertion('approval-secret', assertion, signature)).toBe(true);
    expect(await verifyAgentCastApprovalAssertion('approval-secret', { ...assertion, subject: 'attacker' }, signature)).toBe(false);
    expect(await verifyAgentCastApprovalAssertion('other-secret', assertion, signature)).toBe(false);
  });
});
