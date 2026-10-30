import { jest } from '@jest/globals';
import { UrlService } from '../../../src/services/urlService';
import { ShortUrlCollisionError } from '../../../src/repository/urlRepository';
import { AppError } from '../../../src/utils/AppError';

describe('UrlService', () => {
    let repository: {
        findById: jest.Mock;
        create: jest.Mock;
        incrementViews: jest.Mock;
    };
    let service: UrlService;

    beforeEach(() => {
        repository = {
            findById: jest.fn(),
            create: jest.fn(),
            incrementViews: jest.fn().mockResolvedValue(undefined)
        };
        service = new UrlService(repository as any);
    });

    describe('shorten', () => {
        it('should create the short url and return the generated id', async () => {
            repository.create.mockResolvedValue('abc12345');

            const result = await service.shorten('https://www.google.com');

            expect(result).toBe('abc12345');
            expect(repository.create).toHaveBeenCalledWith(
                expect.stringMatching(/^[A-Za-z0-9_-]{8}$/),
                'https://www.google.com'
            );
        });

        it('should trim the original url before storing it', async () => {
            repository.create.mockResolvedValue('abc12345');

            await service.shorten('  https://www.google.com  ');

            expect(repository.create).toHaveBeenCalledWith(expect.any(String), 'https://www.google.com');
        });

        it('should throw a 400 AppError for a non-permitted url', async () => {
            await expect(service.shorten('ftp://example.com')).rejects.toMatchObject({
                statusCode: 400,
                message: 'URL no permitida'
            });
            expect(repository.create).not.toHaveBeenCalled();
        });

        it('should throw a 400 AppError when the url is missing', async () => {
            await expect(service.shorten(undefined as unknown as string)).rejects.toMatchObject({
                statusCode: 400,
                code: 'URL_REQUIRED'
            });
            expect(repository.create).not.toHaveBeenCalled();
        });

        it('should retry when the generated short id collides', async () => {
            repository.create
                .mockRejectedValueOnce(new ShortUrlCollisionError('abc12345'))
                .mockResolvedValueOnce('def67890');

            const result = await service.shorten('https://www.google.com');

            expect(result).toBe('def67890');
            expect(repository.create).toHaveBeenCalledTimes(2);
        });

        it('should propagate repository errors', async () => {
            repository.create.mockRejectedValue(new Error('Error creando la URL en el repositorio: DB Error'));

            await expect(service.shorten('https://www.google.com')).rejects.toThrow('Error creando la URL');
        });
    });

    describe('redirect', () => {
        it('should return the original url when found and valid', async () => {
            repository.findById.mockResolvedValue('https://www.google.com');

            const result = await service.redirect('abc12345');

            expect(result).toBe('https://www.google.com');
            expect(repository.findById).toHaveBeenCalledWith('abc12345');
            expect(repository.incrementViews).toHaveBeenCalledWith('abc12345');
        });

        it('should throw a 400 AppError for an empty or malformed short url', async () => {
            await expect(service.redirect('')).rejects.toMatchObject({ statusCode: 400 });
            await expect(service.redirect(undefined as unknown as string)).rejects.toMatchObject({ statusCode: 400 });
            await expect(service.redirect('bad!')).rejects.toMatchObject({ statusCode: 400 });
            expect(repository.findById).not.toHaveBeenCalled();
        });

        it('should throw a 404 AppError when the short url is not found', async () => {
            repository.findById.mockResolvedValue(null);

            const error = service.redirect('notfound');
            await expect(error).rejects.toBeInstanceOf(AppError);
            await expect(error).rejects.toMatchObject({ statusCode: 404, message: 'URL acortada no encontrada.' });
        });

        it('should throw a 410 AppError when the stored url is not allowed anymore', async () => {
            repository.findById.mockResolvedValue('http://10.0.0.1');

            await expect(service.redirect('abc12345')).rejects.toMatchObject({
                statusCode: 410,
                message: 'URL de destino no permitida.'
            });
        });
    });
});
