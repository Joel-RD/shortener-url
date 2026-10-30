import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../src/controllers/authController';
import { AppError } from '../../../src/utils/AppError';

function expectAppError(next: jest.Mock, statusCode: number, message: string) {
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(statusCode);
    expect(err.message).toBe(message);
}

describe('AuthController', () => {
    let authService: {
        register: jest.Mock;
        login: jest.Mock;
        verifyEmailCode: jest.Mock;
    };
    let controller: AuthController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
        authService = {
            register: jest.fn().mockResolvedValue({ tempToken: 'temp-token-123' }),
            login: jest.fn().mockResolvedValue({ tempToken: 'temp-token-123', user: { id: 1, username: 'test', email: 'test@gmail.com' } }),
            verifyEmailCode: jest.fn().mockResolvedValue({ authToken: 'auth-token-123' })
        };
        controller = new AuthController(authService as any);
        req = { body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            cookie: jest.fn(),
            clearCookie: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('authRegisterController', () => {
        it('should return 400 when required fields are missing', async () => {
            req.body = {};

            await controller.authRegisterController(req as Request, res as Response, next);

            expectAppError(next, 400, 'El nombre de usuario, el email y la contraseña son obligatorios');
            expect(res.json).not.toHaveBeenCalled();
            expect(authService.register).not.toHaveBeenCalled();
        });

        it('should return 400 when the body is undefined', async () => {
            req.body = undefined;

            await controller.authRegisterController(req as Request, res as Response, next);

            expectAppError(next, 400, 'El nombre de usuario, el email y la contraseña son obligatorios');
            expect(authService.register).not.toHaveBeenCalled();
        });

        it('should register the user and set the verification cookie', async () => {
            req.body = { username: 'test', email: 'test@gmail.com', password: 'StrongP@ssw0rd!' };

            await controller.authRegisterController(req as Request, res as Response, next);

            expect(authService.register).toHaveBeenCalledWith({
                username: 'test',
                email: 'test@gmail.com',
                password: 'StrongP@ssw0rd!'
            });
            expect(res.cookie).toHaveBeenCalledWith(
                'emailSendToVerifyUser',
                expect.stringContaining('temp-token-123'),
                expect.objectContaining({ maxAge: 2 * 60 * 1000 })
            );
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Usuario creado correctamente, código enviado al email'
            });
        });
    });

    describe('authLoginController', () => {
        it('should return 400 when required fields are missing', async () => {
            req.body = {};

            await controller.authLoginController(req as Request, res as Response, next);

            expectAppError(next, 400, 'El email y la contraseña son obligatorios');
            expect(res.json).not.toHaveBeenCalled();
            expect(authService.login).not.toHaveBeenCalled();
        });

        it('should return 400 when the body is undefined', async () => {
            req.body = undefined;

            await controller.authLoginController(req as Request, res as Response, next);

            expectAppError(next, 400, 'El email y la contraseña son obligatorios');
            expect(authService.login).not.toHaveBeenCalled();
        });

        it('should login and set the verification cookie with the user', async () => {
            req.body = { email: 'test@gmail.com', password: 'StrongP@ssw0rd!' };

            await controller.authLoginController(req as Request, res as Response, next);

            expect(authService.login).toHaveBeenCalledWith({
                email: 'test@gmail.com',
                password: 'StrongP@ssw0rd!'
            });
            expect(res.cookie).toHaveBeenCalledWith(
                'emailSendToVerifyUser',
                expect.stringContaining('temp-token-123'),
                expect.objectContaining({ maxAge: 2 * 60 * 1000 })
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Inicio de sesión correcto, código enviado al email',
                data: {
                    user: { id: 1, username: 'test', email: 'test@gmail.com' }
                }
            });
        });
    });

    describe('postAuthVerifyEmailController', () => {
        it('should return 400 when email or code are missing', async () => {
            req.body = { email: 'test@gmail.com' };

            await controller.postAuthVerifyEmailController(req as Request, res as Response, next);

            expectAppError(next, 400, 'El código y el email son obligatorios');
            expect(res.json).not.toHaveBeenCalled();
            expect(authService.verifyEmailCode).not.toHaveBeenCalled();
        });

        it('should verify the code and return the auth token in the body', async () => {
            req.body = { email: 'test@gmail.com', code: 'ABC123' };

            await controller.postAuthVerifyEmailController(req as Request, res as Response, next);

            expect(authService.verifyEmailCode).toHaveBeenCalledWith({ email: 'test@gmail.com', code: 'ABC123' });
            expect(res.clearCookie).toHaveBeenCalledWith(
                'emailSendToVerifyUser',
                expect.objectContaining({ path: '/' })
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Inicio de sesión correcto.',
                data: { authToken: 'auth-token-123' }
            });
        });
    });
});