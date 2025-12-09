import { Texture, ShaderLib, RepeatWrapping, MirroredRepeatWrapping, ClampToEdgeWrapping, TextureLoader, SRGBColorSpace, DataTexture, RGBAFormat, UnsignedByteType, LinearMipmapLinearFilter, LinearFilter, Vector4 } from "three";
import { CityObjectsMaterial } from "../materials/CityObjectsMaterial";

export class TextureManager {

	constructor( citymodel, options = {} ) {

		if ( citymodel.appearance && citymodel.appearance.textures ) {

			this.cityTextures = citymodel.appearance.textures;

		} else {

			this.cityTextures = [];

		}

		this.textures = [];
		this.materials = [];
		this.textureCache = {}; // Cache map for loaded textures (url/name -> Texture)
		this.placeholderTexture = this.createPlaceholderTexture(); // Singleton placeholder

		this.options = {
			anisotropy: 1,
			minFilter: LinearMipmapLinearFilter,
			magFilter: LinearFilter,
			ktx2Loader: null,
			ddsLoader: null,
			...options
		};

		this.needsUpdate = false;
		this.onChange = null;
		this.onError = null;

		this.loadFromUrl();

	}

	get totalTextures() {

		return this.cityTextures.length;

	}

	get resolvedTextures() {

		return this.textures.filter( t => t ).length;

	}

	getMaterials( baseMaterial ) {

		if ( this.materials.length === 0 || this.needsUpdate ) {

			const materials = [];

			for ( let i = 0; i < this.cityTextures.length; i ++ ) {

				if ( this.textures[ i ] ) {

					const mat = new CityObjectsMaterial( ShaderLib.lambert, {
						objectColors: baseMaterial.objectColors,
						surfaceColors: baseMaterial.surfaceColors,
						transparent: true
					} );

					mat.uniforms.cityTexture.value = this.textures[ i ];

					// Pass texture matrix for transformations (Task 2.2)
					if ( this.textures[ i ].matrix ) {

						mat.uniforms.cityTextureTransform.value = this.textures[ i ].matrix;

					}

					// Handle PBR maps (Task 2.1)
					const cityTex = this.cityTextures[ i ];
					if ( cityTex.related ) {

						if ( cityTex.related.normal !== undefined && this.textures[ cityTex.related.normal ] ) {

							mat.uniforms.cityTextureNormal.value = this.textures[ cityTex.related.normal ];
							mat.defines.USE_CITY_NORMALMAP = '';

						}

						if ( cityTex.related.roughness !== undefined && this.textures[ cityTex.related.roughness ] ) {

							mat.uniforms.cityTextureRoughness.value = this.textures[ cityTex.related.roughness ];
							mat.defines.USE_CITY_ROUGHNESSMAP = '';

						}

						if ( cityTex.related.metalness !== undefined && this.textures[ cityTex.related.metalness ] ) {

							mat.uniforms.cityTextureMetalness.value = this.textures[ cityTex.related.metalness ];
							mat.defines.USE_CITY_METALNESSMAP = '';

						}

						if ( cityTex.related.ao !== undefined && this.textures[ cityTex.related.ao ] ) {

							mat.uniforms.cityTextureAO.value = this.textures[ cityTex.related.ao ];
							mat.defines.USE_CITY_AOMAP = '';

						}

						if ( cityTex.related.emissive !== undefined && this.textures[ cityTex.related.emissive ] ) {

							mat.uniforms.cityTextureEmissive.value = this.textures[ cityTex.related.emissive ];
							mat.defines.USE_CITY_EMISSIVEMAP = '';

						}

					}

					// Handle borderColor
					if ( this.cityTextures[ i ].wrapMode === 'border' && this.cityTextures[ i ].borderColor ) {

						const bc = this.cityTextures[ i ].borderColor;
						mat.uniforms.borderColor.value = new Vector4( bc[ 0 ], bc[ 1 ], bc[ 2 ], bc[ 3 ] );
						mat.uniforms.useBorderColor.value = 1;

					}

					mat.needsUpdate = true;

					materials.push( mat );

				} else {

					materials.push( baseMaterial );

				}

			}

			// Dispose of old materials
			for ( const mat of this.materials ) {

				if ( mat !== baseMaterial ) {

					mat.dispose();

				}

			}

			this.materials = materials;

			this.needsUpdate = false;

		}

		return [ ...this.materials, baseMaterial ];

	}

