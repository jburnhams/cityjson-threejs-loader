import { CanvasTexture, SRGBColorSpace, RepeatWrapping, Color } from "three";

/**
 * Helper class to generate procedural textures using the HTML5 Canvas API.
 * Supports various patterns like brick, checker, noise, and grid.
 */
export class ProceduralTextureGenerator {

	/**
	 * Generates a procedural texture based on the specified type and parameters.
	 *
	 * @param {string} type - The type of texture to generate ('brick', 'checker', 'noise', 'grid').
	 * @param {Object} [params={}] - Configuration parameters for the generator.
	 * @param {number} [params.width=512] - Width of the texture in pixels.
	 * @param {number} [params.height=512] - Height of the texture in pixels.
	 * @param {string} [params.backgroundColor='#FFFFFF'] - Background color (hex string).
	 * @returns {CanvasTexture} The generated Three.js CanvasTexture.
	 */
	static generate( type, params = {} ) {

		const width = parseInt( params.width ) || 512;
		const height = parseInt( params.height ) || 512;
		const canvas = document.createElement( 'canvas' );
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext( '2d' );

		// Fill background
		ctx.fillStyle = params.backgroundColor || '#FFFFFF';
		ctx.fillRect( 0, 0, width, height );

		switch ( type.toLowerCase() ) {

			case 'brick':
				ProceduralTextureGenerator.drawBrick( ctx, width, height, params );
				break;
			case 'checker':
				ProceduralTextureGenerator.drawChecker( ctx, width, height, params );
				break;
			case 'noise':
				ProceduralTextureGenerator.drawNoise( ctx, width, height, params );
				break;
			case 'grid':
				ProceduralTextureGenerator.drawGrid( ctx, width, height, params );
				break;
			default:
				console.warn( `Unknown procedural texture type: ${type}` );
				break;

		}

		const texture = new CanvasTexture( canvas );
		texture.colorSpace = SRGBColorSpace;
		texture.wrapS = RepeatWrapping;
		texture.wrapT = RepeatWrapping;
		texture.name = type;

		return texture;

	}

	/**
	 * Draws a brick pattern.
	 *
	 * @param {CanvasRenderingContext2D} ctx - The canvas context.
	 * @param {number} width - Canvas width.
	 * @param {number} height - Canvas height.
	 * @param {Object} params - Parameters for the brick pattern.
	 * @param {string} [params.color='#A03020'] - Color of the bricks.
	 * @param {string} [params.mortarColor='#D0D0D0'] - Color of the mortar lines.
	 * @param {number} [params.rows=10] - Number of brick rows.
	 * @param {number} [params.cols=5] - Number of brick columns.
	 * @param {number} [params.mortarThickness=4] - Thickness of the mortar lines in pixels.
	 */
	static drawBrick( ctx, width, height, params ) {

		const brickColor = params.color || '#A03020';
		const mortarColor = params.mortarColor || '#D0D0D0';
		const rows = parseInt( params.rows ) || 10;
		const cols = parseInt( params.cols ) || 5;
		const mortarThickness = parseInt( params.mortarThickness ) || 4;

		const brickHeight = height / rows;
		const brickWidth = width / cols;

		ctx.fillStyle = mortarColor;
		ctx.fillRect( 0, 0, width, height );

		ctx.fillStyle = brickColor;

		for ( let r = 0; r < rows; r ++ ) {

			const offsetY = ( r % 2 ) * ( brickWidth / 2 );

			for ( let c = - 1; c < cols + 1; c ++ ) {

				const x = c * brickWidth + offsetY;
				const y = r * brickHeight;

				ctx.fillRect(
					x + mortarThickness / 2,
					y + mortarThickness / 2,
					brickWidth - mortarThickness,
					brickHeight - mortarThickness
				);

			}

		}

	}

