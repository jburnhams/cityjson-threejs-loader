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

		tex.needsUpdate = true;

		return tex;

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

			// For compressed textures (loaded via KTX2Loader/DDSLoader), .clone() might not work as expected
			// because they inherit from CompressedTexture which has different properties.
			// However, three.js Textures (including compressed) should support clone().
			// But careful: KTX2Loader returns a CompressedTexture.

			const tex = cachedTex.clone();

			this._configureTexture( tex, i );
			this.textures[ i ] = tex;

			this.needsUpdate = true;
			if ( this.onChange ) {

				this.onChange();

			}

			return;

		}

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

		// Load new texture and cache it
		const tex = loader.load( url, ( loadedTex ) => {

			// For compressed textures, properties like flipY might need adjustment depending on format,
			// but generally we just use what we get.

			// Compressed textures might not support generateMipmaps = true if they don't have them?
			// But _configureTexture sets it. KTX2 often has mipmaps.

			this.needsUpdate = true;
			if ( this.onChange ) {

				this.onChange();

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

		// Cache immediately
		this.textureCache[ url ] = tex;

		// Configure instance
		this._configureTexture( tex, i );

		this.textures[ i ] = tex;

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

					// Map common types to extensions
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

		const extension = file.name.split( '.' ).pop().toLowerCase();

		// Handle compressed textures from file
		if ( ( extension === 'ktx2' && this.options.ktx2Loader ) || ( extension === 'dds' && this.options.ddsLoader ) ) {

			const url = URL.createObjectURL( file );
			let loader;
			if ( extension === 'ktx2' ) loader = this.options.ktx2Loader;
			else loader = this.options.ddsLoader;

			const masterTex = loader.load( url, () => {

				URL.revokeObjectURL( url );

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

			masterTex.name = file.name;

			// Update cache
			this.textureCache[ file.name ] = masterTex;

			// Assign to all matching textures
			for ( const [ j, t ] of this.cityTextures.entries() ) {

				if ( t.image.includes( file.name ) ) {

					// Note: Cloning compressed textures might be tricky if not fully loaded yet,
					// but three.js usually handles it.
					const tex = masterTex.clone();
					this._configureTexture( tex, j );

					this.textures[ j ] = tex;

				}

			}

			return;

		}


		// Always reload the file if provided by the user, even if cached.
		// This supports re-uploading modified files with the same name.
		// The cache will be updated with the new texture.

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

							// Update cache (overwriting if exists)
							this.textureCache[ file.name ] = masterTex;

							// Now assign to all matching textures
							for ( const [ j, t ] of this.cityTextures.entries() ) {

								if ( t.image.includes( file.name ) ) {

									const tex = masterTex.clone();
									this._configureTexture( tex, j );

									this.textures[ j ] = tex;

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
