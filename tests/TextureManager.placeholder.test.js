
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
            this.clone = jest.fn(function() {
                // If 'this' is an instance of MockDataTexture, return a MockDataTexture
                const clone = this.isDataTexture ? new MockDataTexture() : new MockTexture();
                clone.image = this.image;
                clone.wrapS = this.wrapS;
                clone.wrapT = this.wrapT;
                clone.name = this.name;
                clone.isDataTexture = this.isDataTexture;
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

describe('TextureManager Progressive Loading', () => {

    test('should set placeholder texture immediately on loadFromUrl', () => {
        const citymodel = {
            appearance: {
                textures: [
                    { image: 'tex1.png' }
                ]
            }
        };

        const manager = new TextureManager(citymodel);

        // Immediately after construction (and loadFromUrl call),
        // textures[0] should be the placeholder.
        expect(manager.textures[0]).toBeDefined();
        expect(manager.textures[0].name).toBe('placeholder');
        expect(manager.textures[0].isDataTexture).toBe(true);
    });

    test('should replace placeholder and update material after load completes', (done) => {
        const citymodel = {
            appearance: {
                textures: [
                    { image: 'tex1.png' }
                ]
            }
        };

        const manager = new TextureManager(citymodel);

        // Simulate creating materials while placeholder is active
        const baseMaterial = { objectColors: {}, surfaceColors: {} };
        manager.getMaterials(baseMaterial);

        const mat = manager.materials[0];
        expect(mat.uniforms.cityTexture.value.name).toBe('placeholder');

        // Wait for async load
        setTimeout(() => {
            expect(manager.textures[0].name).toBeUndefined();
            expect(manager.textures[0].image).toBe('tex1.png');
            expect(manager.textures[0].isDataTexture).toBeUndefined();

            // KEY CHECK: Verify material uniform was updated
            expect(mat.uniforms.cityTexture.value).toBe(manager.textures[0]);
            expect(mat.uniforms.cityTexture.value.image).toBe('tex1.png');

            done();
        }, 20);
    });

    test('should replace placeholder with fallback on error and update material', (done) => {
        const citymodel = {
            appearance: {
                textures: [
                    { image: 'error.png' }
                ]
            }
        };

        const manager = new TextureManager(citymodel);

        // Simulate creating materials while placeholder is active
        const baseMaterial = { objectColors: {}, surfaceColors: {} };
        manager.getMaterials(baseMaterial);

        const mat = manager.materials[0];
        expect(mat.uniforms.cityTexture.value.name).toBe('placeholder');

        // Wait for async error
        setTimeout(() => {
            expect(manager.textures[0].name).toBe('fallback');
            expect(manager.textures[0].isDataTexture).toBe(true);

            // KEY CHECK: Verify material uniform was updated to fallback
            expect(mat.uniforms.cityTexture.value).toBe(manager.textures[0]);
            expect(mat.uniforms.cityTexture.value.name).toBe('fallback');

            done();
        }, 20);
    });

});
