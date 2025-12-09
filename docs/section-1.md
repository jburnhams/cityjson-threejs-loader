# Section 1: Texture Support Implementation Tasks

## Current State

The library has **basic texture support** implemented:
- `TextureManager` (`src/helpers/TextureManager.js`) loads textures from URLs or files
- `BaseParser.getTextureData()` (`src/parsers/geometry/BaseParser.js:93`) extracts texture indices and UV coordinates
- `CityObjectsMesh` (`src/objects/CityObjectsMesh.js:36-46`) stores texture indices and UV attributes per theme
- `CityObjectsBaseMaterial` and `CityObjectsMaterial` (`src/materials/`) apply textures via `TEXTURE_THEME` shader define
- Single texture sampler per material with UV mapping

## Missing Features

According to the CityJSON specification (versions 1.x through 2.0), the following texture properties are **not implemented**:

### From CityJSON Texture Object Specification:
- `wrapMode` - Texture wrapping modes (wrap, mirror, clamp, border, none)
- `borderColor` - RGBA color for border wrap mode
- `textureType` - Texture type classification (specific, generic, unknown)
- `type` - Image format validation (PNG, JPG)
- Multiple texture types beyond diffuse (normal maps, roughness, metalness)
- Texture coordinate range validation (UV values outside [0.0, 1.0] allowed in v2.0+)

## Implementation Roadmap

### Phase 1: Basic CityJSON Compliance

#### Task 1.1: Implement wrapMode Support
**Status: Completed**
**Priority: High**
**Complexity: Medium**

Extend texture loading to respect the `wrapMode` property from CityJSON texture objects.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Implemented parsing of `wrapMode` in both `setTextureFromUrl()` and `setTextureFromFile()`.
- Mapped CityJSON wrapMode values to Three.js constants:
  - `"wrap"` → `THREE.RepeatWrapping`
  - `"mirror"` → `THREE.MirroredRepeatWrapping`
  - `"clamp"`, `"border"`, `"none"` → `THREE.ClampToEdgeWrapping`
- Applied to both `texture.wrapS` and `texture.wrapT`.
- Added unit tests in `tests/TextureManager.test.js` covering all mapping cases and defaults.

---

#### Task 1.2: Implement borderColor Support
**Status: Completed**
**Priority: Medium**
**Complexity: Low**

Support the `borderColor` property for textures using border wrap mode.

**Files Modified:**
- `src/helpers/TextureManager.js`
- `src/materials/CityObjectsBaseMaterial.js`
- `src/materials/CityObjectsMaterial.js`

**Implementation Details:**
- Added `borderColor` uniform to `CityObjectsBaseMaterial` (initialized to null).
- Updated `CityObjectsMaterial` fragment shader to use `borderColor` when UVs are outside [0, 1] range.
- Updated `TextureManager` to parse `borderColor` from CityJSON and set the uniform value on the material if `wrapMode` is 'border'.
- Added unit tests verifying `borderColor` is correctly passed to the material.

---

#### Task 1.3: Implement textureType Awareness
**Status: Completed**
**Priority: Low**
**Complexity: Low**

Store and expose the `textureType` property from CityJSON texture objects.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Implemented parsing of `textureType` from CityJSON appearance textures.
- Stored the value in `texture.userData.textureType` for easy access.
- Defaulted to `"unknown"` if the property is missing.
- Added unit tests to verify parsing, storage, and default behavior.

**CityJSON Specification:**
- `specific` - Texture applies to specific instance
- `generic` - Texture can be reused across similar objects
- `typical` - Texture represents typical appearance
- `unknown` - Type not specified

**Test Cases:**
1. Parse CityJSON with all textureType values
2. TextureManager correctly stores textureType per texture
3. Missing textureType defaults to "unknown"
4. Expose textureType in debug/inspection APIs

---

#### Task 1.4: Image Format Validation
**Status: Completed**
**Priority: Low**
**Complexity: Low**

