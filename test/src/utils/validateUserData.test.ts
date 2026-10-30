import { validateEmail, validatePassword, validateRegistration, validateDomain } from '../../../src/utils/validateUserData';

describe('validateUserData', () => {
    describe('validateEmail', () => {
        it('should return valid for allowed domains', () => {
            expect(validateEmail('test@gmail.com').isValid).toBe(true);
            expect(validateEmail('user@outlook.com').isValid).toBe(true);
        });

        it('should accept valid domain formats', () => {
            const result = validateEmail('test@randomdomain.com');
            expect(result.isValid).toBe(true);
        });

        it('should return invalid for malformed emails', () => {
            expect(validateEmail('invalid-email').isValid).toBe(false);
            expect(validateEmail('test@.com').isValid).toBe(false);
        });
    });

    describe('validatePassword', () => {
        it('should return valid for strong passwords', () => {
            const result = validatePassword('StrongP@ssw0rd!');
            expect(result.isValid).toBe(true);
            expect(result.strength).toMatch(/fuerte|muy fuerte/);
        });

        it('should return invalid for weak passwords', () => {
            const result = validatePassword('weak');
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should require special characters', () => {
            const result = validatePassword('Password123456');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Debe contener al menos un carácter especial (!@#$%^&*...)');
        });
    });

    describe('validateRegistration', () => {
        it('should return valid for correct registration data', () => {
            const data = {
                username: 'testuser',
                email: 'test@gmail.com',
                password: 'StrongP@ssw0rd!',
                name: 'Test',
                lastName: 'User'
            };
            const result = validateRegistration(data);
            expect(result.isValid).toBe(true);
        });

        it('should aggregate errors from email and password validation', () => {
            const data = {
                email: 'invalid-email',
                password: 'weak',
            };
            const result = validateRegistration(data);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1); // At least one for email and one for password
        });
    });

    describe('validateDomain', () => {
        it('should accept valid public http/https URLs', () => {
            expect(validateDomain('https://www.google.com').isValid).toBe(true);
            expect(validateDomain('http://example.com/path?q=1').isValid).toBe(true);
            expect(validateDomain('https://sub.domain.co.uk:8080').isValid).toBe(true);
        });

        it('should reject empty or non-string values', () => {
            expect(validateDomain('').isValid).toBe(false);
            expect(validateDomain('   ').isValid).toBe(false);
            expect(validateDomain(null as unknown as string).isValid).toBe(false);
            expect(validateDomain(undefined as unknown as string).isValid).toBe(false);
        });

        it('should reject URLs longer than 2048 characters', () => {
            const longUrl = `https://example.com/${'a'.repeat(2048)}`;
            const result = validateDomain(longUrl);
            expect(result.isValid).toBe(false);
        });

        it('should reject URLs with whitespace or control characters', () => {
            expect(validateDomain('https://exa mple.com').isValid).toBe(false);
            expect(validateDomain('https://example.com/\n').isValid).toBe(false);
        });

        it('should reject backslashes', () => {
            expect(validateDomain('https://example.com\\path').isValid).toBe(false);
        });

        it('should reject malformed URLs and non-http(s) schemes', () => {
            expect(validateDomain('not-a-url').isValid).toBe(false);
            expect(validateDomain('ftp://example.com').isValid).toBe(false);
            expect(validateDomain('javascript:alert(1)').isValid).toBe(false);
            expect(validateDomain('http://').isValid).toBe(false);
        });

        it('should reject URLs with embedded credentials', () => {
            const result = validateDomain('https://user:pass@example.com');
            expect(result.isValid).toBe(false);
        });

        it('should reject private and reserved IPv4 addresses', () => {
            expect(validateDomain('http://10.0.0.1').isValid).toBe(false);
            expect(validateDomain('http://192.168.1.1').isValid).toBe(false);
            expect(validateDomain('http://172.16.0.1').isValid).toBe(false);
            expect(validateDomain('http://127.0.0.1').isValid).toBe(false);
            expect(validateDomain('http://169.254.0.1').isValid).toBe(false);
            expect(validateDomain('http://0.0.0.0').isValid).toBe(false);
            expect(validateDomain('http://100.64.0.1').isValid).toBe(false);
            expect(validateDomain('http://224.0.0.1').isValid).toBe(false);
        });

        it('should reject private IPv6 addresses but accept public ones', () => {
            expect(validateDomain('http://[::1]').isValid).toBe(false);
            expect(validateDomain('http://[fc00::1]').isValid).toBe(false);
            expect(validateDomain('http://[fe80::1]').isValid).toBe(false);
            expect(validateDomain('http://[2001:db8::1]').isValid).toBe(true);
        });

        it('should reject local or internal hostnames', () => {
            expect(validateDomain('http://localhost').isValid).toBe(false);
            expect(validateDomain('http://localhost.localdomain').isValid).toBe(false);
            expect(validateDomain('http://app.localhost').isValid).toBe(false);
            expect(validateDomain('http://site.local').isValid).toBe(false);
            expect(validateDomain('http://site.internal').isValid).toBe(false);
        });

        it('should reject IPs encoded as decimal or hex', () => {
            expect(validateDomain('http://2130706433').isValid).toBe(false);
            expect(validateDomain('http://0x7f000001').isValid).toBe(false);
        });

        it('should reject invalid domains and TLDs', () => {
            expect(validateDomain('http://-bad.com').isValid).toBe(false);
            expect(validateDomain('http://bad-.com').isValid).toBe(false);
            expect(validateDomain('http://example..com').isValid).toBe(false);
            expect(validateDomain('http://example.c').isValid).toBe(false);
            expect(validateDomain('http://exa_mple.com').isValid).toBe(false);
        });

        it('should reject an overly long hostname', () => {
            const longHost = `http://${'a'.repeat(254)}.com`;
            expect(validateDomain(longHost).isValid).toBe(false);
        });
    });
});