	createPlaceholderTexture() {

		const width = 2;
		const height = 2;
		const size = width * height;
		const data = new Uint8Array( size * 4 );

		// Create a small 2x2 checkerboard pattern
		const c1 = [ 200, 200, 200, 255 ];
		const c2 = [ 150, 150, 150, 255 ];

		for ( let i = 0; i < size; i ++ ) {

			const color = ( i % 2 === 0 ) ? c1 : c2;
			const stride = i * 4;
			data[ stride ] = color[ 0 ];
			data[ stride + 1 ] = color[ 1 ];
			data[ stride + 2 ] = color[ 2 ];
			data[ stride + 3 ] = color[ 3 ];

		}

		const texture = new DataTexture( data, width, height, RGBAFormat, UnsignedByteType );
		texture.name = 'placeholder';
		texture.needsUpdate = true;
		texture.magFilter = LinearFilter;
		texture.minFilter = LinearFilter;

		return texture;

	}

	_configureTexture( tex, i ) {

		tex.encoding = SRGBColorSpace;
		tex.generateMipmaps = true;
		tex.minFilter = this.options.minFilter;
		tex.magFilter = this.options.magFilter;
		tex.anisotropy = this.options.anisotropy;

		// Handle wrapMode
		const cityTexture = this.cityTextures[ i ];
		const wrapModeStr = ( cityTexture && cityTexture.wrapMode ) ? cityTexture.wrapMode : "wrap";
		let wrapMode = RepeatWrapping;

		if ( wrapModeStr === "mirror" ) {

			wrapMode = MirroredRepeatWrapping;

		} else if ( wrapModeStr === "clamp" || wrapModeStr === "border" || wrapModeStr === "none" ) {

			wrapMode = ClampToEdgeWrapping;

		}

		tex.wrapS = wrapMode;
		tex.wrapT = wrapMode;

		// Store textureType
		const textureType = ( cityTexture && cityTexture.textureType ) ? cityTexture.textureType : "unknown";
		tex.userData = tex.userData || {};
		tex.userData.textureType = textureType;

		// Store formatType
		if ( cityTexture && cityTexture.type ) {

			tex.userData.formatType = cityTexture.type;

		}

		// Handle textureTransform (Task 2.2)
		if ( cityTexture && cityTexture.textureTransform ) {

			const tf = cityTexture.textureTransform;

			if ( tf.offset && Array.isArray( tf.offset ) && tf.offset.length === 2 ) {

				tex.offset.set( tf.offset[ 0 ], tf.offset[ 1 ] );

			}

			if ( tf.scale && Array.isArray( tf.scale ) && tf.scale.length === 2 ) {

				tex.repeat.set( tf.scale[ 0 ], tf.scale[ 1 ] );

			}

			if ( tf.center && Array.isArray( tf.center ) && tf.center.length === 2 ) {

				tex.center.set( tf.center[ 0 ], tf.center[ 1 ] );

			}

			if ( typeof tf.rotation === 'number' ) {

				tex.rotation = tf.rotation;

			}

			tex.matrixAutoUpdate = true;
			tex.updateMatrix();

		}

		tex.needsUpdate = true;

		return tex;

	}

	_updateMaterialTexture( index, texture ) {

		if ( this.materials[ index ] ) {

			const mat = this.materials[ index ];
			if ( mat.uniforms && mat.uniforms.cityTexture ) {

				mat.uniforms.cityTexture.value = texture;
				// mat.needsUpdate = true; // Not strictly needed for uniform value update

			}

		}

	}

