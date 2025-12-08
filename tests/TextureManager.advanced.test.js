
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
            this.minFilter = 1008;
            this.magFilter = 1006;
            this.anisotropy = 1;
            this.generateMipmaps = false;
            this.needsUpdate = false;
            this.image = null;
            this.name = '';
            this.clone = jest.fn(function() {
                const clone = new MockTexture();
                clone.image = this.image;
                clone.wrapS = this.wrapS;
                clone.wrapT = this.wrapT;
                clone.name = this.name;
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

    return {
        ...originalModule,
        Texture: MockTexture,
        DataTexture: MockDataTexture,
        Vector4: jest.fn().mockImplementation((x, y, z, w) => ({ x, y, z, w })),
        TextureLoader: jest.fn().mockImplementation(() => {
            return {
                load: jest.fn((url, onLoad, onProgress, onError) => {
                    const tex = new MockTexture();
                    tex.image = url;
                    tex.name = url;
                    if (url.includes('error')) {
                        setTimeout(() => {
                            if (onError) onError(new Error('Failed to load'));
                        }, 0);
                    } else {
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

describe('TextureManager Advanced Features', () => {

    describe('Texture Caching', () => {

        test('should cache loaded textures by URL', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'shared.png', wrapMode: 'wrap' },
                        { image: 'shared.png', wrapMode: 'wrap' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            setTimeout(() => {
                // Both textures should reference the same cached texture
                expect(manager.textureCache['shared.png']).toBeDefined();

                // Verify that textures are clones (different objects) but share the same image
                expect(manager.textures[0]).toBeDefined();
                expect(manager.textures[1]).toBeDefined();
                expect(manager.textures[0].image).toBe(manager.textures[1].image);

                // Verify clone was called
                expect(manager.textures[0].clone).toHaveBeenCalled();

                done();
            }, 20);
        });

        test('should use cached texture with different wrapMode configurations', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'shared.png', wrapMode: 'wrap' },
                        { image: 'shared.png', wrapMode: 'clamp' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            setTimeout(() => {
                // Both should use cached texture but with different wrap modes
                expect(manager.textures[0].wrapS).toBe(THREE.RepeatWrapping);
                expect(manager.textures[1].wrapS).toBe(THREE.ClampToEdgeWrapping);

                // Both should share the same underlying image
                expect(manager.textures[0].image).toBe(manager.textures[1].image);

                done();
            }, 20);
        });

        test('should remove failed texture from cache', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'error.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            setTimeout(() => {
                // Failed texture should be removed from cache
                expect(manager.textureCache['error.png']).toBeUndefined();

                // Fallback texture should be assigned
                expect(manager.textures[0]).toBeDefined();
                expect(manager.textures[0].name).toBe('fallback');

                done();
            }, 20);
        });

        test('should maintain cache across multiple loads', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            setTimeout(() => {
                const cachedTexture = manager.textureCache['tex1.png'];

                // Load another texture with same URL
                manager.setTextureFromUrl(1, 'tex1.png');

                setTimeout(() => {
                    // Cache should still contain the same texture object
                    expect(manager.textureCache['tex1.png']).toBe(cachedTexture);
                    done();
                }, 10);
            }, 10);
        });

    });

    describe('Material Generation', () => {

        test('should generate correct number of materials', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' },
                        { image: 'tex2.png' },
                        { image: 'tex3.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            const baseMaterial = { objectColors: {}, surfaceColors: {} };
            const materials = manager.getMaterials(baseMaterial);

            // Should have 3 texture materials + 1 base material
            expect(materials.length).toBe(4);
        });

        test('should use baseMaterial for undefined textures', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            // Force texture to be undefined
            manager.textures[0] = null;

            const baseMaterial = { objectColors: {}, surfaceColors: {} };
            const materials = manager.getMaterials(baseMaterial);

            // First material should be baseMaterial when texture is null
            expect(materials[0]).toBe(baseMaterial);
        });

        test('should dispose old materials when getMaterials is called multiple times', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            const baseMaterial = { objectColors: {}, surfaceColors: {} };

            const materials1 = manager.getMaterials(baseMaterial);
            const firstMaterial = materials1[0];

            manager.needsUpdate = true;
            const materials2 = manager.getMaterials(baseMaterial);

            // Old material should be disposed
            expect(firstMaterial.dispose).toHaveBeenCalled();
        });

        test('should not recreate materials if needsUpdate is false', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            const baseMaterial = { objectColors: {}, surfaceColors: {} };

            const materials1 = manager.getMaterials(baseMaterial);
            const materials2 = manager.getMaterials(baseMaterial);

            // Should return the same materials array
            expect(materials1[0]).toBe(materials2[0]);
        });

    });

    describe('Texture Progress Tracking', () => {

        test('should report correct totalTextures count', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' },
                        { image: 'tex2.png' },
                        { image: 'tex3.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            expect(manager.totalTextures).toBe(3);
        });

        test('should report correct resolvedTextures count', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' },
                        { image: 'tex2.png' },
                        { image: 'error.png' } // Will fail
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            setTimeout(() => {
                // 2 successful + 1 fallback = 3
                expect(manager.resolvedTextures).toBe(3);
                done();
            }, 20);
        });

        test('should report zero for empty citymodel', () => {
            const citymodel = {};
            const manager = new TextureManager(citymodel);

            expect(manager.totalTextures).toBe(0);
            expect(manager.resolvedTextures).toBe(0);
        });

    });

    describe('Complex Scenarios', () => {

        test('should handle mixed successful and failed texture loads', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png', wrapMode: 'wrap' },
                        { image: 'error.png', wrapMode: 'mirror' },
                        { image: 'tex2.png', wrapMode: 'clamp' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            setTimeout(() => {
                // First texture should succeed
                expect(manager.textures[0]).toBeDefined();
                expect(manager.textures[0].name).toBe('tex1.png');

                // Second should be fallback
                expect(manager.textures[1]).toBeDefined();
                expect(manager.textures[1].name).toBe('fallback');

                // Third should succeed
                expect(manager.textures[2]).toBeDefined();
                expect(manager.textures[2].name).toBe('tex2.png');

                done();
            }, 20);
        });

        test('should handle onChange callback during loading', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);
            let callbackCount = 0;

            manager.onChange = () => {
                callbackCount++;
            };

            // Trigger another load
            manager.setTextureFromUrl(1, 'tex2.png');

            setTimeout(() => {
                // onChange should be called when textures load
                expect(callbackCount).toBeGreaterThan(0);
                done();
            }, 20);
        });

        test('should handle very large texture arrays', () => {
            const textures = [];
            for (let i = 0; i < 100; i++) {
                textures.push({ image: `tex${i}.png`, wrapMode: 'wrap' });
            }

            const citymodel = {
                appearance: { textures }
            };

            const manager = new TextureManager(citymodel);

            expect(manager.totalTextures).toBe(100);
            expect(manager.textures.length).toBe(100);
        });

        test('should handle textures with special characters in filenames', (done) => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'texture with spaces.png', wrapMode: 'wrap' },
                        { image: 'texture-with-dashes.png', wrapMode: 'wrap' },
                        { image: 'texture_with_underscores.png', wrapMode: 'wrap' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            setTimeout(() => {
                expect(manager.textures[0].name).toBe('texture with spaces.png');
                expect(manager.textures[1].name).toBe('texture-with-dashes.png');
                expect(manager.textures[2].name).toBe('texture_with_underscores.png');
                done();
            }, 20);
        });

    });

    describe('Memory Management Edge Cases', () => {

        test('should clear cache on dispose', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' },
                        { image: 'tex2.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            expect(Object.keys(manager.textureCache).length).toBeGreaterThan(0);

            manager.dispose();

            expect(Object.keys(manager.textureCache).length).toBe(0);
        });

        test('should handle dispose with no materials created', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            // Don't call getMaterials, just dispose
            expect(() => manager.dispose()).not.toThrow();
        });

        test('should reset loadFromUrl properly', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' }
                    ]
                }
            };

            const manager = new TextureManager(citymodel);

            expect(manager.textures.length).toBe(1);
            expect(Object.keys(manager.textureCache).length).toBeGreaterThan(0);

            // Reload from URL
            manager.loadFromUrl();

            // Cache should be reset
            expect(manager.textures.length).toBe(1);
        });

    });

    describe('Filtering and Mipmapping Options', () => {

        test('should apply custom filtering options to all textures', () => {
            const citymodel = {
                appearance: {
                    textures: [
                        { image: 'tex1.png' },
                        { image: 'tex2.png' }
                    ]
                }
            };

            const options = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                anisotropy: 8
            };

            const manager = new TextureManager(citymodel, options);

            expect(manager.textures[0].minFilter).toBe(THREE.LinearFilter);
            expect(manager.textures[0].magFilter).toBe(THREE.LinearFilter);
            expect(manager.textures[0].anisotropy).toBe(8);

            expect(manager.textures[1].minFilter).toBe(THREE.LinearFilter);
            expect(manager.textures[1].magFilter).toBe(THREE.LinearFilter);
            expect(manager.textures[1].anisotropy).toBe(8);
        });

    });

});
