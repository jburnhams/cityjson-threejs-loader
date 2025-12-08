
import { TextureManager } from '../src/helpers/TextureManager';
import * as THREE from 'three';

// Mock Three.js
jest.mock('three', () => {
    const originalModule = jest.requireActual('three');
    return {
        ...originalModule,
        TextureLoader: jest.fn().mockImplementation(() => {
            return {
                load: jest.fn((url, onLoad) => {
                    const tex = new originalModule.Texture();
                    // Simulate async load completion
                    if (onLoad) onLoad(tex);
                    return tex;
                })
            };
        }),
        // Ensure constants are available
        RepeatWrapping: 1000,
        ClampToEdgeWrapping: 1001,
        MirroredRepeatWrapping: 1002,
        SRGBColorSpace: 'srgb',
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

        // We need to spy on onChange or check periodically, but since we mocked Image to be somewhat async...
        // Let's hook into onChange of manager if possible, but TextureManager sets onChange to null in constructor.

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
});