	setTextureFromUrl( i, url ) {

		const context = this;

		// Validate image format
		if ( this.cityTextures[ i ] && this.cityTextures[ i ].type ) {

			const type = this.cityTextures[ i ].type.toLowerCase();
			const extension = url.split( '.' ).pop().toLowerCase();

			// Map common types to extensions
			const validExtensions = {
				'png': [ 'png' ],
				'jpg': [ 'jpg', 'jpeg' ],
				'jpeg': [ 'jpg', 'jpeg' ]
			};

			if ( validExtensions[ type ] && ! validExtensions[ type ].includes( extension ) ) {

				console.warn( `Texture type mismatch: expected ${type} but got .${extension} for ${url}` );

			}

		}

		// Check cache
		if ( this.textureCache[ url ] ) {

			const cachedTex = this.textureCache[ url ];
			const tex = cachedTex.clone();

			this._configureTexture( tex, i );
			this.textures[ i ] = tex;

			// Update material immediately if it exists
			this._updateMaterialTexture( i, tex );

			this.needsUpdate = true;
			if ( this.onChange ) {

				this.onChange();

			}

			return;

		}

		// Assign singleton placeholder immediately
		// We can't easily configure the singleton placeholder per texture slot (wrap modes etc) because it's shared.
		// So we clone it? DataTexture.clone() works.
		// Or we just use the raw placeholder and don't care about wrap modes until real texture loads.
		// Let's clone it so we can set wrap modes correctly if needed, although it's just a placeholder.
		// Actually, if we want correct UV behavior even for placeholder (e.g. repeat), we should clone.
		const placeholder = this.placeholderTexture.clone();
		placeholder.name = 'placeholder';
		this._configureTexture( placeholder, i );
		this.textures[ i ] = placeholder;

		// Update material immediately if it exists (it likely doesn't yet if this is initial load)
		this._updateMaterialTexture( i, placeholder );

		this.needsUpdate = true;

		// Choose loader based on extension
		const extension = url.split( '.' ).pop().toLowerCase();
		let loader;

		if ( extension === 'ktx2' && this.options.ktx2Loader ) {

			loader = this.options.ktx2Loader;

		} else if ( extension === 'dds' && this.options.ddsLoader ) {

			loader = this.options.ddsLoader;

		} else {

			loader = new TextureLoader();

		}

		// Load new texture
		loader.load( url, ( loadedTex ) => {

			// Update the texture array
			context.textures[ i ] = loadedTex;
			context._configureTexture( loadedTex, i );

			// Update cache
			context.textureCache[ url ] = loadedTex;

			// Update material reference
			context._updateMaterialTexture( i, loadedTex );

			context.needsUpdate = true;
			if ( context.onChange ) {

				context.onChange();

			}

		}, undefined, ( err ) => {

			// Remove from cache if failed
			delete context.textureCache[ url ];

			// Create fallback texture
			const data = new Uint8Array( [ 255, 0, 255, 255 ] );
			const texture = new DataTexture( data, 1, 1, RGBAFormat, UnsignedByteType );
			texture.encoding = SRGBColorSpace;
			texture.needsUpdate = true;
			texture.name = 'fallback';

			context.textures[ i ] = texture;

			// Update material reference
			context._updateMaterialTexture( i, texture );

			context.needsUpdate = true;
			if ( context.onChange ) {

				context.onChange();

			}

			if ( this.onError ) {

				this.onError( { type: 'load', url: url, error: err } );

			} else {

				console.error( `Failed to load texture at ${url}:`, err );

			}

		} );

	}

	loadFromUrl() {

		this.textures = [];
		this.textureCache = {}; // Reset cache

		for ( const [ i, texture ] of this.cityTextures.entries() ) {

			this.setTextureFromUrl( i, texture.image );

		}

	}

	dispose() {

		for ( const tex of this.textures ) {

			if ( tex ) {

				tex.dispose();

			}

		}

		if ( this.placeholderTexture ) {

			this.placeholderTexture.dispose();

		}

		this.textures = [];
		this.textureCache = {};

		for ( const mat of this.materials ) {

			mat.dispose();

		}

		this.materials = [];

	}

