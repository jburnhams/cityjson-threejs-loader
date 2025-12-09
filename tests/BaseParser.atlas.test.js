
import { BaseParser } from '../src/parsers/geometry/BaseParser';

describe( 'BaseParser Atlas Support', () => {

	const mockJson = {
		appearance: {
			textures: [
				{
					type: 'PNG',
					image: 'atlas.png'
				},
				{
					type: 'PNG',
					atlasTexture: 0,
					atlasRegion: [ 0.0, 0.0, 0.5, 0.5 ] // Bottom-left quadrant
				},
				{
					type: 'PNG',
					atlasTexture: 0,
					atlasRegion: [ 0.5, 0.5, 0.5, 0.5 ] // Top-right quadrant
				}
			],
			'vertices-texture': [
				[ 0, 0 ],
				[ 1, 0 ],
				[ 1, 1 ],
				[ 0, 1 ]
			]
		}
	};

	const objectIds = [ 'obj1' ];
	const objectColors = { 'Building': 123456 };

	test( 'should remap texture index and UVs for atlas sub-textures', () => {

		const parser = new BaseParser( mockJson, objectIds, objectColors );

		// Geometry references Texture Index 1 (Sub-texture)
		// It uses texture vertices 0, 1, 2, 3 (standard quad [0,0] to [1,1])
		const textureData = {
			'theme1': {
				values: [
					[ [ 1, 0, 1, 2, 3 ] ] // [ textureIndex, uvIndex1, uvIndex2... ]
				]
			}
		};

		// Arguments: surfaceIndex, vertexIndex, holes, texture
		// We are simulating processing the first vertex (index 0 in the ring) of the first surface
		// The function returns data for the whole surface/ring?
		// No, getTextureData iterates over themes and returns data for the specific surface index.

		// Wait, getTextureData in BaseParser returns { theme: { index, uvs } }
		// But it calculates uvs based on `vertexIndex`?
		// Let's look at getTextureData implementation again.
		// It seems it processes a specific vertex?

		// In BaseParser.js:
		// getTextureData( surfaceIndex, vertexIndex, holes, texture )
		// It calculates `ringId` and `vId` based on `vertexIndex` and `holes`.

		// Let's assume surfaceIndex=0, vertexIndex=0 (first vertex of the ring), holes=[]
		// This corresponds to the first UV index in `values[0][0]`.
		// values[0][0] is [1, 0, 1, 2, 3] -> Texture 1.
		// UV indices are 0, 1, 2, 3.
		// Vertex 0 -> UV index 0 -> [0, 0]

		const result = parser.getTextureData( 0, 0, [], textureData );

		expect( result ).toBeDefined();
		expect( result.theme1 ).toBeDefined();

		// Should return the ATLAS index (0), not the sub-texture index (1)
		expect( result.theme1.index ).toBe( 0 );

		// Should return transformed UVs
		// Original UV: [0, 0]
		// Region: [0, 0, 0.5, 0.5] -> Scale 0.5, Offset 0,0
		// Expected: [0, 0]
		expect( result.theme1.uvs[ 0 ] ).toBeCloseTo( 0 );
		expect( result.theme1.uvs[ 1 ] ).toBeCloseTo( 0 );

		// Check another vertex: Vertex 2 -> UV index 2 -> [1, 1]
		// Transformed: [1*0.5 + 0, 1*0.5 + 0] -> [0.5, 0.5]
		const result2 = parser.getTextureData( 0, 2, [], textureData );
		expect( result2.theme1.index ).toBe( 0 );
		expect( result2.theme1.uvs[ 0 ] ).toBeCloseTo( 0.5 );
		expect( result2.theme1.uvs[ 1 ] ).toBeCloseTo( 0.5 );

	} );

	test( 'should handle top-right quadrant correctly', () => {

		const parser = new BaseParser( mockJson, objectIds, objectColors );

		// Geometry references Texture Index 2
		const textureData = {
			'theme1': {
				values: [
					[ [ 2, 0, 1, 2, 3 ] ]
				]
			}
		};

		// Vertex 0 -> UV [0, 0]
		// Region: [0.5, 0.5, 0.5, 0.5]
		// Expected: [0.5, 0.5]
		const result = parser.getTextureData( 0, 0, [], textureData );
		expect( result.theme1.index ).toBe( 0 );
		expect( result.theme1.uvs[ 0 ] ).toBeCloseTo( 0.5 );
		expect( result.theme1.uvs[ 1 ] ).toBeCloseTo( 0.5 );

		// Vertex 2 -> UV [1, 1]
		// Expected: [1*0.5 + 0.5, 1*0.5 + 0.5] -> [1.0, 1.0]
		const result2 = parser.getTextureData( 0, 2, [], textureData );
		expect( result2.theme1.index ).toBe( 0 );
		expect( result2.theme1.uvs[ 0 ] ).toBeCloseTo( 1.0 );
		expect( result2.theme1.uvs[ 1 ] ).toBeCloseTo( 1.0 );

	} );

	test( 'should fallback to original index if atlasTexture is invalid', () => {

		const badJson = {
			appearance: {
				textures: [
					{ image: 'atlas.png' }, // 0
					{ atlasTexture: 99, atlasRegion: [0,0,1,1] } // 1 (Invalid Ref)
				],
				'vertices-texture': [[0,0]]
			}
		};
		const parser = new BaseParser( badJson, objectIds, objectColors );

		const textureData = {
			'theme1': { values: [ [ [ 1, 0 ] ] ] }
		};

		const result = parser.getTextureData( 0, 0, [], textureData );

		// Should keep index 1 because mapping failed (or could return -1, but keeping 1 is safer for debug)
		// Actually, if I implement robust checking, it should probably return 1 and warn, or -1.
		// Let's assume implementation returns original index if atlas is missing.
		expect( result.theme1.index ).toBe( 1 );
		expect( result.theme1.uvs ).toEqual( [ 0, 0 ] );

	} );

    test( 'should handle UVs outside [0,1] correctly with wrapping/clamping logic if applicable', () => {
        // CityJSON 2.0 allows UVs outside [0,1].
        // If we atlas, we must be careful.
        // If the original texture was "wrap", and we map it to a region, we can't simply wrap the UVs,
        // because that would sample the neighbor regions in the atlas.
        // Usually, atlasing implies "clamp" or strict UV boundaries.
        // If UV is 1.5 and region is [0,0, 0.5, 0.5].
        // New UV = 1.5 * 0.5 + 0 = 0.75.
        // 0.75 is outside the region [0, 0.5]. It bleeds into the next region.

        // My implementation will blindly transform. It's up to the user to ensure UVs fit if they use atlasing.
        // But let's verify the math works for > 1.

		const parser = new BaseParser( mockJson, objectIds, objectColors );
        const textureData = {
			'theme1': { values: [ [ [ 1, 0 ] ] ] } // Texture 1 (Bottom Left)
		};

        // Mocking vertices-texture having a > 1 value
        parser.json.appearance['vertices-texture'] = [[ 2.0, 2.0 ]];

        // Vertex 0 -> UV [2.0, 2.0]
        // Region: [0, 0, 0.5, 0.5]
        // Expected: [2.0*0.5 + 0, 2.0*0.5 + 0] = [1.0, 1.0]

        const result = parser.getTextureData( 0, 0, [], textureData );
        expect( result.theme1.uvs[0] ).toBeCloseTo( 1.0 );
        expect( result.theme1.uvs[1] ).toBeCloseTo( 1.0 );
    });

} );
