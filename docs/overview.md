# CityJSON Three.js Loader - Technical Overview

## Purpose

This library parses CityJSON format files and renders them as interactive 3D models using Three.js. It provides a production-ready, performant solution for visualizing urban 3D data in web browsers, supporting geometry parsing, appearance rendering, semantic coloring, and interactive selection.

## Architecture

### Core Components

The library follows a modular architecture with clear separation of concerns across parsing, geometry processing, materials, and rendering.

#### Entry Point (`src/index.js`)
Exports all public classes including `CityJSONLoader`, parser implementations (`CityJSONParser`, `CityJSONWorkerParser`), and city object wrappers for external consumption.

#### CityJSONLoader (`src/base/CityJSONLoader.js`)
Top-level orchestrator responsible for:
- Accepting a parser instance and raw CityJSON data
- Computing transformation matrices to center geometry at the origin
- Applying CityJSON transform properties (scale, translate)
- Managing the Three.js scene group containing all rendered objects
- Providing texture path configuration via `setTexturesPath()`

The loader handles coordinate transformation by calculating bounding boxes and creating a centering matrix, ensuring geometry is properly positioned for rendering.

#### Parser Architecture

Two parser implementations provide synchronous and asynchronous processing:

**CityJSONParser** (`src/parsers/CityJSONParser.js`)
- Synchronous, blocking parser suitable for small datasets
- Processes data on the main thread
- Uses `ChunkParser` for incremental object processing

**CityJSONWorkerParser** (`src/parsers/CityJSONWorkerParser.js`)
- Recommended asynchronous parser using Web Workers
- Non-blocking parsing prevents UI freezing on large files
- Emits `onChunkLoad` callbacks for progressive rendering
- Emits `onComplete` when parsing finishes
- Uses `ParserWorker` (`src/parsers/helpers/ParserWorker.js`) as worker entry point

Both parsers:
- Create geometry-type-specific parsers (Triangle, Line, Point)
- Manage material and texture themes
- Handle geometry templates and instancing for memory efficiency
- Support Level of Detail (LOD) parsing
- Process objects in configurable chunks (default ~2000 objects)

### Geometry Processing

#### BaseParser (`src/parsers/geometry/BaseParser.js`)
Abstract base class providing shared functionality for all geometry parsers:
- `getObjectIdx()` - Resolves object identifiers to indices
- `getObjectTypeIdx()` - Maps CityJSON object types to color indices
- `getSurfaceTypeIdx()` - Extracts semantic surface type information
- `getSurfaceMaterials()` - Retrieves material assignments per surface
- `getTextureData()` - Extracts texture indices and UV coordinates from appearance data
- `getLodIndex()` - Manages Level of Detail indexing

#### TriangleParser (`src/parsers/geometry/TriangleParser.js`)
Handles surface-based geometries (`Solid`, `MultiSolid`, `MultiSurface`, `CompositeSurface`):
- Flattens 3D solid geometries to collections of surfaces for uniform processing
- Triangulates polygons with holes using the earcut library
- Implements Newell's method for calculating surface normals
- Projects 3D polygons to 2D planes for triangulation
- Accumulates vertex positions, normals, and metadata into `GeometryData`

#### LineParser (`src/parsers/geometry/LineParser.js`)
Processes `MultiLineString` geometries:
- Creates line segments between consecutive vertices
- Preserves semantic information and LOD data
- Outputs data for `CityObjectsLines` rendering

#### PointParser (`src/parsers/geometry/PointParser.js`)
Handles `MultiPoint` geometries:
- Collects point positions as vertex data
- Minimal processing required for point cloud visualization

#### GeometryData (`src/parsers/geometry/GeometryData.js`)
Data structure accumulating parsed geometry information:
- `vertexIds[]` - Indices into the vertex array
- `objectIds[]` - Object index per vertex
- `objectType[]` - Object type indices for color lookup
- `semanticSurfaces[]` - Surface semantic type indices
- `geometryIds[]` - Geometry index within each object
- `boundaryIds[]` - Surface boundary indices for selection
- `lodIds[]` - Level of Detail indices
- `materials{}` - Material assignments per theme
- `textures{}` - Texture indices and UV coordinates per theme

### Three.js Object Wrappers

#### CityObjectsMesh (`src/objects/CityObjectsMesh.js`)
Wraps Three.js `Mesh` for triangulated geometry:
- Creates `BufferGeometry` with custom attributes (objectid, type, surfacetype, geometryid, lodid, boundaryid)
- Stores material theme attributes (`mat{themeName}`)
- Stores texture theme attributes (`tex{themeName}`, `tex{themeName}uv`)
- Implements `setTextureTheme()` for applying texture materials via geometry groups
- Implements `resolveIntersectionInfo()` for raycasting and selection
- Supports conditional formatting via `addAttributeByProperty()`
- Computes vertex normals automatically

