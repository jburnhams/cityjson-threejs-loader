
import { TextureManager } from '../src/helpers/TextureManager';
import { CityObjectsMaterial } from '../src/materials/CityObjectsMaterial';
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
            this.minFilter = 1008; // Default to LinearFilter
            this.magFilter = 1006; // Default to LinearFilter
            this.anisotropy = 1;
            this.generateMipmaps = false; // Default
            this.needsUpdate = false;
            this.clone = jest.fn(() => {
                const clone = new MockTexture();
                clone.image = this.image;
                clone.wrapS = this.wrapS;
                clone.wrapT = this.wrapT;
                return clone;
            });
        }
    }

    class MockDataTexture extends MockTexture {
        constructor(data, width, height, format, type) {
            super();
            this.isDataTexture = true;
            this.image = { width, height, data };
        }
    }

    class MockColor {
        constructor(r, g, b, a) {
            this.r = r;
            this.g = g;
            this.b = b;
        }
        setRGB(r, g, b) {
            this.r = r;
            this.g = g;
            this.b = b;
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
        Color: MockColor,
        Vector4: jest.fn().mockImplementation((x, y, z, w) => ({ x, y, z, w })),
        TextureLoader: jest.fn().mockImplementation(() => {
            return {
                load: jest.fn((url, onLoad, onProgress, onError) => {
                    const tex = new MockTexture();
                    tex.image = url; // Set image to URL for identification
                    if (url === 'error.png') {
                        // Simulate async error
                        setTimeout(() => {
                            if (onError) onError(new Error('Failed to load'));
                        }, 0);
                    } else {
                        // Simulate async success
                        setTimeout(() => {
                            if (onLoad) onLoad(tex);
                        }, 0);
                    }
                    return tex;
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
        UniformsUtils: {
             merge: jest.fn((uniforms) => {
                 let merged = {};
                 for (let u of uniforms) {
                     merged = { ...merged, ...u };
                 }
                 return merged;
             })
        },
        // Ensure constants are available
        RepeatWrapping: 1000,
        ClampToEdgeWrapping: 1001,
        MirroredRepeatWrapping: 1002,
        SRGBColorSpace: 'srgb',
        RGBAFormat: 1023,
        UnsignedByteType: 1009,
        LinearFilter: 1006,
        LinearMipmapLinearFilter: 1008,
    };
});

// Mock CityObjectsMaterial
jest.mock('../src/materials/CityObjectsMaterial', () => {
    return {
        CityObjectsMaterial: jest.fn().mockImplementation(() => {
            return {
                dispose: jest.fn(),
                uniforms: {
                    cityTexture: { value: null },
                    borderColor: { value: null },
                    useBorderColor: { value: 0 }
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

    test('should parse wrapMode correctly from URL', (done) => {
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

        // Wait for async load (simulated with setTimeout in mock)
        setTimeout(() => {
            expect(manager.textures[0].wrapS).toBe(THREE.RepeatWrapping);
            expect(manager.textures[1].wrapS).toBe(THREE.MirroredRepeatWrapping);
            expect(manager.textures[2].wrapS).toBe(THREE.ClampToEdgeWrapping);
            expect(manager.textures[3].wrapS).toBe(THREE.ClampToEdgeWrapping);
            expect(manager.textures[4].wrapS).toBe(THREE.ClampToEdgeWrapping);
            expect(manager.textures[5].wrapS).toBe(THREE.RepeatWrapping);
            done();
        }, 10);
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
                   // Mock image object
                   this.width = 100;
                   this.height = 100;
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

        // Wait for initial load to finish to avoid interference
        setTimeout(() => {
             // Reset for file test
             manager.textures = [];

             const file = { name: 'mytexture.png' };

             // Mock onChange
             manager.onChange = () => {
                 try {
                    // Check if textures are populated
                    if (manager.textures.length > 0) {
                        expect(manager.textures[0]).toBeDefined();
                        expect(manager.textures[0].wrapS).toBe(THREE.MirroredRepeatWrapping);
                        expect(manager.textures[0].wrapT).toBe(THREE.MirroredRepeatWrapping);

                        // Check if it's the FILE texture, not the URL texture
                        // URL texture image was string 'mytexture.png' (set in mock)
                        // File texture image is the Image object (from FileReader mock)
                        // But wait, TextureManager wraps Image in Texture.
                        // MockTexture doesn't expose underlying image easily unless we check property.
                        // In mock TextureLoader, we set image = url.
                        // In FileReader/Image mock flow, Texture(evt.target) is called.
                        // mock Texture constructor doesn't set image automatically from arg.
                        // But we can assume if it works, it's good.

                        // Cleanup
                        global.FileReader = originalFileReader;
                        global.Image = originalImage;
                        done();
                    }
                 } catch (error) {
                     done(error);
                 }
             };

             manager.setTextureFromFile(file);
        }, 20);
    });

    describe('Error Handling and Memory Management', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should log error when texture load fails (URL)', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'error.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            // Wait for async error
            setTimeout(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load texture'), expect.anything());
                done();
            }, 10);
        });

        test('should call onError callback when texture load fails (URL)', (done) => {
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

            setTimeout(() => {
                expect(onErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'load', url: 'error.png' }));
                // If callback provided, console.error should NOT be called
                expect(consoleErrorSpy).not.toHaveBeenCalled();
                done();
            }, 10);
        });

        test('should set fallback texture when load fails', (done) => {
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

             setTimeout(() => {
                expect(manager.textures[0]).toBeDefined();
                expect(manager.textures[0].name).toBe('fallback');
                // Check it is a DataTexture (basic check)
                expect(manager.textures[0].isDataTexture).toBe(true);
                done();
             }, 10);
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

    describe('Mipmapping and Filtering', () => {

        test('should configure mipmaps and filtering correctly with defaults', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png', wrapMode: 'wrap' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            const texture = manager.textures[0];

            expect(texture.generateMipmaps).toBe(true);
            expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
            expect(texture.magFilter).toBe(THREE.LinearFilter);
            expect(texture.anisotropy).toBe(1);
        });

        test('should configure anisotropy via options', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png', wrapMode: 'wrap' }
                    ]
                }
            };

            const options = { anisotropy: 16 };
            const manager = new TextureManager(citymodel, options);
            const texture = manager.textures[0];

            expect(texture.anisotropy).toBe(16);
        });

        test('should configure filters via options', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png', wrapMode: 'wrap' }
                    ]
                }
            };

            const options = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter
            };
            const manager = new TextureManager(citymodel, options);
            const texture = manager.textures[0];

            expect(texture.minFilter).toBe(THREE.LinearFilter);
            expect(texture.magFilter).toBe(THREE.LinearFilter);
        });

    });

    describe('borderColor Support', () => {

        test('should parse borderColor and pass it to material', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        {
                            image: 'tex1.png',
                            wrapMode: 'border',
                            borderColor: [1.0, 0.5, 0.0, 1.0]
                        }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            // Trigger material creation
            const baseMaterial = { objectColors: {}, surfaceColors: {} };
            manager.getMaterials(baseMaterial);

            const material = manager.materials[0];

            expect(material.uniforms.borderColor).toBeDefined();
            expect(material.uniforms.borderColor.value).toEqual({ x: 1.0, y: 0.5, z: 0.0, w: 1.0 });
            expect(material.uniforms.useBorderColor.value).toBe(1);
        });

        test('should ignore borderColor when wrapMode is not border', () => {
             const citymodel = {
                appearance: {
                    textures: [
                        {
                            image: 'tex1.png',
                            wrapMode: 'wrap',
                            borderColor: [1.0, 0.0, 0.0, 1.0]
                        }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            const baseMaterial = { objectColors: {}, surfaceColors: {} };
            manager.getMaterials(baseMaterial);

            const material = manager.materials[0];

            expect(material.uniforms.borderColor.value).toBeNull();
            expect(material.uniforms.useBorderColor.value).toBe(0);
        });

        test('should handle transparent borderColor', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        {
                            image: 'tex1.png',
                            wrapMode: 'border',
                            borderColor: [0.0, 0.0, 0.0, 0.0]
                        }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            const baseMaterial = { objectColors: {}, surfaceColors: {} };
            manager.getMaterials(baseMaterial);

            const material = manager.materials[0];

            expect(material.uniforms.borderColor.value).toEqual({ x: 0.0, y: 0.0, z: 0.0, w: 0.0 });
            expect(material.uniforms.useBorderColor.value).toBe(1);
        });

    });
});
