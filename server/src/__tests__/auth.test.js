const authService = require('../services/auth');

describe('AuthService - validatePasswordStrength', () => {
  test('should accept valid password with all requirements', () => {
    const result = authService.validatePasswordStrength('Password123!');
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  test('should accept password with various special characters', () => {
    const passwords = [
      'Password123!',
      'Password123@',
      'Password123#',
      'Password123$',
      'Password123%',
      'Password123^',
      'Password123&',
      'Password123*',
      'Password123(',
      'Password123)',
      'Password123.',
      'Password123,',
      'Password123?',
      'Password123:',
      'Password123"',
      'Password123{',
      'Password123}',
      'Password123|',
      'Password123<',
      'Password123>'
    ];

    passwords.forEach(password => {
      const result = authService.validatePasswordStrength(password);
      expect(result.valid).toBe(true);
    });
  });

  test('should reject password missing uppercase letter', () => {
    const result = authService.validatePasswordStrength('password123!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one uppercase letter');
  });

  test('should reject password missing lowercase letter', () => {
    const result = authService.validatePasswordStrength('PASSWORD123!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one lowercase letter');
  });

  test('should reject password missing number', () => {
    const result = authService.validatePasswordStrength('Password!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one number');
  });

  test('should reject password missing special character', () => {
    const result = authService.validatePasswordStrength('Password123');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one special character (!@#$%^&*)');
  });

  test('should reject password that is too short', () => {
    const result = authService.validatePasswordStrength('Pass1!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters long');
  });

  test('should reject password with exactly 7 characters', () => {
    const result = authService.validatePasswordStrength('Pass12!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters long');
  });

  test('should accept password with exactly 8 characters', () => {
    const result = authService.validatePasswordStrength('Pass123!');
    expect(result.valid).toBe(true);
  });

  test('should reject null password', () => {
    const result = authService.validatePasswordStrength(null);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters long');
  });

  test('should reject undefined password', () => {
    const result = authService.validatePasswordStrength(undefined);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters long');
  });

  test('should reject empty string password', () => {
    const result = authService.validatePasswordStrength('');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters long');
  });

  test('should accept long password with all requirements', () => {
    const result = authService.validatePasswordStrength('ThisIsAVeryLongPassword123!WithManyCharacters');
    expect(result.valid).toBe(true);
  });

  test('should check requirements in order - length first', () => {
    const result = authService.validatePasswordStrength('short');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters long');
  });

  test('should check uppercase after length', () => {
    const result = authService.validatePasswordStrength('password1!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one uppercase letter');
  });

  test('should check lowercase after uppercase', () => {
    const result = authService.validatePasswordStrength('PASSWORD1!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one lowercase letter');
  });

  test('should check number after lowercase', () => {
    const result = authService.validatePasswordStrength('Password!');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one number');
  });

  test('should check special character last', () => {
    const result = authService.validatePasswordStrength('Password123');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must contain at least one special character (!@#$%^&*)');
  });
});
