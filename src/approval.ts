export interface AgentCastApprovalAssertion {
  controllerSessionId: string;
  operation: string;
  input: unknown;
  subject: string;
  browserSessionId: string;
  platformSessionExpiresAt: number;
  approvalExpiresAt: number;
  policyVersion: string;
  issuedAt: number;
  nonce: string;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

function encodeBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function signAgentCastApprovalAssertion(secret: string, assertion: AgentCastApprovalAssertion): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(canonicalize(assertion)));
  return encodeBase64url(new Uint8Array(signature));
}

export async function verifyAgentCastApprovalAssertion(secret: string, assertion: AgentCastApprovalAssertion, signature: string): Promise<boolean> {
  try {
    return crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret, 'verify'),
      decodeBase64url(signature),
      new TextEncoder().encode(canonicalize(assertion)),
    );
  } catch {
    return false;
  }
}