	/**
	 * Draws a checkerboard pattern.
	 *
	 * @param {CanvasRenderingContext2D} ctx - The canvas context.
	 * @param {number} width - Canvas width.
	 * @param {number} height - Canvas height.
	 * @param {Object} params - Parameters for the checker pattern.
	 * @param {string} [params.color1='#FFFFFF'] - First color of the checkerboard.
	 * @param {string} [params.color2='#000000'] - Second color of the checkerboard.
	 * @param {number} [params.rows=8] - Number of rows.
	 * @param {number} [params.cols=8] - Number of columns.
	 */
	static drawChecker( ctx, width, height, params ) {

		const color1 = params.color1 || '#FFFFFF';
		const color2 = params.color2 || '#000000';
		const rows = parseInt( params.rows ) || 8;
		const cols = parseInt( params.cols ) || 8;

		const cellWidth = width / cols;
		const cellHeight = height / rows;

		for ( let r = 0; r < rows; r ++ ) {

			for ( let c = 0; c < cols; c ++ ) {

				ctx.fillStyle = ( r + c ) % 2 === 0 ? color1 : color2;
				ctx.fillRect( c * cellWidth, r * cellHeight, cellWidth, cellHeight );

			}

		}

	}

	/**
	 * Draws a grid pattern.
	 *
	 * @param {CanvasRenderingContext2D} ctx - The canvas context.
	 * @param {number} width - Canvas width.
	 * @param {number} height - Canvas height.
	 * @param {Object} params - Parameters for the grid pattern.
	 * @param {string} [params.color='#000000'] - Color of the grid lines.
	 * @param {string} [params.backgroundColor='#FFFFFF'] - Background color.
	 * @param {number} [params.thickness=2] - Thickness of grid lines.
	 * @param {number} [params.rows=10] - Number of horizontal cells.
	 * @param {number} [params.cols=10] - Number of vertical cells.
	 */
	static drawGrid( ctx, width, height, params ) {

		const color = params.color || '#000000';
		const backgroundColor = params.backgroundColor || '#FFFFFF';
		const thickness = parseInt( params.thickness ) || 2;
		const rows = parseInt( params.rows ) || 10;
		const cols = parseInt( params.cols ) || 10;

		const cellWidth = width / cols;
		const cellHeight = height / rows;

		ctx.fillStyle = backgroundColor;
		ctx.fillRect( 0, 0, width, height );

		ctx.fillStyle = color;

		// Vertical lines
		for ( let c = 0; c <= cols; c ++ ) {

			const x = Math.min( c * cellWidth, width - thickness );
			ctx.fillRect( x, 0, thickness, height );

		}

		// Horizontal lines
		for ( let r = 0; r <= rows; r ++ ) {

			const y = Math.min( r * cellHeight, height - thickness );
			ctx.fillRect( 0, y, width, thickness );

		}

	}

	/**
	 * Draws white noise.
	 *
	 * @param {CanvasRenderingContext2D} ctx - The canvas context.
	 * @param {number} width - Canvas width.
	 * @param {number} height - Canvas height.
	 * @param {Object} params - Parameters for the noise.
	 * @param {string} [params.color1='#000000'] - First color interpolation point.
	 * @param {string} [params.color2='#FFFFFF'] - Second color interpolation point.
	 */
	static drawNoise( ctx, width, height, params ) {

		const color1 = new Color( params.color1 || '#000000' );
		const color2 = new Color( params.color2 || '#FFFFFF' );

		const imageData = ctx.createImageData( width, height );
		const data = imageData.data;

		for ( let i = 0; i < data.length; i += 4 ) {

			const factor = Math.random();

			// Simple linear interpolation
			const r = color1.r + ( color2.r - color1.r ) * factor;
			const g = color1.g + ( color2.g - color1.g ) * factor;
			const b = color1.b + ( color2.b - color1.b ) * factor;

			data[ i ] = Math.floor( r * 255 );
			data[ i + 1 ] = Math.floor( g * 255 );
			data[ i + 2 ] = Math.floor( b * 255 );
			data[ i + 3 ] = 255; // Alpha

		}

		ctx.putImageData( imageData, 0, 0 );

	}

}
