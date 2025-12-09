import { ProceduralTextureGenerator } from "../src/helpers/ProceduralTextureGenerator";
import { CanvasTexture } from "three";
import { JSDOM } from "jsdom";

describe( "ProceduralTextureGenerator", () => {

	beforeAll( () => {

		// Mock canvas and context
		const dom = new JSDOM( '<!DOCTYPE html><html><body></body></html>' );
		global.document = dom.window.document;
		global.window = dom.window;
		global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

		// Mock getContext
		const originalCreateElement = global.document.createElement;
		global.document.createElement = ( tagName ) => {

			if ( tagName === 'canvas' ) {

				const canvas = originalCreateElement.call( global.document, 'canvas' );
				canvas.getContext = ( type ) => {

					if ( type === '2d' ) {

						return {
							fillStyle: '',
							fillRect: jest.fn(),
							createImageData: () => ( { data: new Array( 400 ) } ),
							putImageData: jest.fn(),
						};

					}
					return null;

				};
				return canvas;

			}
			return originalCreateElement.call( global.document, tagName );

		};

	} );

	test( "should generate brick texture", () => {

		const tex = ProceduralTextureGenerator.generate( "brick", { width: 64, height: 64 } );
		expect( tex ).toBeInstanceOf( CanvasTexture );
		expect( tex.image.width ).toBe( 64 );
		expect( tex.image.height ).toBe( 64 );

	} );

	test( "should generate checker texture", () => {

		const tex = ProceduralTextureGenerator.generate( "checker", { width: 32, height: 32 } );
		expect( tex ).toBeInstanceOf( CanvasTexture );

	} );

	test( "should generate noise texture", () => {

		const tex = ProceduralTextureGenerator.generate( "noise", { width: 16, height: 16 } );
		expect( tex ).toBeInstanceOf( CanvasTexture );

	} );

	test( "should generate grid texture", () => {

		const tex = ProceduralTextureGenerator.generate( "grid", { width: 100, height: 100 } );
		expect( tex ).toBeInstanceOf( CanvasTexture );

	} );

	test( "should handle unknown types gracefully", () => {

		const consoleSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		const tex = ProceduralTextureGenerator.generate( "unknown_type" );

		expect( consoleSpy ).toHaveBeenCalledWith( expect.stringContaining( "Unknown procedural texture type" ) );
		expect( tex ).toBeInstanceOf( CanvasTexture );

		consoleSpy.mockRestore();

	} );

	test( "should parse parameters correctly", () => {

		const tex = ProceduralTextureGenerator.generate( "brick", {
			color: "#FF0000",
			mortarColor: "#00FF00",
			rows: 5,
			cols: 5
		} );
		expect( tex ).toBeInstanceOf( CanvasTexture );

	} );

} );