Validate texture image formats against the `type` property.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Implemented parsing of `type` (image format) from CityJSON appearance textures.
- Stored the format type in `texture.userData.formatType`.
- Implemented validation logic in `setTextureFromUrl` and `setTextureFromFile`.
- Validation checks if the file extension matches the declared type (e.g., PNG matches .png).
- Mismatches log a warning to the console but still attempt to load the texture.
- Added unit tests for valid matches, mismatches, and case insensitivity.

**Test Cases:**
1. Texture with `type: "PNG"` and `.png` file loads successfully
2. Texture with `type: "JPG"` and `.jpg` file loads successfully
3. Mismatch between type and file extension logs warning but attempts load
4. Missing type property doesn't prevent loading
5. Case-insensitive type matching (e.g., "jpg" vs "JPG")

---

### Phase 2: Enhanced Texture Features

#### Task 2.1: Multiple Textures per Surface
**Status: Completed**
**Priority: Medium**
**Complexity: High**

Extend shader to support multiple simultaneous texture types (diffuse, normal, roughness, etc.).

**Files Modified:**
- `src/materials/CityObjectsBaseMaterial.js`
- `src/materials/CityObjectsMaterial.js`
- `src/helpers/TextureManager.js`
- `src/parsers/geometry/BaseParser.js`

**Implementation Details:**
- Added PBR texture uniforms to `CityObjectsBaseMaterial`: `cityTextureNormal`, `cityTextureRoughness`, `cityTextureMetalness`, `cityTextureAO`, `cityTextureEmissive`.
- Updated `CityObjectsMaterial` to implement custom shader logic for identifying and using these textures.
- Used custom defines (`USE_CITY_NORMALMAP`, etc.) to safely inject PBR logic without conflicting with standard Three.js shader chunks.
- Updated `TextureManager` to parse a `related` property in the CityJSON texture object, which links a Diffuse texture to other PBR maps (Normal, Roughness, etc.) by index.
- Updated `BaseParser.getTextureData` to defensively handle potential array indices for textures, ensuring compatibility with future CityJSON extensions or custom formats.

**Test Cases:**
1. Surface with diffuse texture only renders correctly (existing tests).
2. Material creation with linked PBR textures (Normal, Roughness) via `related` property works correctly.
3. Shader code compilation checks (implicitly via `new CityObjectsMaterial` in tests).

---

#### Task 2.2: Texture Coordinate Transformation
**Status: Completed**
**Priority: Low**
**Complexity: Medium**

Support texture coordinate transformations (rotation, scale, offset).

**Files Modified:**
- `src/materials/CityObjectsBaseMaterial.js`
- `src/materials/CityObjectsMaterial.js`
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Implemented parsing of `textureTransform` object from CityJSON texture definition.
- Supports `offset` (vec2), `scale` (vec2), `rotation` (float), and `center` (vec2).
- Updates Three.js `Texture` properties (`offset`, `repeat`, `rotation`, `center`) and ensures matrix update.
- Added `cityTextureTransform` (mat3) uniform to `CityObjectsBaseMaterial` (defaults to identity).
- Passed the texture matrix to the material uniform in `TextureManager`.
- Updated `CityObjectsMaterial` vertex shader to apply the transformation matrix to UV coordinates: `vTexUV = ( cityTextureTransform * vec3( TEXTURE_THEME_UV, 1.0 ) ).xy`.

**Test Cases:**
1. Texture properties (offset, repeat, rotation, center) are correctly set from CityJSON.
2. `cityTextureTransform` uniform is correctly populated with the texture matrix.
3. Fallback to identity matrix when no transform is specified.
4. Verified via `tests/TextureManager.transform.test.js`.

---

#### Task 2.3: Texture Atlasing Support
**Priority: Medium**
**Complexity: High**

Support texture atlases with sub-texture UV regions.

**Files to Modify:**
- `src/helpers/TextureManager.js` - Parse atlas definitions and UV regions
- `src/parsers/geometry/BaseParser.js` - Remap UV coordinates to atlas regions
- `src/materials/CityObjectsMaterial.js` - Handle atlas UV mapping