#### CityObjectsLines (`src/objects/CityObjectsLines.js`)
Wraps Three.js `LineSegments2` for line geometry with similar attribute structure.

#### CityObjectsPoints (`src/objects/CityObjectsPoints.js`)
Wraps Three.js `Points` for point cloud rendering with similar attribute structure.

#### CityObjectsInstancedMesh (`src/objects/CityObjectsInstancedMesh.js`)
Wraps Three.js `InstancedMesh` for geometry templates:
- Reuses single geometry definition across multiple instances
- Applies transformation matrices per instance
- Dramatically reduces memory for repeated geometry patterns

### Material System

#### CityObjectsBaseMaterial (`src/materials/CityObjectsBaseMaterial.js`)
Base shader material class defining the rendering pipeline:

**Custom Uniforms:**
- `objectColors[]` - Color per object type
- `surfaceColors[]` - Color per semantic surface type
- `attributeColors[]` - Colors for conditional formatting
- `cityMaterials[]` - CityJSON appearance materials
- `cityTexture` - Texture sampler
- `showLod` - Filter by Level of Detail
- `highlightedObjId`, `highlightedGeomId`, `highlightedBoundId` - Selection highlighting
- `highlightColor` - Highlight color (default amber)

**Shader Defines:**
- `SHOW_SEMANTICS` - Color by surface semantic type instead of object type
- `SHOW_LOD` - Display only specified LOD level
- `MATERIAL_THEME` - Apply CityJSON appearance materials (diffuse, emissive, specular)
- `TEXTURE_THEME` - Apply UV-mapped textures
- `COLOR_ATTRIBUTE` - Conditional formatting based on object attributes
- `SELECT_SURFACE` - Highlight specific surface boundary

**Custom Shader Chunks:**
- `cityobjectinclude_vertex` - Vertex shader declarations
- `cityobjectdiffuse_vertex` - Diffuse color computation logic
- `cityobjectshowlod_vertex` - LOD filtering logic

#### CityObjectsMaterial (`src/materials/CityObjectsMaterial.js`)
Lambert-based lighting shader for meshes:
- Injects custom vertex shader chunks into Three.js Lambert shader
- Replaces fragment shader diffuse color with computed `diffuse_` varying
- Samples textures when `TEXTURE_THEME` is defined
- Applies material emissive colors when `MATERIAL_THEME` is defined
- Enables derivatives extension for normal computation

#### CityObjectsLineMaterial (`src/materials/CityObjectsLineMaterial.js`)
Custom line shader with variable width control and world-space or screen-space sizing.

#### CityObjectsPointsMaterial (`src/materials/CityObjectsPointsMaterial.js`)
Point rendering shader with size control.

### Appearance Management

#### TextureManager (`src/helpers/TextureManager.js`)
Manages texture loading and material creation:
- Extracts texture definitions from `appearance.textures` in CityJSON
- Loads textures from URLs via `THREE.TextureLoader`
- Supports loading textures from user-uploaded files
- Creates per-texture materials by cloning base material and assigning texture to `cityTexture` uniform
- Returns material array with fallback base material
- Uses `RepeatWrapping` and `SRGBColorSpace` for all textures
- Emits `onChange` callback when textures load asynchronously

**Current Implementation:**
- Textures loaded asynchronously on initialization
- One `sampler2D` per material
- Materials indexed by geometry groups in `CityObjectsMesh.setTextureTheme()`
- UV coordinates stored as vertex attributes (`tex{themeName}uv`)

#### AttributeEvaluator (`src/helpers/AttributeEvaluator.js`)
Evaluates object attributes for conditional formatting:
- Traverses CityJSON object hierarchy (parent/child relationships)
- Extracts attribute values by property path
- Generates unique value sets and color mappings
- Enables coloring objects by dynamic property values

### Parsing Pipeline

1. **Load**: `CityJSONLoader.load(data)` receives CityJSON object
2. **Transform**: Computes centering matrix from bounding box
3. **Parse**: Parser processes objects in chunks via `ChunkParser`
4. **Geometry Classification**: Each geometry classified as TRIANGLES, LINES, or POINTS
5. **Geometry Parsing**: Type-specific parsers extract vertices and metadata into `GeometryData`
6. **Instancing**: Geometry templates create `InstancedMesh` objects with transform matrices
7. **Material Creation**: Materials created with object/surface color themes
8. **Three.js Objects**: GeometryData converted to `CityObjectsMesh`, `CityObjectsLines`, or `CityObjectsPoints`
9. **Scene Assembly**: Objects added to loader's scene group

