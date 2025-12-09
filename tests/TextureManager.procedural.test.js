import { TextureManager } from "../src/helpers/TextureManager";
import { Texture, CanvasTexture } from "three";
import { JSDOM } from "jsdom";

// Mock dependencies
jest.mock( 'three', () => {

	const actualThree = jest.requireActual( 'three' );

	// Mock CanvasTexture to verify it was created
	class MockCanvasTexture extends actualThree.Texture {

		constructor( canvas ) {

			super( canvas );
			this.isCanvasTexture = true;
			this.image = canvas;

		}

		clone() {

			return new MockCanvasTexture( this.image );

		}

	}

	return {
		...actualThree,
		CanvasTexture: MockCanvasTexture,
		TextureLoader: class {

			load( url, onLoad, onProgress, onError ) {

				setTimeout( () => {

					if ( url === 'error.png' ) {

						if ( onError ) onError( new Error( 'Failed to load' ) );

					} else {

						const tex = new actualThree.Texture();
						tex.name = url;
						if ( onLoad ) onLoad( tex );

					}

				}, 10 );
				return new actualThree.Texture();

			}

		}
	};

} );

describe( "TextureManager Procedural Support", () => {

	let cityModel;

	beforeAll( () => {

		// Mock canvas and context
		const dom = new JSDOM( '<!DOCTYPE html><html><body></body></html>' );
		global.document = dom.window.document;
		global.window = dom.window;
		global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
		global.URL = dom.window.URL;

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

	beforeEach( () => {

		cityModel = {
			appearance: {
				textures: [
					{
						type: "PNG",
						image: "procedural://brick?color=#FF0000&rows=4"
					},
					{
						type: "PNG",
						image: "procedural://checker?color1=#000000&color2=#FFFFFF"
					},
					{
						type: "PNG",
						image: "normal.png"
					}
				]
			}
		};

	} );

	test( "should intercept procedural URLs and generate textures", () => {

		const textureManager = new TextureManager( cityModel );

		// Procedural textures are generated synchronously in our implementation
		const tex0 = textureManager.textures[ 0 ];
		expect( tex0 ).toBeDefined();
		expect( tex0.isCanvasTexture ).toBe( true );
		expect( tex0.name ).toBe( "procedural://brick?color=#FF0000&rows=4" );

		const tex1 = textureManager.textures[ 1 ];
		expect( tex1 ).toBeDefined();
		expect( tex1.isCanvasTexture ).toBe( true );
		expect( tex1.name ).toBe( "procedural://checker?color1=#000000&color2=#FFFFFF" );

		// Normal texture should still be a placeholder initially
		const tex2 = textureManager.textures[ 2 ];
		expect( tex2.name ).toBe( "placeholder" );

	} );

	test( "should cache procedural textures", () => {

		// Add duplicate texture
		cityModel.appearance.textures.push( {
			type: "PNG",
			image: "procedural://brick?color=#FF0000&rows=4"
		} );

		const textureManager = new TextureManager( cityModel );

		const tex0 = textureManager.textures[ 0 ];
		const tex3 = textureManager.textures[ 3 ];

		expect( tex0 ).toBeDefined();
		expect( tex3 ).toBeDefined();

		// They should be different instances (clones)
		expect( tex0 ).not.toBe( tex3 );

		// But they should share the same image (canvas)
		expect( tex0.image ).toBe( tex3.image );

	} );

	test( "should handle invalid procedural URLs gracefully", () => {

		const consoleSpy = jest.spyOn( console, 'error' ).mockImplementation( () => {} );

		cityModel.appearance.textures = [ {
			type: "PNG",
			image: "procedural://invalid-url-format?&" // Malformed URL to trigger URL constructor error
		} ];

		// Note: URL constructor is quite robust in Node/JSDOM, it might not throw on many strings.
		// Let's try to mock URL to throw for a specific input if needed,
		// but "procedural://..." is generally a valid URL.
		// The error we saw in previous test run was `TypeError: Cannot set properties of null (setting 'fillStyle')`
		// which means `getContext('2d')` returned null. We fixed that with the mock above.
		// To trigger the `catch` block in TextureManager, we need `new URL()` to fail OR `ProceduralTextureGenerator.generate` to throw.

		// Let's force ProceduralTextureGenerator to throw
		const originalGenerate = require( "../src/helpers/ProceduralTextureGenerator" ).ProceduralTextureGenerator.generate;
		require( "../src/helpers/ProceduralTextureGenerator" ).ProceduralTextureGenerator.generate = () => { throw new Error( "Explosion" ); };

		const textureManager = new TextureManager( cityModel );

		expect( consoleSpy ).toHaveBeenCalledWith( expect.stringContaining( "Failed to generate procedural texture" ), expect.any( Error ) );

		// It should fail to assign texture[0], so it might remain undefined or placeholder depending on flow
		// In my implementation it returns undefined/nothing if exception caught
		// So tex should be undefined or placeholder if pre-initialized?
		// TextureManager.constructor calls loadFromUrl -> setTextureFromUrl
		// setTextureFromUrl initializes placeholder ONLY if not procedural (in my new code block I placed procedural check at top)

		// Wait, if it fails, it returns. So no texture is assigned at index i?
		// "this.textures[ i ] = tex;" happens inside try block.

		const tex = textureManager.textures[ 0 ];
		expect( tex ).toBeUndefined();

		// Restore
		require( "../src/helpers/ProceduralTextureGenerator" ).ProceduralTextureGenerator.generate = originalGenerate;
		consoleSpy.mockRestore();

	} );

} );