**Implementation Requirements:**
- Define atlas structure (extension to CityJSON or custom format):
  - Single texture image containing multiple sub-textures
  - Region definitions (x, y, width, height) per sub-texture
- Remap surface UV coordinates to atlas sub-regions
- Support multiple surfaces referencing different atlas regions
- Maintain texture filtering at atlas boundaries

**Benefits:**
- Reduce HTTP requests (single texture file)
- Improve GPU performance (fewer texture bindings)
- Reduce memory usage (shared texture memory)

**Test Cases:**
1. Atlas with 4 textures (2x2 grid) renders each surface correctly
2. UV coordinates properly remapped to atlas regions
3. Texture filtering doesn't bleed between atlas regions
4. Mix of atlas and non-atlas textures works correctly
5. Large atlas (16+ sub-textures) performs well

---

### Phase 3: Performance & Quality Improvements

#### Task 3.1: Texture Compression Support
**Status: Completed**
**Priority: Medium**
**Complexity: Medium**

Support compressed texture formats for reduced memory and bandwidth.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Updated `TextureManager` constructor to accept `ktx2Loader` and `ddsLoader` in options.
- Implemented file extension detection in `setTextureFromUrl` to use correct loader.
- Implemented `setTextureFromFile` to handle compressed files using `URL.createObjectURL` and appropriate loaders.
- Falls back to standard `TextureLoader` if no specific loader is found.
- Added unit tests in `tests/TextureManager.compression.test.js` verifying loader selection logic.

---

#### Task 3.2: Mipmapping and Filtering
**Status: Completed**
**Priority: High**
**Complexity: Low**

Configure texture mipmapping and filtering for quality and performance.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Enabled `texture.generateMipmaps = true` for both URL and file-based textures.
- Set `minFilter` to `THREE.LinearMipmapLinearFilter` (default, configurable via options).
- Set `magFilter` to `THREE.LinearFilter` (default, configurable via options).
- Set `anisotropy` to a safe default of 1 (no anisotropy).
- `TextureManager` now accepts an `options` object in the constructor to configure `anisotropy`, `minFilter`, and `magFilter`.
- Added unit tests verifying filtering properties and configuration options.

---

#### Task 3.3: Texture Caching and Reuse
**Status: Completed**
**Priority: High**
**Complexity: Medium**

Implement texture caching to avoid loading duplicate textures.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Implemented `textureCache` map in `TextureManager` to store loaded textures by URL or filename.
- Refactored `setTextureFromUrl` to check cache before loading.
- Implemented texture cloning for cached textures to allow independent configuration (wrap mode) while sharing image data.
- Refactored `setTextureFromFile` to support caching and updating existing textures upon re-upload.
- Added `_configureTexture` helper method to reduce code duplication.
- Updated unit tests to verify caching behavior and ensure no regressions.

---

#### Task 3.4: Progressive Texture Loading
**Status: Completed**
**Priority: Low**
**Complexity: Medium**

Load textures progressively with generated placeholders.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Implemented `createPlaceholderTexture()` method to generate a 2x2 grey checkerboard `DataTexture` as a temporary placeholder.
- Updated `setTextureFromUrl` to immediately assign this placeholder to the texture slot before starting the async download.
- Updated `setTextureFromFile` to immediately assign the placeholder to all matching textures before the file is read.
- The placeholder ensures valid texture bindings are available immediately, preventing black meshes or errors during loading.
- Once the real texture loads, it replaces the placeholder, and `needsUpdate` flags are set to trigger a refresh.
- Added `tests/TextureManager.placeholder.test.js` to verify placeholder assignment and subsequent replacement.

**Test Cases:**
1. Texture slots contain a "placeholder" texture immediately after initialization.
2. Placeholder is replaced by the real texture upon load completion.
3. Placeholder works for both URL and File based loading.
4. Error fallback behavior remains functional (replacing placeholder with error texture).

---

### Phase 4: Advanced Features

