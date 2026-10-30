import { jest } from '@jest/globals';

const sendMailMock = jest.fn();

jest.unstable_mockModule('../../../src/utils/configEmailTransport.js', () => ({
    transport: { sendMail: sendMailMock }
}));

jest.unstable_mockModule('../../../src/utils/logger.js', () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

type SendEmailsModule = typeof import('../../../src/services/sendEmails.js');

let emailService: SendEmailsModule['emailService'];
let mockedLogger: { error: jest.Mock };

beforeAll(async () => {
    ({ emailService } = await import('../../../src/services/sendEmails.js'));
    mockedLogger = (await import('../../../src/utils/logger.js')).default as unknown as { error: jest.Mock };
});

describe('EmailService (emailService instance)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should send a verification email with the code in the payload', async () => {
        sendMailMock.mockResolvedValue({ messageId: '1' });

        const result = await emailService.sendVerificationEmail('user@example.com', 'ABC123');

        expect(result).toEqual({ messageId: '1' });
        expect(sendMailMock).toHaveBeenCalledWith({
            from: expect.stringContaining('ERDL URL Shortener'),
            to: 'user@example.com',
            subject: 'Verifica tu correo electrónico',
            text: 'Tu código de verificación es: ABC123',
            html: expect.stringContaining('ABC123')
        });
    });

    it('should log and rethrow when sending fails', async () => {
        sendMailMock.mockRejectedValue(new Error('SMTP error'));

        await expect(emailService.sendVerificationEmail('user@example.com', 'ABC123')).rejects.toThrow('SMTP error');
        expect(mockedLogger.error).toHaveBeenCalled();
    });
});