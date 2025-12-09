
import { TextureManager } from '../src/helpers/TextureManager';
import { CityObjectsMaterial } from '../src/materials/CityObjectsMaterial';
import { ShaderLib, Vector4, Texture } from 'three';

// Mock Three.js classes
jest.mock('three', () => {
	const originalThree = jest.requireActual('three');
	return {
		...originalThree,
		TextureLoader: class {
			load(url, onLoad, onProgress, onError) {
				const tex = new originalThree.Texture();
				tex.name = url;
				tex.image = { width: 1, height: 1 }; // Mock image
				setTimeout(() => onLoad && onLoad(tex), 0);
				return tex;
			}
		}
	};
});

describe('Task 4.3: Texture-Based Displacement/Height Maps', () => {

	const cityModel = {
		appearance: {
			textures: [
				{
					type: 'PNG',
					image: 'diffuse.png',
					textureType: 'specific',
					wrapMode: 'wrap',
					related: {
						displacement: 1
					}
				},
				{
					type: 'PNG',
					image: 'height.png',
					textureType: 'specific',
					wrapMode: 'wrap'
				}
			]
		}
	};

	test('Material should support Displacement uniforms', () => {
		const mat = new CityObjectsMaterial(ShaderLib.lambert, {});

		expect(mat.uniforms).toHaveProperty('cityTextureDisplacement');
		expect(mat.uniforms).toHaveProperty('cityTextureDisplacementScale');
		expect(mat.uniforms).toHaveProperty('cityTextureDisplacementBias');
	});

	test('TextureManager should assign displacement texture to material', (done) => {
		const textureManager = new TextureManager(cityModel);

		// Wait for textures to load
		setTimeout(() => {
			const baseMaterial = new CityObjectsMaterial(ShaderLib.lambert, {});
			const materials = textureManager.getMaterials(baseMaterial);

			// Material 0 should correspond to texture 0 (Diffuse)
			const mat = materials[0];

			expect(mat).toBeDefined();
			expect(mat.uniforms.cityTexture.value).toBeDefined();
			expect(mat.uniforms.cityTexture.value.name).toBe('diffuse.png');

			// Check if displacement map is assigned
			expect(mat.uniforms.cityTextureDisplacement.value).toBeDefined();
			expect(mat.uniforms.cityTextureDisplacement.value.name).toBe('height.png');

			// We expect custom defines now
			expect(mat.defines.USE_CITY_DISPLACEMENTMAP).toBeDefined();

			done();
		}, 100);
	});

    test('Shader code should include displacement logic', (done) => {
        const textureManager = new TextureManager(cityModel);
        setTimeout(() => {
            const baseMaterial = new CityObjectsMaterial(ShaderLib.lambert, {});
            const materials = textureManager.getMaterials(baseMaterial);
            const mat = materials[0];

            // Check vertex shader for displacement logic
            expect(mat.vertexShader).toContain('USE_CITY_DISPLACEMENTMAP');
            expect(mat.vertexShader).toContain('cityTextureDisplacement');
            expect(mat.vertexShader).toContain('transformed += normal * ( d * cityTextureDisplacementScale + cityTextureDisplacementBias )');

            done();
        }, 100);
    });

});
