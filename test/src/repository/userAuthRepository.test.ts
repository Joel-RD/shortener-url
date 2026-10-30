import { jest } from '@jest/globals';
import { Client } from '@libsql/client';

jest.unstable_mockModule('../../../src/utils/logger.js', () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

type AuthRepositoryModule = typeof import('../../../src/repository/authRepository.js');

let AuthRepository: AuthRepositoryModule['AuthRepository'];
let mockedLogger: { error: jest.Mock; info: jest.Mock; warn: jest.Mock };

beforeAll(async () => {
    ({ AuthRepository } = await import('../../../src/repository/authRepository.js'));
    mockedLogger = (await import('../../../src/utils/logger.js')).default as unknown as { error: jest.Mock; info: jest.Mock; warn: jest.Mock };
});

describe('AuthRepository', () => {
    let repository: InstanceType<AuthRepositoryModule['AuthRepository']>;
    let mockExecute: jest.Mock;
    let mockClient: Client;

    beforeEach(() => {
        jest.clearAllMocks();
        mockExecute = jest.fn();
        mockClient = {
            execute: mockExecute
        } as unknown as Client;
        repository = new AuthRepository(mockClient);
    });

    describe('findByEmail', () => {
        it('should return user if found', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            mockExecute.mockResolvedValue({ rows: [mockUser] });

            const result = await repository.findByEmail('test@example.com');
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('SELECT * FROM users'),
                args: ['test@example.com']
            }));
            expect(result).toEqual(mockUser);
        });

        it('should return null if user not found', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            const result = await repository.findByEmail('notfound@example.com');
            expect(result).toBeNull();
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.findByEmail('test@example.com')).rejects.toThrow('Error search user by email');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('should return the created user on success', async () => {
            const mockUser = { id: 1, username: 'test', email: 'test@test.com', password_hash: 'hash' };
            mockExecute.mockResolvedValue({ rows: [mockUser] });
            const newUser = { username: 'test', email: 'test@test.com', passwordHash: 'hash' };

            const result = await repository.create(newUser);
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('INSERT INTO users'),
                args: ['test', 'test@test.com', 'hash']
            }));
            expect(result).toEqual(mockUser);
        });

        it('should throw if the created user cannot be found afterwards', async () => {
            mockExecute
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            await expect(repository.create({ username: 'a', email: 'a@a.com', passwordHash: 'h' }))
                .rejects.toThrow('Usuario no encontrado después de la inserción');
        });

        it('should throw if creation fails', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.create({} as any)).rejects.toThrow('Error creating user in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('savedVerificationCode', () => {
        it('should insert the verification code with upsert', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            await repository.savedVerificationCode('test@example.com', 'ABC123');

            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('INSERT INTO verification_codes'),
                args: ['test@example.com', 'ABC123']
            }));
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.savedVerificationCode('test@example.com', 'ABC123'))
                .rejects.toThrow('Error saving verification code in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('verifyVerificationCode', () => {
        it('should return true when a matching active code exists', async () => {
            mockExecute.mockResolvedValue({ rows: [{ email: 'test@example.com' }] });

            const result = await repository.verifyVerificationCode('test@example.com', 'ABC123');
            expect(result).toBe(true);
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('SELECT * FROM verification_codes'),
                args: ['test@example.com', 'ABC123']
            }));
        });

        it('should return false when no matching code exists', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            const result = await repository.verifyVerificationCode('test@example.com', 'WRONG');
            expect(result).toBe(false);
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.verifyVerificationCode('test@example.com', 'ABC123'))
                .rejects.toThrow('Error verifying verification code in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('markEmailVerified', () => {
        it('should update the user as verified', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            await repository.markEmailVerified('test@example.com');

            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('UPDATE users SET email_verified = 1'),
                args: ['test@example.com']
            }));
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.markEmailVerified('test@example.com'))
                .rejects.toThrow('Error marking email as verified in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('updateUsedVerificationCode', () => {
        it('should mark the code as used', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            await repository.updateUsedVerificationCode('test@example.com');

            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('UPDATE verification_codes SET used = 1'),
                args: ['test@example.com']
            }));
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.updateUsedVerificationCode('test@example.com'))
                .rejects.toThrow('Error updating used verification code in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('getActiveVerificationCode', () => {
        it('should return the expires_at of the active code', async () => {
            mockExecute.mockResolvedValue({ rows: [{ expires_at: '2026-08-17 12:00:00' }] });

            const result = await repository.getActiveVerificationCode('test@example.com');
            expect(result).toEqual({ expires_at: '2026-08-17 12:00:00' });
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('SELECT * FROM verification_codes'),
                args: ['test@example.com']
            }));
        });

        it('should return null when there is no active code', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            const result = await repository.getActiveVerificationCode('test@example.com');
            expect(result).toBeNull();
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.getActiveVerificationCode('test@example.com'))
                .rejects.toThrow('Error getting active verification code');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('checkBlocked', () => {
        it('should return blocked true with remaining minutes when blocked', async () => {
            mockExecute.mockResolvedValue({ rows: [{ minutes_left: 30 }] });

            const result = await repository.checkBlocked('email', 'test@example.com');
            expect(result).toEqual({ blocked: true, retryAfterMinutes: 30 });
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('email_blocked_until'),
                args: ['test@example.com']
            }));
        });

        it('should return blocked false when not blocked', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            const result = await repository.checkBlocked('email', 'test@example.com');
            expect(result).toEqual({ blocked: false, retryAfterMinutes: 0 });
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.checkBlocked('email', 'test@example.com'))
                .rejects.toThrow('Error checking blocked attempts in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('registerAttempt', () => {
        it('should increment attempts and return remaining attempts', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [{ attempt_count: 2 }] });

            const result = await repository.registerAttempt('email', 'test@example.com');
            expect(result).toEqual({ blocked: false, attemptsLeft: 3 });
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('RETURNING email_attempt_count'),
                args: [5, '+2 hours', 'test@example.com']
            }));
        });

        it('should block when attempts reach the maximum', async () => {
            mockExecute
                .mockResolvedValueOnce({ rows: [{ attempt_count: 5 }] })
                .mockResolvedValueOnce({ rowsAffected: 1 });

            const result = await repository.registerAttempt('email', 'test@example.com');
            expect(result).toEqual({ blocked: true, attemptsLeft: 0 });
            expect(mockExecute).toHaveBeenNthCalledWith(1, expect.objectContaining({
                sql: expect.stringContaining('email_blocked_until')
            }));
            expect(mockExecute).toHaveBeenLastCalledWith(expect.objectContaining({
                sql: expect.stringContaining('email_attempt_count = 0')
            }));
        });

        it('should return full attempts when the user does not exist', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [] });

            const result = await repository.registerAttempt('code', 'nouser@example.com');
            expect(result).toEqual({ blocked: false, attemptsLeft: 5 });
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.registerAttempt('email', 'test@example.com'))
                .rejects.toThrow('Error registering attempt in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });

    describe('resetAttempts', () => {
        it('should reset counters for the given scope', async () => {
            mockExecute.mockResolvedValue({ rows: [] });

            await repository.resetAttempts('password', 'test@example.com');

            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
                sql: expect.stringContaining('password_attempt_count = 0'),
                args: ['test@example.com']
            }));
        });

        it('should throw on database error', async () => {
            mockExecute.mockRejectedValue(new Error('DB Error'));

            await expect(repository.resetAttempts('email', 'test@example.com'))
                .rejects.toThrow('Error resetting attempts in repository');
            expect(mockedLogger.error).toHaveBeenCalled();
        });
    });
});