	setTextureFromFile( file ) {

		// Validate image format
		for ( const [ i, texture ] of this.cityTextures.entries() ) { // eslint-disable-line no-unused-vars

			if ( texture.image.includes( file.name ) ) {

				if ( texture.type ) {

					const type = texture.type.toLowerCase();
					const extension = file.name.split( '.' ).pop().toLowerCase();

					const validExtensions = {
						'png': [ 'png' ],
						'jpg': [ 'jpg', 'jpeg' ],
						'jpeg': [ 'jpg', 'jpeg' ]
					};

					if ( validExtensions[ type ] && ! validExtensions[ type ].includes( extension ) ) {

						console.warn( `Texture type mismatch: expected ${type} but got .${extension} for file ${file.name}` );

					}

				}

			}

		}

		// Assign placeholder immediately for all matching textures
		for ( const [ j, t ] of this.cityTextures.entries() ) {

			if ( t.image.includes( file.name ) ) {

				const placeholder = this.placeholderTexture.clone();
				placeholder.name = 'placeholder';
				this._configureTexture( placeholder, j );
				this.textures[ j ] = placeholder;
				this._updateMaterialTexture( j, placeholder );

			}

		}
		this.needsUpdate = true;
		if ( this.onChange ) {

			this.onChange();

		}


		const extension = file.name.split( '.' ).pop().toLowerCase();

		// Handle compressed textures from file
		if ( ( extension === 'ktx2' && this.options.ktx2Loader ) || ( extension === 'dds' && this.options.ddsLoader ) ) {

			const url = URL.createObjectURL( file );
			let loader;
			if ( extension === 'ktx2' ) loader = this.options.ktx2Loader;
			else loader = this.options.ddsLoader;

			const masterTex = loader.load( url, ( loadedTex ) => {

				URL.revokeObjectURL( url );

				loadedTex.name = file.name;
				this.textureCache[ file.name ] = loadedTex;

				for ( const [ j, t ] of this.cityTextures.entries() ) {

					if ( t.image.includes( file.name ) ) {

						const tex = loadedTex.clone();
						this._configureTexture( tex, j );
						this.textures[ j ] = tex;
						this._updateMaterialTexture( j, tex );

					}

				}

				this.needsUpdate = true;
				if ( this.onChange ) {

					this.onChange();

				}

			}, undefined, ( err ) => {

				URL.revokeObjectURL( url );
				if ( this.onError ) {

					this.onError( { type: 'load', url: file.name, error: err } );

				} else {

					console.error( `Failed to load texture from file ${file.name}:`, err );

				}

			} );

			return;

		}


		let fileReaderStarted = false;

		for ( const [ i, texture ] of this.cityTextures.entries() ) { // eslint-disable-line no-unused-vars

			if ( texture.image.includes( file.name ) ) {

				if ( ! fileReaderStarted ) {

					fileReaderStarted = true;
					const reader = new FileReader();

					reader.onload = event => {

						const img = new Image();

						img.onerror = err => {

							if ( this.onError ) {

								this.onError( { type: 'load', url: file.name, error: err } );

							} else {

								console.error( `Failed to load texture from file ${file.name}:`, err );

							}

						};

						img.onload = evt => {

							const masterTex = new Texture( evt.target );
							masterTex.name = file.name;

							this.textureCache[ file.name ] = masterTex;

							for ( const [ j, t ] of this.cityTextures.entries() ) {

								if ( t.image.includes( file.name ) ) {

									const tex = masterTex.clone();
									this._configureTexture( tex, j );

									this.textures[ j ] = tex;
									this._updateMaterialTexture( j, tex );

								}

							}

							this.needsUpdate = true;
							if ( this.onChange ) {

								this.onChange();

							}

						};

						img.src = event.target.result;

					};

					reader.readAsDataURL( file );

				}

			}

		}

	}

}
