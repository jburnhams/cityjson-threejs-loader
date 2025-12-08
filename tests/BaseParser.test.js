
import { BaseParser } from '../src/parsers/geometry/BaseParser.js';

describe('BaseParser', () => {
    let parser;
    let mockJson;
    let mockObjectIds;
    let mockObjectColors;

    beforeEach(() => {
        mockJson = {
            appearance: {
                'vertices-texture': [
                    [0, 0], // 0
                    [1, 0], // 1
                    [1, 1], // 2
                    [0, 1], // 3
                    [NaN, NaN], // 4: Invalid
                    [2, 0], // 5: > 1.0 (Valid in v2.0)
                ],
                textures: [
                    { type: 'PNG' }
                ]
            }
        };
        mockObjectIds = ['obj1'];
        mockObjectColors = {};

        parser = new BaseParser(mockJson, mockObjectIds, mockObjectColors);
    });

    describe('getTextureData', () => {

        test('should return valid UVs for valid input', () => {
            const surfaceIndex = 0;
            const vertexIndex = 0;
            const holes = [];
            const texture = {
                default: {
                    values: [
                        [[0, 0, 1, 2]] // Texture index 0, UV indices 0, 1, 2
                    ]
                }
            };

            const result = parser.getTextureData(surfaceIndex, vertexIndex, holes, texture);

            expect(result).toBeDefined();
            expect(result.default).toBeDefined();
            expect(result.default.index).toBe(0);
            expect(result.default.uvs).toEqual([0, 0]);
        });

        test('should handle valid v2.0 UVs > 1.0', () => {
             const surfaceIndex = 0;
             const vertexIndex = 0;
             const holes = [];
             const texture = {
                 default: {
                     values: [
                         [[0, 5, 1, 2]] // Texture index 0, UV index 5 is [2, 0]
                     ]
                 }
             };

             const result = parser.getTextureData(surfaceIndex, vertexIndex, holes, texture);
             expect(result.default.uvs).toEqual([2, 0]);
        });

        test('should handle invalid UV coordinates (NaN) by returning default [0, 0]', () => {
            const surfaceIndex = 0;
            const vertexIndex = 0;
            const holes = [];
            const texture = {
                default: {
                    values: [
                        [[0, 4, 1, 2]] // Texture index 0, UV index 4 is [NaN, NaN]
                    ]
                }
            };

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const result = parser.getTextureData(surfaceIndex, vertexIndex, holes, texture);

            expect(result.default.uvs).toEqual([0, 0]);
            // Depending on implementation, we might warn. The task says "warn if UV coordinates outside expected range (optional)".
            // But for NaN, it says "Invalid UV coordinates (NaN, undefined) logged and replaced with defaults".
            // So we expect a log? Or maybe just replacement.
            // Let's assert replacement first.

            consoleSpy.mockRestore();
        });

        test('should handle undefined UV coordinates by returning default [0, 0]', () => {
            // Setup a case where textureVertices[index] is undefined
             const surfaceIndex = 0;
             const vertexIndex = 0;
             const holes = [];
             const texture = {
                 default: {
                     values: [
                         [[0, 999, 1, 2]] // UV index 999 does not exist
                     ]
                 }
             };

             const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

             const result = parser.getTextureData(surfaceIndex, vertexIndex, holes, texture);

             expect(result.default.uvs).toEqual([0, 0]);
             // Expect warning?

             consoleSpy.mockRestore();
        });

        test('should detect and report UV/vertex count mismatch (missing data for vertex)', () => {
            // Case where we ask for vertexIndex that is not in the values array
            const surfaceIndex = 0;
            const vertexIndex = 10; // Only have 3 vertices in definition
            const holes = [];
            const texture = {
                default: {
                    values: [
                        [[0, 0, 1, 2]] // 3 vertices defined (indices 0, 1, 2)
                    ]
                }
            };

            // Current implementation might crash here: data[ringId][vId + 1] -> data[0][11] -> undefined

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            let result;
            expect(() => {
                result = parser.getTextureData(surfaceIndex, vertexIndex, holes, texture);
            }).not.toThrow();

            expect(result.default.uvs).toEqual([0, 0]);
            // Expect warning about mismatch
             expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        test('should handle missing UV coordinates gracefully (textureVertices missing)', () => {
             const jsonMissingUVs = {
                 appearance: {
                     // vertices-texture missing
                     textures: []
                 }
             };
             const parserMissing = new BaseParser(jsonMissingUVs, mockObjectIds, mockObjectColors);

             const surfaceIndex = 0;
             const vertexIndex = 0;
             const holes = [];
             const texture = {
                 default: {
                     values: [
                         [[0, 0, 1, 2]]
                     ]
                 }
             };

             const result = parserMissing.getTextureData(surfaceIndex, vertexIndex, holes, texture);
             expect(result).toBeUndefined();
        });

        test('should handle malformed texture data (values not array)', () => {
             const surfaceIndex = 0;
             const vertexIndex = 0;
             const holes = [];
             const texture = {
                 default: {
                     values: "not an array"
                 }
             };

             const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

             let result;
             expect(() => {
                 result = parser.getTextureData(surfaceIndex, vertexIndex, holes, texture);
             }).not.toThrow();

             // If values is not an array, existing code `obj.values[ surfaceIndex ]` acts on string?
             // "not an array"[0] is "n".
             // We want it to be robust.

             consoleSpy.mockRestore();
        });

        test('should handle malformed texture data (surface index out of bounds)', () => {
             const surfaceIndex = 99;
             const vertexIndex = 0;
             const holes = [];
             const texture = {
                 default: {
                     values: [
                         [[0, 0, 1, 2]]
                     ]
                 }
             };

             const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

             let result;
             expect(() => {
                 result = parser.getTextureData(surfaceIndex, vertexIndex, holes, texture);
             }).not.toThrow();

             // Expect fallback
             expect(result.default.uvs).toEqual([0, 0]);

             consoleSpy.mockRestore();
        });

    });
});
