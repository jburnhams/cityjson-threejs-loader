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

		this.options = {
			anisotropy: 1,
			minFilter: LinearMipmapLinearFilter,
			magFilter: LinearFilter,
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

	setTextureFromUrl( i, url ) {

		const context = this;

		new TextureLoader().load( url, ( tex => {

			tex.encoding = SRGBColorSpace;
			tex.generateMipmaps = true;
			tex.minFilter = this.options.minFilter;
			tex.magFilter = this.options.magFilter;
			tex.anisotropy = this.options.anisotropy;

			// Handle wrapMode
			const wrapModeStr = this.cityTextures[ i ].wrapMode || "wrap";
			let wrapMode = RepeatWrapping;

			if ( wrapModeStr === "mirror" ) {

				wrapMode = MirroredRepeatWrapping;

			} else if ( wrapModeStr === "clamp" || wrapModeStr === "border" || wrapModeStr === "none" ) {

				wrapMode = ClampToEdgeWrapping;

			}

			tex.wrapS = wrapMode;
			tex.wrapT = wrapMode;

			context.textures[ i ] = tex;

			this.needsUpdate = true;
			if ( this.onChange ) {

				this.onChange();

			}

		} ), undefined, ( err ) => {

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

	}

	loadFromUrl() {

		this.textures = [];

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

		for ( const mat of this.materials ) {

			mat.dispose();

		}

		this.materials = [];

	}

	setTextureFromFile( file ) {

		const context = this;

		for ( const [ i, texture ] of this.cityTextures.entries() ) {

			if ( texture.image.includes( file.name ) ) {

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

						const tex = new Texture( evt.target );

						tex.encoding = SRGBColorSpace;
						tex.generateMipmaps = true;
						tex.minFilter = this.options.minFilter;
						tex.magFilter = this.options.magFilter;
						tex.anisotropy = this.options.anisotropy;

						// Handle wrapMode
						const wrapModeStr = texture.wrapMode || "wrap";
						let wrapMode = RepeatWrapping;

						if ( wrapModeStr === "mirror" ) {

							wrapMode = MirroredRepeatWrapping;

						} else if ( wrapModeStr === "clamp" || wrapModeStr === "border" || wrapModeStr === "none" ) {

							wrapMode = ClampToEdgeWrapping;

						}

						tex.wrapS = wrapMode;
						tex.wrapT = wrapMode;
						tex.needsUpdate = true;

						context.textures[ i ] = tex;

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