### Supported CityJSON Features

**Geometry Types:**
- Solid, MultiSolid (converted to triangulated surfaces)
- MultiSurface, CompositeSurface (triangulated)
- MultiLineString (rendered as line segments)
- MultiPoint (rendered as point cloud)
- GeometryInstance (instanced meshes with transforms)

**Appearance:**
- Material themes (diffuse, emissive, specular colors)
- Texture themes (UV-mapped textures from `appearance.textures`)
- Semantic surface types with color mapping

**Metadata:**
- Level of Detail (LOD) per geometry
- Semantic surfaces (wall, roof, ground, etc.)
- Custom object attributes for conditional formatting

**Advanced Features:**
- Geometry templates and instancing for memory efficiency
- Worker-based asynchronous parsing for large files
- Chunked processing and progressive rendering
- Raycasting and intersection detection
- Object and surface highlighting
- LOD visualization and filtering

### Rendering Features

**Interactive Selection:**
- `resolveIntersectionInfo()` returns object ID, geometry index, boundary index, semantic type
- Materials support highlighting via `highlightedObject` property
- Custom highlight colors configurable

**Conditional Formatting:**
- Color objects by attribute values using `AttributeEvaluator`
- Dynamic color mapping based on object properties
- Supports parent/child attribute traversal

**Level of Detail:**
- Filter rendering by LOD level via material `showLod` property
- Useful for performance optimization at different zoom levels

**Semantic Coloring:**
- Toggle between object-type coloring and semantic-surface coloring
- Customizable color schemes via material properties

### Performance Optimizations

- **Web Worker Parsing**: Non-blocking parsing via `CityJSONWorkerParser`
- **Chunked Processing**: Objects processed in batches to prevent memory spikes
- **Geometry Instancing**: Reuses geometry for templates to reduce memory
- **Progressive Rendering**: `onChunkLoad` callbacks enable incremental display
- **Efficient Attributes**: Compact data types (Uint8Array, Int8Array) for metadata

### File Structure

```
src/
├── index.js                          # Public API exports
├── base/
│   └── CityJSONLoader.js            # Main loader orchestrator
├── parsers/
│   ├── CityJSONParser.js            # Synchronous parser
│   ├── CityJSONWorkerParser.js      # Worker-based parser
│   ├── geometry/
│   │   ├── BaseParser.js            # Base geometry parser
│   │   ├── TriangleParser.js        # Surface geometry
│   │   ├── LineParser.js            # Line geometry
│   │   ├── PointParser.js           # Point geometry
│   │   └── GeometryData.js          # Parsed data structure
│   └── helpers/
│       ├── ChunkParser.js           # Chunked processing
│       └── ParserWorker.js          # Worker entry point
├── materials/
│   ├── CityObjectsBaseMaterial.js   # Base shader material
│   ├── CityObjectsMaterial.js       # Lambert mesh material
│   ├── CityObjectsLineMaterial.js   # Line material
│   └── CityObjectsPointsMaterial.js # Point material
├── objects/
│   ├── CityObjectsMesh.js           # Mesh wrapper
│   ├── CityObjectsLines.js          # Line wrapper
│   ├── CityObjectsPoints.js         # Points wrapper
│   └── CityObjectsInstancedMesh.js  # Instanced mesh wrapper
├── helpers/
│   ├── TextureManager.js            # Texture loading
│   └── AttributeEvaluator.js        # Attribute evaluation
└── defaults/
    └── colors.js                    # Default color schemes
```

### Usage Pattern

```javascript
import { CityJSONLoader, CityJSONWorkerParser } from 'cityjson-threejs-loader';

const parser = CityJSONWorkerParser();
const loader = new CityJSONLoader(parser);

parser.onChunkLoad = () => console.log('Chunk loaded');
parser.onComplete = () => console.log('Loading complete');

fetch('model.city.json')
  .then(response => response.json())
  .then(data => {
    loader.load(data);
    scene.add(loader.scene);
  });
```

### Extensibility

The modular design enables:
- Custom geometry parsers by extending `BaseParser`
- Custom materials by extending `CityObjectsBaseMaterial`
- Custom object wrappers for specialized rendering
- Custom color schemes via material properties
- Conditional formatting rules via `AttributeEvaluator`
