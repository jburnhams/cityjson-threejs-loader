
import { CityObjectsMesh } from '../src/objects/CityObjectsMesh';
import { BufferAttribute } from 'three';

// Mock Three.js
jest.mock('three', () => {
	const originalThree = jest.requireActual('three');

	class MockBufferAttribute {
		constructor(array, itemSize) {
			this.array = array;
			this.itemSize = itemSize;
			this.count = array.length / itemSize;
			this.needsUpdate = false;
		}
		getX(index) { return this.array[index]; }
	}

	class MockBufferGeometry {
		constructor() {
			this.attributes = {};
			this.groups = [];
		}
		setAttribute(name, attribute) {
			this.attributes[name] = attribute;
		}
		getAttribute(name) {
			return this.attributes[name];
		}
		addGroup(start, count, materialIndex) {
			this.groups.push({ start, count, materialIndex });
		}
		clearGroups() {
			this.groups = [];
		}
		computeVertexNormals() {}
		applyMatrix4() {}
		dispose() {}
	}

	class MockMesh {
		constructor(geometry, material) {
			this.geometry = geometry;
			this.material = material;
		}
	}

	return {
		...originalThree,
		BufferAttribute: MockBufferAttribute,
		Int32BufferAttribute: MockBufferAttribute, // Mock as same
		Float32Array: Float32Array,
		Uint16Array: Uint16Array,
		Uint8Array: Uint8Array,
		Int8Array: Int8Array,
		Int16Array: Int16Array,
		Int32Array: Int32Array,
		BufferGeometry: MockBufferGeometry,
		Mesh: MockMesh
	};
});


describe('CityObjectsMesh', () => {

	const mockCityModel = { CityObjects: { 'obj1': {} } };
	const mockGeometryData = {
		objectIds: [0, 0, 0, 0, 0, 0],
		objectType: [0, 0, 0, 0, 0, 0],
		semanticSurfaces: [0, 0, 0, 0, 0, 0],
		geometryIds: [0, 0, 0, 0, 0, 0],
		lodIds: [0, 0, 0, 0, 0, 0],
		boundaryIds: [0, 0, 0, 0, 0, 0],
		materials: {},
		textures: {
			'winter': {
				index: [0, 0, 0, 1, 1, 1], // Texture 0 for first 3 verts, Texture 1 for next 3
				uvs: [[0,0], [0,0], [0,0], [0,0], [0,0], [0,0]]
			},
			'summer': {
				index: [-1, -1, -1, 0, 0, 0], // No texture, then Texture 0
				uvs: [[0,0], [0,0], [0,0], [0,0], [0,0], [0,0]]
			}
		}
	};
	const mockVertices = [
		0,0,0, 1,0,0, 0,1,0,
		0,0,1, 1,0,1, 0,1,1
	]; // 6 vertices (2 triangles)

	const mockMaterial = {
		dispose: jest.fn(),
		textureTheme: null
	};

	const mockTextureManager = {
		getMaterials: jest.fn((baseMat) => {
			// Returns array of materials.
			// Assume we have textures [Tex0, Tex1].
			// Index 0 -> Mat0
			// Index 1 -> Mat1
			// Base -> MatBase (last)
			const mat0 = { name: 'Mat0', textureTheme: null };
			const mat1 = { name: 'Mat1', textureTheme: null };
			return [mat0, mat1, baseMat];
		})
	};

	test('should initialize correctly', () => {
		const mesh = new CityObjectsMesh(mockCityModel, mockVertices, mockGeometryData, null, mockMaterial);

		expect(mesh).toBeDefined();
		expect(mesh.geometry.attributes.position).toBeDefined();
		expect(mesh.geometry.attributes.texwinter).toBeDefined();
		expect(mesh.geometry.attributes.texsummer).toBeDefined();
	});

	test('should set texture theme and generate groups', () => {
		const mesh = new CityObjectsMesh(mockCityModel, mockVertices, mockGeometryData, null, mockMaterial);

		mesh.setTextureTheme('winter', mockTextureManager);

		// Check groups
		// vertices 0-3 (count 3) -> texture 0 -> material index 0
		// vertices 3-6 (count 3) -> texture 1 -> material index 1
		expect(mesh.geometry.groups).toHaveLength(2);

		expect(mesh.geometry.groups[0]).toEqual({ start: 0, count: 3, materialIndex: 0 });
		expect(mesh.geometry.groups[1]).toEqual({ start: 3, count: 3, materialIndex: 1 });

		// Check materials updated
		expect(Array.isArray(mesh.material)).toBe(true);
		expect(mesh.material).toHaveLength(3); // Mat0, Mat1, Base
		expect(mesh.material[0].textureTheme).toBe('winter');
	});

	test('should handle theme with missing textures (-1)', () => {
		const mesh = new CityObjectsMesh(mockCityModel, mockVertices, mockGeometryData, null, mockMaterial);

		mesh.setTextureTheme('summer', mockTextureManager);

		// vertices 0-3 -> texture -1 -> material index 2 (Base Material, last in array [Mat0, Mat1, Base])
		// vertices 3-6 -> texture 0 -> material index 0
		expect(mesh.geometry.groups).toHaveLength(2);

		// Base material is at index 2
		expect(mesh.geometry.groups[0]).toEqual({ start: 0, count: 3, materialIndex: 2 });
		expect(mesh.geometry.groups[1]).toEqual({ start: 3, count: 3, materialIndex: 0 });
	});

	test('should unset textures correctly', () => {
		const mesh = new CityObjectsMesh(mockCityModel, mockVertices, mockGeometryData, null, mockMaterial);

		mesh.setTextureTheme('winter', mockTextureManager);
		expect(Array.isArray(mesh.material)).toBe(true);

		mesh.setTextureTheme('undefined', mockTextureManager); // Or call unsetTextures directly

		// Should revert to single material
		expect(Array.isArray(mesh.material)).toBe(false);
		expect(mesh.material).toBe(mockMaterial);

		// Should clear groups
		expect(mesh.geometry.groups).toHaveLength(0);

		// Should set textureTheme to "undefined" on base material
		expect(mockMaterial.textureTheme).toBe("undefined");
	});

    test('should handle vertex cluster at start with -1 correctly', () => {
         // This verifies the "last: -2" fix mentioned in docs.
         // If reduce started with last: -1, and first value was -1, it would skip pushing the first group start.
         // 'summer' theme starts with -1.
         const mesh = new CityObjectsMesh(mockCityModel, mockVertices, mockGeometryData, null, mockMaterial);
         mesh.setTextureTheme('summer', mockTextureManager);

         // We expect a group starting at 0 for the -1 values.
         expect(mesh.geometry.groups[0].start).toBe(0);
         expect(mesh.geometry.groups[0].materialIndex).toBe(2); // Base material
    });

});
