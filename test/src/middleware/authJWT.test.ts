import { jest } from '@jest/globals';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../src/config';
import { AppError } from '../../../src/utils/AppError';
import { emailValidJWToken, userAuthJWToken } from '../../../src/utils/jwt';

type AuthJWTModule = typeof import('../../../src/middleware/authJWT.js');

let authJWT: AuthJWTModule['authJWT'];
let verifySendToEmail: AuthJWTModule['verifySendToEmail'];
let requireActiveUser: AuthJWTModule['requireActiveUser'];

beforeAll(async () => {
    ({ authJWT, verifySendToEmail, requireActiveUser } = await import('../../../src/middleware/authJWT.js'));
});

const JWT_OPTIONS = { issuer: 'shortener-url', audience: 'shortener-url-api' };

function signToken(payload: Record<string, unknown>, secret: string = config.jwtSecret, options: jwt.SignOptions = {}) {
    return jwt.sign(payload, secret, { ...JWT_OPTIONS, ...options });
}

function expectAppError(next: jest.Mock, statusCode: number, message: string, code?: string) {
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(statusCode);
    expect(err.message).toBe(message);
    if (code !== undefined) {
        expect(err.code).toBe(code);
    }
}

describe('Middleware: authJWT', () => {
    let req: Partial<Request> & { userEmail?: string };
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
        req = {
            headers: {},
            cookies: {},
            body: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('authJWT', () => {
        it('should return 401 if no auth token is provided in the header', async () => {
            await authJWT(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: no se proporcionó token', 'TOKEN_MISSING');
            expect(res.json).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalledWith();
        });

        it('should return 401 if the header does not use the Bearer scheme', async () => {
            req.headers = { authorization: userAuthJWToken('test@example.com') };

            await authJWT(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: no se proporcionó token', 'TOKEN_MISSING');
        });

        it('should call next() and set req.userEmail when the token is valid', async () => {
            req.headers = { authorization: `Bearer ${userAuthJWToken('test@example.com')}` };

            await authJWT(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.userEmail).toBe('test@example.com');
        });

        it('should normalize the email from the token', async () => {
            req.headers = { authorization: `Bearer ${userAuthJWToken('Test@Example.COM')}` };

            await authJWT(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.userEmail).toBe('test@example.com');
        });

        it('should reject an email verification token used as a session token', async () => {
            req.headers = { authorization: `Bearer ${emailValidJWToken('test@example.com')}` };

            await authJWT(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: se requiere un token de sesión', 'TOKEN_TYPE_INVALID');
        });

        it('should reject a token without a typ claim', async () => {
            const legacyToken = signToken({ userEmail: 'test@example.com' });
            req.headers = { authorization: `Bearer ${legacyToken}` };

            await authJWT(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: se requiere un token de sesión', 'TOKEN_TYPE_INVALID');
        });

        it('should return 401 when the token is expired', async () => {
            const expiredToken = signToken({ userEmail: 'test@example.com', typ: 'session' }, config.jwtSecret, { expiresIn: -1 });
            req.headers = { authorization: `Bearer ${expiredToken}` };

            await authJWT(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: token expirado', 'TOKEN_EXPIRED');
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should return 403 when the token signature is invalid', async () => {
            const invalidToken = signToken({ userEmail: 'test@example.com', typ: 'session' }, 'wrong-secret');
            req.headers = { authorization: `Bearer ${invalidToken}` };

            await authJWT(req as Request, res as Response, next);

            expectAppError(next, 403, 'Prohibido: firma de token inválida', 'TOKEN_INVALID');
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should return 403 for a malformed token', async () => {
            req.headers = { authorization: 'Bearer not-a-jwt' };

            await authJWT(req as Request, res as Response, next);

            expectAppError(next, 403, 'Prohibido: firma de token inválida', 'TOKEN_INVALID');
            expect(res.json).not.toHaveBeenCalled();
        });
    });

    describe('verifySendToEmail', () => {
        it('should return 401 if there is no verification session cookie', async () => {
            await verifySendToEmail(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: no hay sesión de verificación', 'VERIFICATION_SESSION_MISSING');
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should return 401 when the cookie is not valid JSON', async () => {
            req.cookies = { emailSendToVerifyUser: '{invalid json' };

            await verifySendToEmail(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: sesión de verificación inválida', 'VERIFICATION_SESSION_INVALID');
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should return 401 when the cookie has no token', async () => {
            req.cookies = { emailSendToVerifyUser: JSON.stringify({}) };

            await verifySendToEmail(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: no hay token de verificación', 'VERIFICATION_TOKEN_MISSING');
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should fail closed when there is no email in the body', async () => {
            req.cookies = { emailSendToVerifyUser: JSON.stringify({ token: emailValidJWToken('test@example.com') }) };
            req.body = {};

            await verifySendToEmail(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: el email es obligatorio', 'EMAIL_REQUIRED');
        });

        it('should call next() when the token matches the body email', async () => {
            req.cookies = { emailSendToVerifyUser: JSON.stringify({ token: emailValidJWToken('test@example.com') }) };
            req.body = { email: 'test@example.com' };

            await verifySendToEmail(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should reject a session token used for email verification', async () => {
            req.cookies = { emailSendToVerifyUser: JSON.stringify({ token: userAuthJWToken('test@example.com') }) };
            req.body = { email: 'test@example.com' };

            await verifySendToEmail(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: se requiere un token de verificación', 'TOKEN_TYPE_INVALID');
        });

        it('should return 403 when the token does not match the body email', async () => {
            req.cookies = { emailSendToVerifyUser: JSON.stringify({ token: emailValidJWToken('test@example.com') }) };
            req.body = { email: 'other@example.com' };

            await verifySendToEmail(req as Request, res as Response, next);

            expectAppError(next, 403, 'Prohibido: el token no corresponde al email indicado', 'TOKEN_EMAIL_MISMATCH');
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should return 403 when the token is invalid', async () => {
            const invalidToken = signToken({ userEmail: 'test@example.com', typ: 'email_verification' }, 'wrong-secret');
            req.cookies = { emailSendToVerifyUser: JSON.stringify({ token: invalidToken }) };
            req.body = { email: 'test@example.com' };

            await verifySendToEmail(req as Request, res as Response, next);

            expectAppError(next, 403, 'Prohibido: firma de token inválida', 'TOKEN_INVALID');
            expect(res.json).not.toHaveBeenCalled();
        });
    });

    describe('requireActiveUser', () => {
        const makeRepository = (user: unknown) => ({
            findByEmail: jest.fn().mockResolvedValue(user)
        });

        it('should return 401 when there is no authenticated user', async () => {
            const middleware = requireActiveUser(makeRepository(null) as any);

            await middleware(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: no se proporcionó token', 'TOKEN_MISSING');
        });

        it('should return 401 when the user no longer exists', async () => {
            req.userEmail = 'test@example.com';
            const middleware = requireActiveUser(makeRepository(null) as any);

            await middleware(req as Request, res as Response, next);

            expectAppError(next, 401, 'No autorizado: usuario no encontrado', 'USER_NOT_FOUND');
        });

        it('should return 403 when the email is not verified', async () => {
            req.userEmail = 'test@example.com';
            const middleware = requireActiveUser(makeRepository({ email_verified: 0, account_active: 1 }) as any);

            await middleware(req as Request, res as Response, next);

            expectAppError(next, 403, 'Prohibido: el email no está verificado', 'EMAIL_NOT_VERIFIED');
        });

        it('should return 403 when the account is inactive', async () => {
            req.userEmail = 'test@example.com';
            const middleware = requireActiveUser(makeRepository({ email_verified: 1, account_active: 0 }) as any);

            await middleware(req as Request, res as Response, next);

            expectAppError(next, 403, 'Prohibido: la cuenta está desactivada', 'ACCOUNT_INACTIVE');
        });

        it('should call next() when the user is active and verified', async () => {
            req.userEmail = 'test@example.com';
            const middleware = requireActiveUser(makeRepository({ email_verified: 1, account_active: 1 }) as any);

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });
        it('should forward repository errors', async () => {
            req.userEmail = 'test@example.com';
            const error = new Error('DB down');
            const middleware = requireActiveUser({ findByEmail: jest.fn().mockRejectedValue(error) } as any);

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });
});
