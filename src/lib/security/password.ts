/**
 * Password Policy & Role Validation
 */

export const ALLOWED_PROVISION_ROLES = [
  'MASTER_LAB_ADMIN',
  'HOD',
  'PRINCIPAL',
] as const;

export type ProvisionRole = (typeof ALLOWED_PROVISION_ROLES)[number];

export function isAllowedProvisionRole(role: string): role is ProvisionRole {
  return (ALLOWED_PROVISION_ROLES as readonly string[]).includes(role);
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < 10) {
    errors.push('Password must be at least 10 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number.');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)) {
    errors.push('Password must contain at least one special character.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
