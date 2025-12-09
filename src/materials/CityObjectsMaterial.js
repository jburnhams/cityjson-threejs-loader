import { ShaderChunk, UniformsLib, UniformsUtils } from "three";
import { CityObjectsBaseMaterial } from "./CityObjectsBaseMaterial";

export class CityObjectsMaterial extends CityObjectsBaseMaterial {

	constructor( shader, parameters ) {

		const newShader = { ...shader };
		newShader.uniforms = {
			...UniformsUtils.clone( UniformsLib.cityobject ),
			...UniformsUtils.clone( shader.uniforms ),
		};
		newShader.extensions = {
			derivatives: true,
		};
		newShader.lights = true;
		newShader.vertexShader =
		ShaderChunk.cityobjectinclude_vertex +
		newShader.vertexShader.replace(
			/#include <fog_vertex>/,
			`
			#include <fog_vertex>
			`
			+ ShaderChunk.cityobjectdiffuse_vertex
			+ ShaderChunk.cityobjectshowlod_vertex
		);
		newShader.fragmentShader =
		`
			varying vec3 diffuse_;
			varying float discard_;

			#ifdef TEXTURE_THEME

				uniform sampler2D cityTexture;

				#ifdef USE_CITY_NORMALMAP
					uniform sampler2D cityTextureNormal;
				#endif
				#ifdef USE_CITY_ROUGHNESSMAP
					uniform sampler2D cityTextureRoughness;
				#endif
				#ifdef USE_CITY_METALNESSMAP
					uniform sampler2D cityTextureMetalness;
				#endif
				#ifdef USE_CITY_AOMAP
					uniform sampler2D cityTextureAO;
				#endif
				#ifdef USE_CITY_EMISSIVEMAP
					uniform sampler2D cityTextureEmissive;
				#endif

				uniform vec4 borderColor;
				uniform int useBorderColor;

				flat in int vTexIndex;
				varying vec2 vTexUV;

			#endif

			#ifdef MATERIAL_THEME

				varying vec3 emissive_;
			
			#endif
		` +
		newShader.fragmentShader.replace(
			/vec4 diffuseColor = vec4\( diffuse, opacity \);/,
			`
			vec4 diffuseColor = vec4( diffuse_, opacity );

			#ifdef TEXTURE_THEME

				if ( vTexIndex > - 1 ) {

					vec4 tempDiffuseColor = vec4(1.0, 1.0, 1.0, 0.0);

					// Check for border color case (when UVs are outside [0,1])
					// We use borderColor if useBorderColor is true (1).

					bool outside = vTexUV.x < 0.0 || vTexUV.x > 1.0 || vTexUV.y < 0.0 || vTexUV.y > 1.0;

					if ( outside && useBorderColor == 1 ) {
						tempDiffuseColor = borderColor;
					} else {
						tempDiffuseColor = texture2D( cityTexture, vTexUV );
					}

					diffuseColor *= tempDiffuseColor;

				}

			#endif

			#ifdef SHOW_LOD

				if ( discard_ > 0.0 ) {
					discard;
				}
			
			#endif
			`
		).replace(
			/vec3 totalEmissiveRadiance = emissive;/,
			`
			#ifdef MATERIAL_THEME

				vec3 totalEmissiveRadiance = emissive_;

			#else

				vec3 totalEmissiveRadiance = emissive;

			#endif
			`
		);

		// Inject Normal Map logic
		newShader.fragmentShader = newShader.fragmentShader.replace(
			/#include <normal_fragment_maps>/,
			`
			#ifdef TEXTURE_THEME
				#ifdef USE_CITY_NORMALMAP
					if ( vTexIndex > -1 ) {
						vec3 mapN = texture2D( cityTextureNormal, vTexUV ).xyz * 2.0 - 1.0;
						mapN.xy *= normalScale;

						#ifdef USE_TANGENT
							normal = normalize( vTBN * mapN );
						#else
							normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
						#endif
					} else {
						#include <normal_fragment_maps>
					}
				#else
					#include <normal_fragment_maps>
				#endif
			#else
				#include <normal_fragment_maps>
			#endif
			`
		);

		// Inject Roughness logic
		newShader.fragmentShader = newShader.fragmentShader.replace(
			/#include <roughnessmap_fragment>/,
			`
			float roughnessFactor = roughness;
			#ifdef TEXTURE_THEME
				#ifdef USE_CITY_ROUGHNESSMAP
					if ( vTexIndex > -1 ) {
						vec4 texelRoughness = texture2D( cityTextureRoughness, vTexUV );
						roughnessFactor *= texelRoughness.g;
					}
				#endif
			#endif
			#include <roughnessmap_fragment>
			`
		);

		// Inject Metalness logic
		newShader.fragmentShader = newShader.fragmentShader.replace(
			/#include <metalnessmap_fragment>/,
			`
			float metalnessFactor = metalness;
			#ifdef TEXTURE_THEME
				#ifdef USE_CITY_METALNESSMAP
					if ( vTexIndex > -1 ) {
						vec4 texelMetalness = texture2D( cityTextureMetalness, vTexUV );
						metalnessFactor *= texelMetalness.b;
					}
				#endif
			#endif
			#include <metalnessmap_fragment>
			`
		);

		// Inject AO logic
		newShader.fragmentShader = newShader.fragmentShader.replace(
			/#include <aomap_fragment>/,
			`
			#ifdef TEXTURE_THEME
				#ifdef USE_CITY_AOMAP
					if ( vTexIndex > -1 ) {
						float ao = texture2D( cityTextureAO, vTexUV ).r;
						reflectedLight.indirectDiffuse *= ao;
					}
				#endif
			#endif
			#include <aomap_fragment>
			`
		);

		super( newShader );

		this.setValues( parameters );

	}

}
