import { defaultSemanticsColors } from '../../defaults/colors.js';

export class BaseParser {

	constructor( json, objectIds, objectColors ) {

		this.json = json;

		this.objectIds = objectIds;
		this.objectColors = objectColors;
		this.surfaceColors = defaultSemanticsColors;
		this.lods = [];

	}

	clean() { }

	parseGeometry( geometry, objectId, geomIdx ) {}

	getObjectIdx( objectId ) {

		return this.objectIds.indexOf( objectId );

	}

	getObjectTypeIdx( cityObjectTypeName ) {

		let objType = Object.keys( this.objectColors ).indexOf( cityObjectTypeName );

		if ( objType < 0 ) {

			objType = Object.keys( this.objectColors ).length;
			this.objectColors[ cityObjectTypeName ] = Math.floor( Math.random() * 0xffffff );

		}

		return objType;

	}

	getSurfaceTypeIdx( idx, semantics, surfaces ) {

		let surfaceType = - 1;
		if ( semantics.length > 0 ) {

			const surface = surfaces[ semantics[ idx ] ];

			if ( surface ) {

				surfaceType = Object.keys( this.surfaceColors ).indexOf( surface.type );

				if ( surfaceType < 0 ) {

					surfaceType = Object.keys( this.surfaceColors ).length;
					this.surfaceColors[ surface.type ] = Math.floor( Math.random() * 0xffffff );

				}

			}

		}

		return surfaceType;

	}

	getSurfaceMaterials( idx, material ) {

		if ( ! material ) {

			return {};

		}

		const pairs = Object.entries( material ).map( mat => {

			const [ theme, obj ] = mat;

			if ( obj.values ) {

				return [ theme, obj.values[ idx ] ];

			} else if ( obj.value !== undefined ) {

				return [ theme, obj.value ];

			} else {

				return [ theme, - 1 ];

			}

		} );

		return Object.fromEntries( pairs );

	}

	getTextureData( surfaceIndex, vertexIndex, holes, texture ) {

		if ( texture ) {

			const textureVertices = ( this.json.appearance && this.json.appearance[ 'vertices-texture' ] ) ? this.json.appearance[ 'vertices-texture' ] : [];

			if ( ! Array.isArray( textureVertices ) ) {

				return undefined;

			}

			const pairs = Object.entries( texture ).map( tex => {

				const [ theme, obj ] = tex;

				if ( obj.values && Array.isArray( obj.values ) && textureVertices.length > 0 ) {

					const activeHoles = holes.filter( v => v <= vertexIndex );

					const ringId = activeHoles.length;
					const vId = ringId ? vertexIndex - activeHoles[ activeHoles.length - 1 ] : vertexIndex;

					// Check if surfaceIndex is valid
					if ( surfaceIndex >= obj.values.length || ! obj.values[ surfaceIndex ] ) {
						console.warn( `Missing texture values for surface ${surfaceIndex}` );
						return [ theme, { index: - 1, uvs: [ 0, 0 ] } ];

					}

					const data = obj.values[ surfaceIndex ];

					// Check if data structure is valid
					if ( ! Array.isArray( data ) || ! Array.isArray( data[ 0 ] ) ) {

						console.warn( `Invalid texture data structure for surface ${surfaceIndex}` );
						return [ theme, { index: - 1, uvs: [ 0, 0 ] } ];

					}

					if ( data[ 0 ][ 0 ] !== null ) {

						// Check if ringId is valid
						if ( ! data[ ringId ] ) {

							console.warn( `Missing texture ring data for ring ${ringId} on surface ${surfaceIndex}` );
							return [ theme, { index: data[ 0 ][ 0 ], uvs: [ 0, 0 ] } ];

						}

						// Check if vertex index is valid in texture data
						const uvIndex = data[ ringId ][ vId + 1 ];
						if ( uvIndex === undefined ) {

							console.warn( `Missing UV index for vertex ${vId} in ring ${ringId} on surface ${surfaceIndex}` );
							return [ theme, { index: data[ 0 ][ 0 ], uvs: [ 0, 0 ] } ];

						}

						const uvs = textureVertices[ uvIndex ];

						// Validate UVs
						if ( ! uvs || ! Array.isArray( uvs ) || uvs.some( c => typeof c !== 'number' || isNaN( c ) ) ) {

							// Only warn if UVs are actually invalid (NaN or non-number) or undefined
							if ( uvs ) {

								console.warn( `Invalid UV coordinates at index ${uvIndex}:`, uvs );

							} else {

								// console.warn( `Missing UV coordinates at index ${uvIndex}` );

							}
							return [ theme, { index: data[ 0 ][ 0 ], uvs: [ 0, 0 ] } ];

						}

						}

					}


					return [ theme, { index: - 1, uvs: [ 0, 0 ] } ];

				} else {

					if ( obj.values ) {

						console.warn( `Texture values is not an array for theme ${theme}` );

					}
					return [ theme, { index: - 1, uvs: [ 0, 0 ] } ];

				}

			} );

			return Object.fromEntries( pairs );

		}

		return undefined;

	}

	getLodIndex( lod ) {

		if ( lod === undefined ) {

			return - 1;

		}

		const lodIdx = this.lods.indexOf( lod );

		if ( lodIdx < 0 ) {

			const newIdx = this.lods.length;
			this.lods.push( lod );
			return newIdx;

		}

		return lodIdx;

	}

}
