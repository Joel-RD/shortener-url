import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { config } from '../../../src/config';

const emailServiceMock = {
    sendVerificationEmail: jest.fn().mockResolvedValue({ messageId: '1' })
};

jest.unstable_mockModule('../../../src/services/sendEmails.js', () => ({
    emailService: emailServiceMock
}));

type AuthServiceModule = typeof import('../../../src/services/authService.js');

let AuthService: AuthServiceModule['AuthService'];

beforeAll(async () => {
    ({ AuthService } = await import('../../../src/services/authService.js'));
});

describe('AuthService', () => {
    let repository: {
        checkBlocked: jest.Mock;
        findByEmail: jest.Mock;
        registerAttempt: jest.Mock;
        create: jest.Mock;
        resetAttempts: jest.Mock;
        savedVerificationCode: jest.Mock;
        getActiveVerificationCode: jest.Mock;
        verifyVerificationCode: jest.Mock;
        updateUsedVerificationCode: jest.Mock;
        markEmailVerified: jest.Mock;
        deleteVerificationCode: jest.Mock;
    };
    let service: AuthService;

    const validUser = {
        id: 1,
        username: 'test',
        email: 'test@gmail.com',
        password_hash: '$2b$10$/FsCJX4BvD2uC5D23OLvee/Twvb4sPu2fug7nSkbZZknS8t/IYT3C'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        repository = {
            checkBlocked: jest.fn().mockResolvedValue({ blocked: false, retryAfterMinutes: 0 }),
            findByEmail: jest.fn().mockResolvedValue(null),
            registerAttempt: jest.fn().mockResolvedValue({ blocked: false, attemptsLeft: 5 }),
            create: jest.fn().mockResolvedValue(validUser),
            resetAttempts: jest.fn().mockResolvedValue(undefined),
            savedVerificationCode: jest.fn().mockResolvedValue(undefined),
            getActiveVerificationCode: jest.fn().mockResolvedValue(null),
            verifyVerificationCode: jest.fn().mockResolvedValue(true),
            updateUsedVerificationCode: jest.fn().mockResolvedValue(undefined),
            markEmailVerified: jest.fn().mockResolvedValue(undefined),
            deleteVerificationCode: jest.fn().mockResolvedValue(undefined)
        };
        service = new AuthService(repository as any);
        emailServiceMock.sendVerificationEmail.mockClear();
    });

    describe('register', () => {
        const validInput = { username: 'testuser', email: 'test@gmail.com', password: 'StrongP@ssw0rd!' };

        it('should register a user, save a verification code and send the email', async () => {
            const result = await service.register(validInput);

            expect(result.tempToken).toBeDefined();
            expect(typeof result.tempToken).toBe('string');

            const decoded = jwt.verify(result.tempToken, config.jwtSecret) as jwt.JwtPayload;
            expect(decoded.userEmail).toBe('test@gmail.com');

            expect(repository.create).toHaveBeenCalledWith({
                username: 'testuser',
                email: 'test@gmail.com',
                passwordHash: expect.not.stringMatching(/^testuser$/)
            });
            expect(repository.resetAttempts).toHaveBeenCalledWith('email', 'test@gmail.com');
            expect(repository.savedVerificationCode).toHaveBeenCalledWith('test@gmail.com', expect.any(String));
            expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith('test@gmail.com', expect.any(String));
        });

        it('should throw a 400 AppError when registration data is invalid', async () => {
            await expect(service.register({ username: 'x', email: 'invalid', password: 'weak' }))
                .rejects.toMatchObject({ statusCode: 400, message: 'Los datos de registro no son válidos' });
            expect(repository.findByEmail).not.toHaveBeenCalled();
        });

        it('should normalize the email and username before storing them', async () => {
            await service.register({ username: '  TestUser  ', email: '  Test@Gmail.COM ', password: 'StrongP@ssw0rd!' });

            expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
                username: 'TestUser',
                email: 'test@gmail.com'
            }));
        });

        it('should throw a 429 AppError when the email is blocked', async () => {
            repository.checkBlocked.mockResolvedValue({ blocked: true, retryAfterMinutes: 30 });

            await expect(service.register(validInput)).rejects.toMatchObject({
                statusCode: 429,
                message: expect.stringContaining('Demasiados intentos')
            });
            expect(repository.create).not.toHaveBeenCalled();
        });

        it('should throw a 409 AppError when the email is already registered', async () => {
            repository.findByEmail.mockResolvedValue(validUser);

            await expect(service.register(validInput)).rejects.toMatchObject({
                statusCode: 409,
                message: 'El email ya está registrado'
            });
            expect(repository.registerAttempt).not.toHaveBeenCalled();
            expect(repository.create).not.toHaveBeenCalled();
        });

        it('should delete the code and return 502 when the verification email cannot be sent', async () => {
            emailServiceMock.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP down'));

            await expect(service.register(validInput)).rejects.toMatchObject({
                statusCode: 502,
                code: 'EMAIL_SEND_FAILED'
            });
            expect(repository.deleteVerificationCode).toHaveBeenCalledWith('test@gmail.com');
        });
    });

    describe('login', () => {
        const validInput = { email: 'test@gmail.com', password: 'StrongP@ssw0rd!' };

        beforeEach(() => {
            repository.findByEmail.mockResolvedValue(validUser);
            repository.getActiveVerificationCode.mockResolvedValue(null);
        });

        it('should login and return a temp token and the user', async () => {
            const result = await service.login(validInput);

            expect(result.user).toEqual({ id: 1, username: 'test', email: 'test@gmail.com' });
            expect(typeof result.tempToken).toBe('string');
            expect(repository.resetAttempts).toHaveBeenCalledWith('email', 'test@gmail.com');
            expect(repository.resetAttempts).toHaveBeenCalledWith('password', 'test@gmail.com');
            expect(repository.savedVerificationCode).toHaveBeenCalledWith('test@gmail.com', expect.any(String));
            expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalled();
        });

        it('should throw a 401 AppError for invalid credentials format', async () => {
            await expect(service.login({ email: 'invalid-email', password: 'x' }))
                .rejects.toMatchObject({ statusCode: 401 });
            expect(repository.findByEmail).not.toHaveBeenCalled();
        });

        it('should throw a 429 AppError when the email is blocked', async () => {
            repository.checkBlocked.mockResolvedValue({ blocked: true, retryAfterMinutes: 30 });

            await expect(service.login(validInput)).rejects.toMatchObject({ statusCode: 429 });
        });

        it('should throw a 401 AppError with a generic message when the email is not found', async () => {
            repository.findByEmail.mockResolvedValue(null);

            await expect(service.login(validInput)).rejects.toMatchObject({
                statusCode: 401,
                message: 'Credenciales no válidas',
                code: 'INVALID_CREDENTIALS'
            });
        });

        it('should throw a 429 AppError when the password scope is blocked', async () => {
            repository.checkBlocked.mockResolvedValueOnce({ blocked: false, retryAfterMinutes: 0 });
            repository.checkBlocked.mockResolvedValueOnce({ blocked: true, retryAfterMinutes: 45 });

            await expect(service.login(validInput)).rejects.toMatchObject({ statusCode: 429 });
        });

        it('should throw a 401 AppError and register a password attempt on wrong password', async () => {
            const otherUser = { ...validUser, password_hash: '$2b$10$HsTsYyRqLv3v2A4x9zN8Ue9cN6oO7fD1jK2mS5tX3nZ0qL4pW7eB6' };
            repository.findByEmail.mockResolvedValue(otherUser);

            await expect(service.login(validInput)).rejects.toMatchObject({
                statusCode: 401,
                message: 'Credenciales no válidas'
            });
            expect(repository.registerAttempt).toHaveBeenCalledWith('password', 'test@gmail.com');
            expect(repository.registerAttempt).toHaveBeenCalledWith('email', 'test@gmail.com');
        });

        it('should throw a 429 AppError when there is an active verification code', async () => {
            repository.getActiveVerificationCode.mockResolvedValue({ expires_at: new Date(Date.now() + 60000).toISOString() });

            await expect(service.login(validInput)).rejects.toMatchObject({
                statusCode: 429,
                message: 'Ya hay un código de verificación activo.'
            });
        });
    });

    describe('verifyEmailCode', () => {
        const validInput = { email: 'test@gmail.com', code: 'ABC123' };

        beforeEach(() => {
            repository.findByEmail.mockResolvedValue(validUser);
        });

        it('should verify the code and return an auth token', async () => {
            const result = await service.verifyEmailCode(validInput);

            expect(typeof result.authToken).toBe('string');
            const decoded = jwt.verify(result.authToken, config.jwtSecret) as jwt.JwtPayload;
            expect(decoded.userEmail).toBe('test@gmail.com');

            expect(repository.resetAttempts).toHaveBeenCalledWith('code', 'test@gmail.com');
            expect(repository.updateUsedVerificationCode).toHaveBeenCalledWith('test@gmail.com');
            expect(repository.markEmailVerified).toHaveBeenCalledWith('test@gmail.com');
        });

        it('should throw a 429 AppError when the code scope is blocked', async () => {
            repository.checkBlocked.mockResolvedValue({ blocked: true, retryAfterMinutes: 20 });

            await expect(service.verifyEmailCode(validInput)).rejects.toMatchObject({ statusCode: 429 });
            expect(repository.verifyVerificationCode).not.toHaveBeenCalled();
        });

        it('should throw a 400 AppError when the email is not found', async () => {
            repository.findByEmail.mockResolvedValue(null);

            await expect(service.verifyEmailCode(validInput)).rejects.toMatchObject({
                statusCode: 400,
                message: 'Código de verificación incorrecto'
            });
        });

        it('should throw a 400 AppError and register an attempt on wrong code', async () => {
            repository.verifyVerificationCode.mockResolvedValue(false);

            await expect(service.verifyEmailCode(validInput)).rejects.toMatchObject({
                statusCode: 400,
                message: 'Código de verificación incorrecto'
            });
            expect(repository.registerAttempt).toHaveBeenCalledWith('code', 'test@gmail.com');
            expect(repository.markEmailVerified).not.toHaveBeenCalled();
        });

        it('should normalize the email and code before verifying', async () => {
            await service.verifyEmailCode({ email: ' Test@Gmail.com ', code: ' abc123 ' });

            expect(repository.verifyVerificationCode).toHaveBeenCalledWith('test@gmail.com', 'ABC123');
        });
    });
});