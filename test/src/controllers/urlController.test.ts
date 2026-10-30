import { jest } from '@jest/globals';
import { Request, Response } from 'express';
import { UrlController } from '../../../src/controllers/urlController';

describe('UrlController', () => {
    let urlService: {
        shorten: jest.Mock;
        redirect: jest.Mock;
    };
    let controller: UrlController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        urlService = {
            shorten: jest.fn().mockResolvedValue('abc12345'),
            redirect: jest.fn().mockResolvedValue('https://www.google.com')
        };
        controller = new UrlController(urlService as any);
        req = { body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            redirect: jest.fn()
        };
        jest.clearAllMocks();
    });

    describe('shortenerController', () => {
        it('should shorten the url and respond with the shortened url', async () => {
            req.body = { orig_url: 'https://www.google.com' };

            await controller.shortenerController(req as Request, res as Response);

            expect(urlService.shorten).toHaveBeenCalledWith('https://www.google.com');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'URL acortada con éxito.',
                data: {
                    url_acortada: 'http://localhost:3000/abc12345'
                }
            });
        });
    });

    describe('redirectShortController', () => {
        it('should redirect to the original url', async () => {
            req.params = { shortUrl: 'abc12345' };

            await controller.redirectShortController(req as Request, res as Response);

            expect(urlService.redirect).toHaveBeenCalledWith('abc12345');
            expect(res.redirect).toHaveBeenCalledWith(302, 'https://www.google.com');
        });
    });
});