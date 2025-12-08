
import { TextureManager } from '../src/helpers/TextureManager';
import * as THREE from 'three';

// Mock Three.js
jest.mock('three', () => {
    const originalModule = jest.requireActual('three');

    class MockTexture {
        constructor() {
            this.dispose = jest.fn();
            this.encoding = '';
            this.wrapS = 1000;
            this.wrapT = 1000;
            this.needsUpdate = false;
        }
    }

    class MockDataTexture extends MockTexture {
        constructor(data, width, height, format, type) {
            super();
            this.isDataTexture = true;
            this.image = { width, height, data };
        }
    }

    class MockMaterial {
        constructor() {
            this.dispose = jest.fn();
            this.uniforms = {
                cityTexture: { value: null }
            };
        }
    }

    return {
        ...originalModule,
        Texture: MockTexture,
        DataTexture: MockDataTexture,
        TextureLoader: jest.fn().mockImplementation(() => {
            return {
                load: jest.fn((url, onLoad, onProgress, onError) => {
                    if (url === 'error.png') {
                        if (onError) onError(new Error('Failed to load'));
                    } else {
                        const tex = new MockTexture();
                        if (onLoad) onLoad(tex);
                        return tex;
                    }
                })
            };
        }),
        ShaderLib: {
            lambert: {
                uniforms: {},
                vertexShader: '',
                fragmentShader: ''
            }
        },
        // Ensure constants are available
        RepeatWrapping: 1000,
        ClampToEdgeWrapping: 1001,
        MirroredRepeatWrapping: 1002,
        SRGBColorSpace: 'srgb',
        RGBAFormat: 1023,
        UnsignedByteType: 1009
    };
});

// Mock CityObjectsMaterial
jest.mock('../src/materials/CityObjectsMaterial', () => {
    return {
        CityObjectsMaterial: jest.fn().mockImplementation(() => {
            return {
                dispose: jest.fn(),
                uniforms: {
                    cityTexture: { value: null }
                },
                needsUpdate: false
            };
        })
    };
});

describe('TextureManager', () => {

    test('should initialize with empty textures if none in citymodel', () => {
        const citymodel = {};
        const manager = new TextureManager(citymodel);
        expect(manager.cityTextures).toEqual([]);
    });

    test('should parse wrapMode correctly from URL', () => {
        const citymodel = {
            appearance: {
                textures: [
                    { image: 'tex1.png', wrapMode: 'wrap' },
                    { image: 'tex2.png', wrapMode: 'mirror' },
                    { image: 'tex3.png', wrapMode: 'clamp' },
                    { image: 'tex4.png', wrapMode: 'border' },
                    { image: 'tex5.png', wrapMode: 'none' },
                    { image: 'tex6.png' } // Default
                ]
            }
        };

        const manager = new TextureManager(citymodel);

        expect(manager.textures[0].wrapS).toBe(THREE.RepeatWrapping);
        expect(manager.textures[1].wrapS).toBe(THREE.MirroredRepeatWrapping);
        expect(manager.textures[2].wrapS).toBe(THREE.ClampToEdgeWrapping);
        expect(manager.textures[3].wrapS).toBe(THREE.ClampToEdgeWrapping);
        expect(manager.textures[4].wrapS).toBe(THREE.ClampToEdgeWrapping);
        expect(manager.textures[5].wrapS).toBe(THREE.RepeatWrapping);
    });

    test('should parse wrapMode correctly from File', (done) => {
        // We need to mock FileReader and Image
        const originalFileReader = global.FileReader;
        const originalImage = global.Image;

        global.FileReader = class {
            readAsDataURL(file) {
                this.onload({ target: { result: 'data:image/png;base64,fake' } });
            }
        };

        global.Image = class {
            set src(val) {
                setTimeout(() => {
                   if (this.onload) this.onload({ target: this });
                }, 0);
            }
        };

        const citymodel = {
            appearance: {
                textures: [
                    { image: 'mytexture.png', wrapMode: 'mirror' }
                ]
            }
        };

        const manager = new TextureManager(citymodel);

        // Ensure we clear textures from URL load
        manager.textures = [];

        const file = { name: 'mytexture.png' };

        // Mock onChange
        manager.onChange = () => {
             try {
                expect(manager.textures[0]).toBeDefined();
                expect(manager.textures[0].wrapS).toBe(THREE.MirroredRepeatWrapping);
                expect(manager.textures[0].wrapT).toBe(THREE.MirroredRepeatWrapping);

                // Cleanup
                global.FileReader = originalFileReader;
                global.Image = originalImage;
                done();
             } catch (error) {
                 done(error);
             }
        };

        manager.setTextureFromFile(file);
    });

    describe('Error Handling and Memory Management', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should log error when texture load fails (URL)', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'error.png' }
                    ]
                }
            };

            new TextureManager(citymodel);

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load texture'), expect.anything());
        });

        test('should call onError callback when texture load fails (URL)', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'error.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            // Clear the initial error from constructor
            consoleErrorSpy.mockClear();

            const onErrorSpy = jest.fn();
            manager.onError = onErrorSpy;

            // Re-trigger load
            manager.setTextureFromUrl(0, 'error.png');

            expect(onErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'load', url: 'error.png' }));
            // If callback provided, console.error should NOT be called
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        test('should set fallback texture when load fails', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'error.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            // Trigger fail
            manager.setTextureFromUrl(0, 'error.png');

            expect(manager.textures[0]).toBeDefined();
            expect(manager.textures[0].name).toBe('fallback');
            // Check it is a DataTexture (basic check)
            expect(manager.textures[0].isDataTexture).toBe(true);
        });

        test('should dispose textures and materials when dispose() is called', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'valid.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            // Trigger material creation
            const baseMaterial = { objectColors: {}, surfaceColors: {} };
            manager.getMaterials(baseMaterial);

            const tex = manager.textures[0];
            const mat = manager.materials[0];

            expect(tex).toBeDefined();
            expect(mat).toBeDefined();

            // Check if dispose method exists
            expect(typeof manager.dispose).toBe('function');

            manager.dispose();

            expect(tex.dispose).toHaveBeenCalled();
            expect(mat.dispose).toHaveBeenCalled();
            expect(manager.textures.length).toBe(0);
            expect(manager.materials.length).toBe(0);
        });
    });
});
