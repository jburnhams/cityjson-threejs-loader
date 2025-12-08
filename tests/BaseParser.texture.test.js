
import { BaseParser } from '../src/parsers/geometry/BaseParser';

describe('BaseParser Texture Data Extraction', () => {

    let parser;
    let mockCityModel;

    beforeEach(() => {
        mockCityModel = {
            type: 'CityJSON',
            version: '2.0',
            CityObjects: {},
            vertices: [],
            appearance: {
                'vertices-texture': [
                    [0.0, 0.0],
                    [1.0, 0.0],
                    [1.0, 1.0],
                    [0.0, 1.0],
                    [0.5, 0.5]
                ],
                textures: [
                    { image: 'texture1.png', wrapMode: 'wrap' },
                    { image: 'texture2.png', wrapMode: 'clamp' }
                ]
            }
        };

        parser = new BaseParser(mockCityModel, {});
    });

    describe('getTextureData', () => {

        test('should extract texture data for simple surface', () => {
            const texture = {
                'visual': {
                    values: [
                        [[0, 0, 1, 2, 3]] // Texture index 0, UV indices 0,1,2,3
                    ]
                }
            };

            const result = parser.getTextureData(0, 0, [], texture);

            expect(result).toBeDefined();
            expect(result.visual).toBeDefined();
            expect(result.visual.index).toBe(0);
            expect(result.visual.uvs).toEqual([0.0, 0.0]);
        });

        test('should return default values when texture data is null', () => {
            const texture = {
                'visual': {
                    values: [
                        [[null]] // Null texture index
                    ]
                }
            };

            const result = parser.getTextureData(0, 0, [], texture);

            expect(result.visual.index).toBe(-1);
            expect(result.visual.uvs).toEqual([0, 0]);
        });

        test('should handle multiple texture themes', () => {
            const texture = {
                'visual': {
                    values: [
                        [[0, 0, 1, 2, 3]]
                    ]
                },
                'winter': {
                    values: [
                        [[1, 0, 1, 2, 3]]
                    ]
                }
            };

            const result = parser.getTextureData(0, 0, [], texture);

            expect(result.visual).toBeDefined();
            expect(result.winter).toBeDefined();
            expect(result.visual.index).toBe(0);
            expect(result.winter.index).toBe(1);
        });

        test('should handle surfaces with holes', () => {
            const texture = {
                'visual': {
                    values: [
                        [
                            [0, 0, 1, 2, 3], // Outer ring
                            [0, 4, 1, 2]     // Hole ring
                        ]
                    ]
                }
            };

            // First vertex of outer ring
            let result = parser.getTextureData(0, 0, [], texture);
            expect(result.visual.uvs).toEqual([0.0, 0.0]);

            // First vertex after hole (index 4 in holes array)
            result = parser.getTextureData(0, 4, [4], texture);
            expect(result.visual.uvs).toEqual([0.5, 0.5]);
        });

        test('should handle missing appearance data', () => {
            const parserNoAppearance = new BaseParser({ CityObjects: {}, vertices: [] }, {});

            const texture = {
                'visual': {
                    values: [
                        [[0, 0, 1, 2, 3]]
                    ]
                }
            };

            const result = parserNoAppearance.getTextureData(0, 0, [], texture);

            expect(result.visual.index).toBe(-1);
            expect(result.visual.uvs).toEqual([0, 0]);
        });

        test('should handle missing vertices-texture', () => {
            const parserNoTexVertices = new BaseParser({
                CityObjects: {},
                vertices: [],
                appearance: {
                    textures: [{ image: 'tex.png' }]
                }
            }, {});

            const texture = {
                'visual': {
                    values: [
                        [[0, 0, 1, 2, 3]]
                    ]
                }
            };

            const result = parserNoTexVertices.getTextureData(0, 0, [], texture);

            expect(result.visual.index).toBe(-1);
            expect(result.visual.uvs).toEqual([0, 0]);
        });

        test('should handle theme without values', () => {
            const texture = {
                'visual': {}  // No values property
            };

            const result = parser.getTextureData(0, 0, [], texture);

            expect(result.visual.index).toBe(-1);
            expect(result.visual.uvs).toEqual([0, 0]);
        });

        test('should correctly calculate ring ID with multiple holes', () => {
            const texture = {
                'visual': {
                    values: [
                        [
                            [0, 0, 1, 2, 3, 4],   // Outer ring (4 vertices)
                            [0, 4, 6, 7],         // Hole 1 (3 vertices)
                            [0, 1, 9, 10]         // Hole 2 (3 vertices)
                        ]
                    ]
                }
            };

            // Vertex in outer ring
            let result = parser.getTextureData(0, 0, [], texture);
            expect(result.visual.uvs).toEqual([0.0, 0.0]);

            // Vertex in first hole
            result = parser.getTextureData(0, 4, [4], texture);
            expect(result.visual.uvs).toEqual([0.5, 0.5]); // UV index 4

            // Vertex in second hole
            result = parser.getTextureData(0, 7, [4, 7], texture);
            expect(result.visual.uvs).toEqual([1.0, 0.0]); // UV index 1 in ring 2
        });

        test('should correctly handle texture index 5 (which is invalid for only 5 texture vertices)', () => {
             // This test previously expected [0.5, 0.5] for an index that was effectively 5 in the data, but
             // the textureVertices array only had indices 0..4.
             // We've updated the code to handle undefined UVs by returning [0,0] which is the default fallback.
             // So here we document the behavior for invalid indices.
             const texture = {
                'visual': {
                    values: [
                        [
                            [0, 5, 5] // Invalid index 5
                        ]
                    ]
                }
            };
            const result = parser.getTextureData(0, 1, [], texture);
            // Since index 5 is out of bounds, uvs is undefined -> fallback to [0,0]
            expect(result.visual.uvs).toEqual([0, 0]);
        });
    });

    describe('getSurfaceMaterials', () => {

        test('should extract material indices for each theme', () => {
            const material = {
                'visual': {
                    values: [5]  // Material index 5 for surface 0
                }
            };

            const result = parser.getSurfaceMaterials(0, material);

            expect(result).toBeDefined();
            expect(result.visual).toBe(5);
        });

        test('should handle multiple material themes', () => {
            const material = {
                'visual': {
                    values: [3]
                },
                'winter': {
                    values: [7]
                }
            };

            const result = parser.getSurfaceMaterials(0, material);

            expect(result.visual).toBe(3);
            expect(result.winter).toBe(7);
        });

        test('should return -1 for missing material values', () => {
            const material = {
                'visual': {}  // No values
            };

            const result = parser.getSurfaceMaterials(0, material);

            expect(result.visual).toBe(-1);
        });

        test('should handle null material', () => {
            const result = parser.getSurfaceMaterials(0, null);

            expect(result).toEqual({});
        });

    });

    describe('Edge Cases', () => {

        test('should handle empty texture object', () => {
            const result = parser.getTextureData(0, 0, [], {});
            expect(result).toEqual({});
        });

        test('should handle surface index out of bounds', () => {
            const texture = {
                'visual': {
                    values: [
                        [[0, 0, 1, 2]]
                    ]
                }
            };

            // Surface index 5 doesn't exist
            const result = parser.getTextureData(5, 0, [], texture);

            // Should not throw, may return undefined or default
            expect(result).toBeDefined();
        });

        test('should handle vertex index beyond available UVs', () => {
            const texture = {
                'visual': {
                    values: [
                        [[0, 0, 1]] // Only 2 UV indices (including texture index)
                    ]
                }
            };

            // Try to access UV at large vertex index
            const result = parser.getTextureData(0, 10, [], texture);

            // Should handle gracefully
            expect(result).toBeDefined();
        });

    });

});
