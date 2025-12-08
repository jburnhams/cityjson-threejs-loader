
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

describe('Task 2.1: Multiple Textures per Surface (PBR)', () => {

	const cityModel = {
		appearance: {
			textures: [
				{
					type: 'PNG',
					image: 'diffuse.png',
					textureType: 'specific',
					wrapMode: 'wrap',
					related: {
						normal: 1,
						roughness: 2
					}
				},
				{
					type: 'PNG',
					image: 'normal.png',
					textureType: 'specific',
					wrapMode: 'wrap'
				},
				{
					type: 'PNG',
					image: 'roughness.png',
					textureType: 'specific',
					wrapMode: 'wrap'
				}
			]
		}
	};

	test('Material should support PBR uniforms', () => {
		const mat = new CityObjectsMaterial(ShaderLib.standard, {});

		expect(mat.uniforms).toHaveProperty('cityTexture');
		expect(mat.uniforms).toHaveProperty('cityTextureNormal');
		expect(mat.uniforms).toHaveProperty('cityTextureRoughness');
		expect(mat.uniforms).toHaveProperty('cityTextureMetalness');
		expect(mat.uniforms).toHaveProperty('cityTextureAO');
		expect(mat.uniforms).toHaveProperty('cityTextureEmissive');
	});

	test('TextureManager should assign related textures to material', (done) => {
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

			// Check if normal map is assigned
			expect(mat.uniforms.cityTextureNormal.value).toBeDefined();
			expect(mat.uniforms.cityTextureNormal.value.name).toBe('normal.png');

			// We expect custom defines now
			expect(mat.defines.USE_CITY_NORMALMAP).toBeDefined();

			// Check if roughness map is assigned
			expect(mat.uniforms.cityTextureRoughness.value).toBeDefined();
			expect(mat.uniforms.cityTextureRoughness.value.name).toBe('roughness.png');
			expect(mat.defines.USE_CITY_ROUGHNESSMAP).toBeDefined();

			done();
		}, 100);
	});

});
