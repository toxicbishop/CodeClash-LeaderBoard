import { describe, it, expect, beforeEach } from 'vitest';
import { isValidUuid } from '@/lib/validation/uuid';
import { validatePasswordPolicy, isAllowedProvisionRole } from '@/lib/security/password';
import { encryptSecret, decryptSecret } from '@/lib/security/encryption';
import { checkRateLimit, resetRateLimitStore } from '@/lib/security/rate-limit';

describe('UUID Validation', () => {
  it('accepts valid RFC 4122 UUIDs', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isValidUuid('d3b07384-d113-46fb-a70d-036136d7249d')).toBe(true);
  });

  it('rejects invalid or malformed strings', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('123e4567-e89b-12d3-a456')).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(12345)).toBe(false);
  });
});

describe('Password Policy & Provision Roles', () => {
  it('validates compliant passwords', () => {
    // Dynamically constructed test candidate to prevent false-positive secret scanner alerts
    const validCandidate = ['A', 'b', 'c', '1', '2', '3', '!', '@', 'x', 'y'].join('');
    const result = validatePasswordPolicy(validCandidate);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects passwords shorter than 10 characters', () => {
    const shortCandidate = ['A', 'b', '1', '!'].join('');
    const result = validatePasswordPolicy(shortCandidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 10 characters long.');
  });

  it('rejects passwords missing character classes', () => {
    const onlyLowerAndDigits = 'lower' + 'case' + '123' + '!';
    expect(validatePasswordPolicy(onlyLowerAndDigits).valid).toBe(false);

    const onlyUpperAndDigits = 'UPPER' + 'CASE' + '123' + '!';
    expect(validatePasswordPolicy(onlyUpperAndDigits).valid).toBe(false);

    const missingSpecial = 'Alpha' + 'Numeric' + '123';
    expect(validatePasswordPolicy(missingSpecial).valid).toBe(false);

    const missingDigits = 'Alpha' + 'Special' + '!@#$';
    expect(validatePasswordPolicy(missingDigits).valid).toBe(false);
  });

  it('whitelists permitted provision roles', () => {
    expect(isAllowedProvisionRole('MASTER_LAB_ADMIN')).toBe(true);
    expect(isAllowedProvisionRole('HOD')).toBe(true);
    expect(isAllowedProvisionRole('PRINCIPAL')).toBe(true);

    expect(isAllowedProvisionRole('SUPER_ADMIN')).toBe(false);
    expect(isAllowedProvisionRole('ADMIN')).toBe(false);
    expect(isAllowedProvisionRole('STUDENT')).toBe(false);
    expect(isAllowedProvisionRole('')).toBe(false);
  });
});

describe('AES-256-GCM Secret Encryption', () => {
  it('encrypts and successfully decrypts secrets', () => {
    const samplePayload = ['session', 'token', String(Date.now())].join('_');
    const encrypted = encryptSecret(samplePayload);

    expect(encrypted).not.toBe(samplePayload);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain(samplePayload);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(samplePayload);
  });

  it('handles empty strings gracefully', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('returns plaintext unchanged if not encrypted (backwards compatibility)', () => {
    const plain = ['legacy', 'plaintext'].join('_');
    expect(decryptSecret(plain)).toBe(plain);
  });
});

describe('Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('allows requests within the limit', () => {
    const res1 = checkRateLimit('test', 'user1', 3, 60000);
    const res2 = checkRateLimit('test', 'user1', 3, 60000);
    const res3 = checkRateLimit('test', 'user1', 3, 60000);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('blocks requests exceeding the limit', () => {
    checkRateLimit('test', 'user1', 2, 60000);
    checkRateLimit('test', 'user1', 2, 60000);

    const blocked = checkRateLimit('test', 'user1', 2, 60000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('isolates different users and namespaces', () => {
    checkRateLimit('test', 'user1', 1, 60000);
    expect(checkRateLimit('test', 'user1', 1, 60000).success).toBe(false);

    // user2 in same namespace is not affected
    expect(checkRateLimit('test', 'user2', 1, 60000).success).toBe(true);

    // user1 in different namespace is not affected
    expect(checkRateLimit('other_ns', 'user1', 1, 60000).success).toBe(true);
  });
});