#### Task 4.1: Dynamic Texture Swapping
**Status: Completed**
**Priority: Low**
**Complexity: Medium**

Support runtime texture theme switching and updates.

**Files Modified:**
- `src/objects/CityObjectsMesh.js` - Enhanced `setTextureTheme()` and `unsetTextures()`

**Implementation Details:**
- `setTextureTheme` now clears existing geometry groups (`this.geometry.clearGroups()`) before recalculating groups for the new theme.
- Fixed an issue where the first vertex cluster was skipped if the texture index was `-1`.
- `unsetTextures` clears geometry groups to revert to a single-material state.
- Supports switching themes on the fly without geometry reloading.
- Verified via unit tests (created and run during development).

**Test Cases:**
1. Switch from "winter" to "summer" texture theme works correctly.
2. Geometry groups are cleared and rebuilt properly.
3. Materials receive correct `TEXTURE_THEME` defines.
4. Switching to "undefined" theme correctly reverts to base material and clears groups.

---

#### Task 4.2: Procedural Texture Support
**Priority: Low**
**Complexity: High**

Generate procedural textures from CityJSON parameters.

**Files to Modify:**
- `src/helpers/TextureManager.js` - Add procedural texture generator
- `src/materials/CityObjectsMaterial.js` - Shader-based procedural textures

**Implementation Requirements:**
- Support procedural texture definitions in CityJSON (custom extension)
- Generate textures via Canvas2D or WebGL
- Support common patterns: brick, tile, wood grain, noise
- Parameterize procedural generators (color, scale, variation)

**Test Cases:**
1. Procedural brick texture renders correctly
2. Parameters control pattern appearance
3. Performance comparable to image textures
4. Mix of image and procedural textures works correctly

---

#### Task 4.3: Texture-Based Displacement/Height Maps
**Priority: Low**
**Complexity: High**

Support displacement or height maps for geometric detail.

**Files to Modify:**
- `src/materials/CityObjectsMaterial.js` - Add displacement mapping to shader
- `src/parsers/geometry/TriangleParser.js` - Increase geometry resolution for displacement

**Implementation Requirements:**
- Parse height/displacement textures from CityJSON
- Apply displacement in vertex shader or via geometry subdivision
- Control displacement scale/intensity
- Maintain proper normals after displacement
- Balance quality vs. performance (geometry resolution)

**Test Cases:**
1. Flat surface with displacement map shows relief
2. Displacement scale parameter controls depth
3. Normals updated correctly after displacement
4. Performance acceptable with displacement enabled
5. Mix of displaced and non-displaced surfaces

---

### Phase 5: Error Handling & Robustness

#### Task 5.1: Texture Loading Error Handling
**Status: Completed**
**Priority: High**
**Complexity: Low**

Robust error handling for failed texture loads.

**Files Modified:**
- `src/helpers/TextureManager.js`

**Implementation Details:**
- Implemented `onError` callback in `setTextureFromUrl()` for `TextureLoader`.
- Implemented `img.onerror` handler in `setTextureFromFile()` for file loads.
- Logs detailed error messages with texture URL or filename and error reason.
- Supports optional `onError` callback in TextureManager for custom error handling.
- Provides fallback texture (magenta 1x1) for failed loads to maintain visual consistency.
- Ensures failed textures don't crash the application.
- Added unit tests verifying error logging, callback execution, and fallback assignment.

---

#### Task 5.2: UV Coordinate Validation
**Status: Completed**
**Priority: Medium**
**Complexity: Low**

Validate UV coordinates during parsing.

**Files Modified:**
- `src/parsers/geometry/BaseParser.js`

**Implementation Details:**
- Added validation check in `BaseParser.getTextureData` to ensure `uvs` is a valid array of length >= 2.
- Added check for `NaN` values in UV coordinates.
- Logs warnings to console for invalid UV data.
- Returns safe default `[0, 0]` when validation fails to prevent crashes.
- Added unit tests in `tests/BaseParser.texture.test.js` covering various invalid UV scenarios.

