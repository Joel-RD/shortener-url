import { limitAuthButton, redirectRateLimit, shortenRateLimit } from '../../../src/utils/limitClick';

describe('Rate Limit Utils', () => {
    it('should export middleware functions', () => {
        expect(typeof shortenRateLimit).toBe('function');
        expect(typeof redirectRateLimit).toBe('function');
        expect(typeof limitAuthButton).toBe('function');
    });
});
