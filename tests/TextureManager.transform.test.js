
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
            this.minFilter = 1008;
            this.magFilter = 1006;
            this.anisotropy = 1;
            this.generateMipmaps = false;
            this.needsUpdate = false;
            this.offset = { x: 0, y: 0, set: jest.fn(function(x, y) { this.x = x; this.y = y; }) };
            this.repeat = { x: 1, y: 1, set: jest.fn(function(x, y) { this.x = x; this.y = y; }) };
            this.center = { x: 0, y: 0, set: jest.fn(function(x, y) { this.x = x; this.y = y; }) };
            this.rotation = 0;
            this.matrix = { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
            this.matrixAutoUpdate = true;
            this.updateMatrix = jest.fn();
            this.clone = jest.fn(() => {
                const clone = new MockTexture();
                clone.image = this.image;
                clone.wrapS = this.wrapS;
                clone.wrapT = this.wrapT;
                return clone;
            });
        }
    }

    class MockMatrix3 {
        constructor() {
            this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        }
        set() {}
    }

    return {
        ...originalModule,
        Texture: MockTexture,
        TextureLoader: jest.fn().mockImplementation(() => {
            return {
                load: jest.fn((url, onLoad, onProgress, onError) => {
                    const tex = new MockTexture();
                    tex.image = url;
                    setTimeout(() => {
                        if (onLoad) onLoad(tex);
                    }, 0);
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
        Matrix3: MockMatrix3,
        UniformsUtils: {
             merge: jest.fn((uniforms) => {
                 let merged = {};
                 for (let u of uniforms) {
                     merged = { ...merged, ...u };
                 }
                 return merged;
             }),
             clone: jest.fn((uniforms) => {
                 // Simple shallow clone for mock
                 return { ...uniforms };
             })
        }
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
                    cityTextureTransform: { value: null }
                },
                needsUpdate: false
            };
        })
    };
});

describe('TextureManager Transformations', () => {

    test('should parse textureTransform and update texture properties', (done) => {
        const citymodel = {
            appearance: {
                textures: [
                    {
                        image: 'tex1.png',
                        textureTransform: {
                            offset: [0.5, 0.5],
                            scale: [2.0, 2.0],
                            rotation: 1.57, // 90 degrees
                            center: [0.5, 0.5]
                        }
                    }
                ]
            }
        };

        const manager = new TextureManager(citymodel);

        setTimeout(() => {
            const tex = manager.textures[0];

            expect(tex.offset.set).toHaveBeenCalledWith(0.5, 0.5);
            expect(tex.repeat.set).toHaveBeenCalledWith(2.0, 2.0);
            expect(tex.center.set).toHaveBeenCalledWith(0.5, 0.5);
            expect(tex.rotation).toBe(1.57);

            // Should call updateMatrix to ensure matrix is ready for uniform
            expect(tex.updateMatrix).toHaveBeenCalled();

            done();
        }, 10);
    });

    test('should provide cityTextureTransform uniform to material', (done) => {
        const citymodel = {
            appearance: {
                textures: [
                    {
                        image: 'tex1.png',
                        textureTransform: {
                            offset: [0.1, 0.2],
                            scale: [0.5, 0.5],
                            rotation: 0
                        }
                    }
                ]
            }
        };

        const manager = new TextureManager(citymodel);
        const baseMaterial = { objectColors: {}, surfaceColors: {} };

        setTimeout(() => {
            manager.getMaterials(baseMaterial);
            const mat = manager.materials[0];

            expect(mat.uniforms.cityTextureTransform).toBeDefined();
            // In Three.js, texture.matrix is the transform matrix.
            // We expect the uniform value to be the texture's matrix.
            expect(mat.uniforms.cityTextureTransform.value).toBe(manager.textures[0].matrix);

            done();
        }, 10);
    });

    test('should use identity matrix if no transform is present', (done) => {
        const citymodel = {
            appearance: {
                textures: [
                    { image: 'tex1.png' }
                ]
            }
        };

        const manager = new TextureManager(citymodel);
        const baseMaterial = { objectColors: {}, surfaceColors: {} };

        setTimeout(() => {
            manager.getMaterials(baseMaterial);
            const mat = manager.materials[0];
            const tex = manager.textures[0];

            // Defaults
            expect(tex.offset.x).toBe(0); // Mock default
            expect(tex.repeat.x).toBe(1); // Mock default
            expect(tex.rotation).toBe(0);

            expect(mat.uniforms.cityTextureTransform).toBeDefined();
            expect(mat.uniforms.cityTextureTransform.value).toBe(tex.matrix);

            done();
        }, 10);
    });

});