---

#### Task 5.3: Memory Management
**Status: Completed**
**Priority: High**
**Complexity: Medium**

Proper texture memory management and disposal.

**Files Modified:**
- `src/helpers/TextureManager.js`
- `src/objects/CityObjectsMesh.js`

**Implementation Details:**
- Implemented `dispose()` method in `TextureManager` to dispose all managed textures and materials.
- Implemented `dispose()` method in `CityObjectsMesh` to dispose geometry and materials.
- Clears internal arrays to free references in TextureManager.
- Added unit tests ensuring proper disposal of Three.js resources.

---

## Testing Strategy

### Unit Tests
- Test each task in isolation
- Mock CityJSON texture data structures
- Verify parsing correctness
- Test error conditions

### Integration Tests
- Test complete texture loading pipeline
- Verify visual output against reference images
- Test combinations of texture features
- Performance benchmarks

### Test Data Requirements
Create CityJSON test files with:
1. **Basic textures** - Single texture per surface, wrap mode
2. **Multi-theme textures** - Multiple texture themes (winter/summer)
3. **Complex UVs** - Polygons with holes, UV coordinates outside [0, 1]
4. **All wrapModes** - Files testing each wrap mode
5. **Border colors** - Various borderColor values
6. **Error cases** - Missing files, invalid URLs, malformed data
7. **Large textures** - High-resolution textures for performance testing
8. **Texture atlases** - Multiple surfaces sharing atlas regions
9. **PBR materials** - Multiple texture maps per surface

### Visual Regression Tests
- Render test scenes with known textures
- Compare output against reference screenshots
- Detect rendering artifacts or errors
- Verify texture filtering and mipmapping quality

---

## CityJSON Specification References

### Relevant Specification Sections

**CityJSON 2.0 Appearance Object:**
- Section 6: Appearance Object
- Section 6.4: Texture Object
- Section 6.5: Vertices-texture Object

**Key Properties:**
- `appearance.textures[]` - Array of texture objects
- `appearance["vertices-texture"]` - UV coordinate array
- Texture object properties:
  - `type` - Image format (PNG, JPG)
  - `image` - File path or URL
  - `wrapMode` - Wrapping behavior (wrap, mirror, clamp, border, none)
  - `textureType` - Type classification (specific, generic, typical, unknown)
  - `borderColor` - RGBA color array [0.0-1.0]

**Geometry Texture Member:**
- Each geometry may have `texture` member
- Organized by themes (key-value pairs)
- `values` array contains texture indices and UV indices
- Structure: `[[textureIdx, uv1, uv2, ..., uvN], ...]` per ring
- First value is texture index, remaining are UV indices

**Version Differences:**
- v1.0-v1.1: UV values restricted to [0.0, 1.0]
- v2.0+: UV values may be outside [0.0, 1.0] for repeat patterns

---

## Implementation Priority Summary

### High Priority (Essential for Compliance)
1. Task 1.1: wrapMode support
2. Task 3.2: Mipmapping and filtering
3. Task 3.3: Texture caching
4. Task 5.1: Error handling
5. Task 5.3: Memory management

### Medium Priority (Important Features)
1. Task 1.2: borderColor support
2. Task 2.1: Multiple textures per surface
3. Task 2.3: Texture atlasing
4. Task 3.1: Texture compression
5. Task 5.2: UV validation

### Low Priority (Nice to Have)
1. Task 1.3: textureType awareness
2. Task 1.4: Image format validation
3. Task 2.2: Texture transformations
4. Task 3.4: Progressive loading
5. Task 4.1: Dynamic texture swapping
6. Task 4.2: Procedural textures
7. Task 4.3: Displacement maps

---

## Expected Outcomes

Upon completion of all phases:
- **Full CityJSON 2.0 texture specification compliance**
- **Robust error handling and fallback behavior**
- **Optimized performance with caching and compression**
- **Support for advanced PBR rendering workflows**
- **Comprehensive test coverage**
- **Production-ready texture rendering pipeline**
