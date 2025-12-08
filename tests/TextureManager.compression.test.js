
import { TextureManager } from '../src/helpers/TextureManager';
import { TextureLoader, DataTexture } from 'three';

// Mocks
jest.mock('three', () => {
    const originalThree = jest.requireActual('three');
    return {
        ...originalThree,
        TextureLoader: jest.fn().mockImplementation(() => ({
            load: jest.fn()
        })),
    };
});

describe('TextureManager Compression Support', () => {

    let mockCityModel;
    let mockKTX2Loader;
    let mockDDSLoader;
    let mockTextureLoader;

    beforeEach(() => {
        mockCityModel = {
            appearance: {
                textures: [
                    { image: 'texture.png' },
                    { image: 'texture.ktx2' },
                    { image: 'texture.dds' }
                ]
            }
        };

        mockKTX2Loader = {
            load: jest.fn().mockImplementation((url, onLoad) => {
                const tex = { clone: jest.fn(() => ({})) }; // Mock loaded texture with clone
                if (onLoad) onLoad(tex);
                return tex;
            }),
            dispose: jest.fn()
        };

        mockDDSLoader = {
            load: jest.fn().mockImplementation((url, onLoad) => {
                const tex = { clone: jest.fn(() => ({})) }; // Mock loaded texture with clone
                if (onLoad) onLoad(tex);
                return tex;
            }),
            dispose: jest.fn()
        };

        mockTextureLoader = {
            load: jest.fn().mockImplementation((url, onLoad) => {
                const tex = { clone: jest.fn(() => ({})) }; // Mock loaded texture with clone
                if (onLoad) onLoad(tex);
                return tex;
            })
        };

        TextureLoader.mockImplementation(() => mockTextureLoader);
    });

    test('should use TextureLoader for standard formats', () => {
        const textureManager = new TextureManager(mockCityModel);

        expect(TextureLoader).toHaveBeenCalled();
        expect(mockTextureLoader.load).toHaveBeenCalledWith(
            expect.stringContaining('texture.png'),
            expect.any(Function),
            undefined,
            expect.any(Function)
        );
    });

    test('should use KTX2Loader when provided in options', () => {
        const textureManager = new TextureManager(mockCityModel, {
            ktx2Loader: mockKTX2Loader
        });

        // Index 1 is .ktx2
        expect(mockKTX2Loader.load).toHaveBeenCalledWith(
            expect.stringContaining('texture.ktx2'),
            expect.any(Function),
            undefined,
            expect.any(Function)
        );
    });

    test('should use DDSLoader when provided in options', () => {
        const textureManager = new TextureManager(mockCityModel, {
            ddsLoader: mockDDSLoader
        });

        // Index 2 is .dds
        expect(mockDDSLoader.load).toHaveBeenCalledWith(
            expect.stringContaining('texture.dds'),
            expect.any(Function),
            undefined,
            expect.any(Function)
        );
    });

    test('should fallback/warn if KTX2 loader is missing for .ktx2 file', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        new TextureManager(mockCityModel); // No loaders provided

        expect(mockTextureLoader.load).toHaveBeenCalledWith(
            expect.stringContaining('texture.ktx2'),
            expect.any(Function),
            undefined,
            expect.any(Function)
        );

        consoleSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('should handle File objects with compression formats', (done) => {
        const textureManager = new TextureManager(mockCityModel, {
            ktx2Loader: mockKTX2Loader
        });

        const file = {
            name: 'texture.ktx2',
        };

        // We need to mock URL.createObjectURL since we are not in browser
        global.URL.createObjectURL = jest.fn(() => 'blob:texture.ktx2');
        global.URL.revokeObjectURL = jest.fn();

        textureManager.setTextureFromFile(file);

        // Wait for potential async operations if any (though mocks are sync here)
        setTimeout(() => {
             expect(mockKTX2Loader.load).toHaveBeenCalledWith(
                'blob:texture.ktx2',
                expect.any(Function),
                undefined,
                expect.any(Function)
            );
            done();
        }, 10);
    });

});
