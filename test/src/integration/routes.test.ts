import request from 'supertest';
import app from '../../../src/main';

describe('API integration', () => {
    it('should return a JSON 404 for unknown single-segment routes', async () => {
        const response = await request(app).get('/favicon.ico');

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
            success: false,
            error: { code: 'NOT_FOUND' }
        });
    });

    it('should return 404 for a well-formed but unknown short url', async () => {
        const response = await request(app).get('/abcdefgh');

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
            success: false,
            error: { code: 'SHORT_URL_NOT_FOUND' }
        });
    });

    it('should shorten a valid url and redirect it', async () => {
        const created = await request(app)
            .post('/api/v1/short')
            .send({ orig_url: 'https://www.example.com/some/path' });

        expect(created.status).toBe(200);
        expect(created.body.success).toBe(true);

        const shortUrl = created.body.data.url_acortada as string;
        expect(shortUrl).toMatch(/^http:\/\/localhost:3000\/[A-Za-z0-9_-]{8}$/);

        const id = shortUrl.split('/').pop();
        const redirected = await request(app).get(`/${id}`);

        expect(redirected.status).toBe(302);
        expect(redirected.headers.location).toBe('https://www.example.com/some/path');
    });

    it('should reject a non-permitted url', async () => {
        const response = await request(app)
            .post('/api/v1/short')
            .send({ orig_url: 'http://127.0.0.1/private' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('URL_NOT_ALLOWED');
    });

    it('should return 400 for malformed JSON bodies', async () => {
        const response = await request(app)
            .post('/api/v1/short')
            .set('Content-Type', 'application/json')
            .send('{"orig_url": ');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_JSON');
    });

    it('should require authentication for protected routes', async () => {
        const response = await request(app).get('/api/v1/auth/user/profile');

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('TOKEN_MISSING');
    });

    it('should validate registration fields', async () => {
        const response = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'test@example.com' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('MISSING_REGISTRATION_FIELDS');
    });
});
