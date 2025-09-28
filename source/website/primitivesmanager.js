import { Mesh } from '../engine/model/mesh.js';
import { PhongMaterial } from '../engine/model/material.js';
import { RGBColor } from '../engine/model/color.js';
import { Coord3D } from '../engine/geometry/coord3d.js';
import { AddDiv } from '../engine/viewer/domutils.js';

export class PrimitivesManager
{
    constructor(viewer, model)
    {
        this.viewer = viewer;
        this.model = model;
        this.primitiveObjects = [];
        this.selectedObject = null;
        this.isEnabled = false;
        this.transformInfo = null;

        this.InitUI();
        this.InitKeyboardControls();

        // If starting with an empty scene, auto show the primitives bar for convenience
        if (this.model && this.model.MeshCount && this.model.MeshCount() === 0) {
            const primitivesBar = document.getElementById('primitives_bar');
            if (primitivesBar) {
                primitivesBar.style.display = 'block';
                this.isEnabled = true;
                this.ShowTransformInfo();
            }
        }
    }

    InitUI()
    {
        // Create New button event
        const createButton = document.getElementById('create_new_button');
        if (createButton) {
            createButton.addEventListener('click', () => {
                this.TogglePrimitivesBar();
            });
        }

        // Primitive icon events
        const primitiveIcons = document.querySelectorAll('.primitive_icon');
        primitiveIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                const primitiveType = e.currentTarget.dataset.primitive;
                this.CreatePrimitive(primitiveType);
                this.SetActiveIcon(e.currentTarget);
            });
        });

        // Create transform info display
        this.transformInfo = AddDiv(document.body, 'transform_info');
        this.transformInfo.innerHTML = 'WASD: Move | QE: Up/Down | RF: Scale | TG: Rotate | ESC: Deselect';
    }

    InitKeyboardControls()
    {
        document.addEventListener('keydown', (e) => {
            if (!this.selectedObject || !this.isEnabled) return;

            e.preventDefault();
            const step = e.shiftKey ? 0.5 : 0.1;
            const rotStep = e.shiftKey ? 15 : 5;
            const scaleStep = e.shiftKey ? 0.1 : 0.05;

            switch(e.key.toLowerCase()) {
                // Movement
                case 'w': this.TransformObject(this.selectedObject, 'moveZ', step); break;
                case 's': this.TransformObject(this.selectedObject, 'moveZ', -step); break;
                case 'a': this.TransformObject(this.selectedObject, 'moveX', -step); break;
                case 'd': this.TransformObject(this.selectedObject, 'moveX', step); break;
                case 'q': this.TransformObject(this.selectedObject, 'moveY', step); break;
                case 'e': this.TransformObject(this.selectedObject, 'moveY', -step); break;

                // Scale
                case 'r': this.TransformObject(this.selectedObject, 'scale', 1 + scaleStep); break;
                case 'f': this.TransformObject(this.selectedObject, 'scale', 1 - scaleStep); break;

                // Rotation
                case 't': this.TransformObject(this.selectedObject, 'rotateY', rotStep); break;
                case 'g': this.TransformObject(this.selectedObject, 'rotateY', -rotStep); break;

                // Color change
                case 'c': this.ChangeObjectColor(this.selectedObject); break;

                // Deselect
                case 'escape': this.DeselectObject(); break;
            }
        });
    }

    TogglePrimitivesBar()
    {
        const primitivesBar = document.getElementById('primitives_bar');
        if (primitivesBar) {
            const isVisible = primitivesBar.style.display !== 'none';
            primitivesBar.style.display = isVisible ? 'none' : 'block';
            this.isEnabled = !isVisible;

            if (this.isEnabled) {
                this.ShowTransformInfo();
            } else {
                this.HideTransformInfo();
                this.DeselectObject();
            }
        }
    }

    CreatePrimitive(type)
    {
        const mesh = this.GeneratePrimitiveMesh(type);
        if (!mesh) return;

        // Create material
        const material = new PhongMaterial();
        material.color = new RGBColor(
            Math.random() * 255,
            Math.random() * 255,
            Math.random() * 255
        );
        material.name = `${type}_material_${this.primitiveObjects.length}`;

        // Add to model
        const meshIndex = this.model.AddMesh(mesh);
        const materialIndex = this.model.AddMaterial(material);

        // Set mesh material
        for (let i = 0; i < mesh.TriangleCount(); i++) {
            mesh.GetTriangle(i).SetMaterial(materialIndex);
        }

        // Store primitive object info
        const primitiveObj = {
            type: type,
            meshIndex: meshIndex,
            materialIndex: materialIndex,
            mesh: mesh,
            material: material,
            transform: {
                position: new Coord3D(0, 0, 0),
                rotation: new Coord3D(0, 0, 0),
                scale: new Coord3D(1, 1, 1)
            },
            originalColor: new RGBColor(material.color.r, material.color.g, material.color.b)
        };

        this.primitiveObjects.push(primitiveObj);

        // Update viewer
        this.viewer.SetModel(this.model);

        // Auto-select new object
        this.SelectObject(primitiveObj);

        console.log(`Created ${type} primitive`);
    }

    GeneratePrimitiveMesh(type)
    {
        const mesh = new Mesh();

        switch(type) {
            case 'cube':
                return this.CreateCube(mesh);
            case 'sphere':
                return this.CreateSphere(mesh);
            case 'cylinder':
                return this.CreateCylinder(mesh);
            case 'cone':
                return this.CreateCone(mesh);
            case 'torus':
                return this.CreateTorus(mesh);
            case 'plane':
                return this.CreatePlane(mesh);
            case 'icosahedron':
                return this.CreateIcosahedron(mesh);
            case 'octahedron':
                return this.CreateOctahedron(mesh);
            default:
                return null;
        }
    }

    CreateCube(mesh)
    {
        const size = 1;
        const vertices = [
            [-size, -size, -size], [size, -size, -size], [size, size, -size], [-size, size, -size],
            [-size, -size, size], [size, -size, size], [size, size, size], [-size, size, size]
        ];

        vertices.forEach(v => {
            mesh.AddVertex(new Coord3D(v[0], v[1], v[2]));
        });

            const faces = [
                [0, 1, 2], [0, 2, 3], [4, 7, 6], [4, 6, 5], [0, 4, 5], [0, 5, 1],
                [2, 6, 7], [2, 7, 3], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]
            ];

        faces.forEach(f => {
            mesh.AddTriangle(f[0], f[1], f[2]);
        });

        return mesh;
    }

    CreateSphere(mesh, radius = 1, segments = 16)
    {
        for (let i = 0; i <= segments; i++) {
            const theta = i * Math.PI / segments;
            for (let j = 0; j <= segments; j++) {
                const phi = j * 2 * Math.PI / segments;

                const x = radius * Math.sin(theta) * Math.cos(phi);
                const y = radius * Math.cos(theta);
                const z = radius * Math.sin(theta) * Math.sin(phi);

                mesh.AddVertex(new Coord3D(x, y, z));
            }
        }

        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < segments; j++) {
                const first = i * (segments + 1) + j;
                const second = first + segments + 1;

                mesh.AddTriangle(first, second, first + 1);
                mesh.AddTriangle(second, second + 1, first + 1);
            }
        }

        return mesh;
    }

    CreateCylinder(mesh, radius = 1, height = 2, segments = 16)
    {
        // Top and bottom centers
        mesh.AddVertex(new Coord3D(0, height/2, 0));  // Top center
        mesh.AddVertex(new Coord3D(0, -height/2, 0)); // Bottom center

        // Top and bottom vertices
        for (let i = 0; i < segments; i++) {
            const angle = i * 2 * Math.PI / segments;
            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);

            mesh.AddVertex(new Coord3D(x, height/2, z));   // Top
            mesh.AddVertex(new Coord3D(x, -height/2, z));  // Bottom
        }

        // Top and bottom faces
        for (let i = 0; i < segments; i++) {
            const next = (i + 1) % segments;

            // Top face
            mesh.AddTriangle(0, 2 + i * 2, 2 + next * 2);
            // Bottom face
            mesh.AddTriangle(1, 3 + next * 2, 3 + i * 2);
            // Side faces
            mesh.AddTriangle(2 + i * 2, 3 + i * 2, 2 + next * 2);
            mesh.AddTriangle(3 + i * 2, 3 + next * 2, 2 + next * 2);
        }

        return mesh;
    }

    CreateCone(mesh, radius = 1, height = 2, segments = 16)
    {
        // Apex and base center
        mesh.AddVertex(new Coord3D(0, height, 0));  // Apex
        mesh.AddVertex(new Coord3D(0, 0, 0));       // Base center

        // Base vertices
        for (let i = 0; i < segments; i++) {
            const angle = i * 2 * Math.PI / segments;
            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);
            mesh.AddVertex(new Coord3D(x, 0, z));
        }

        // Base and side faces
        for (let i = 0; i < segments; i++) {
            const next = (i + 1) % segments;

            // Base face
            mesh.AddTriangle(1, 2 + next, 2 + i);
            // Side face
            mesh.AddTriangle(0, 2 + i, 2 + next);
        }

        return mesh;
    }

    CreatePlane(mesh, size = 2)
    {
        const half = size / 2;
        mesh.AddVertex(new Coord3D(-half, 0, -half));
        mesh.AddVertex(new Coord3D(half, 0, -half));
        mesh.AddVertex(new Coord3D(half, 0, half));
        mesh.AddVertex(new Coord3D(-half, 0, half));

        mesh.AddTriangle(0, 1, 2);
        mesh.AddTriangle(0, 2, 3);

        return mesh;
    }

    CreateTorus(mesh, majorRadius = 1, minorRadius = 0.3, majorSegments = 16, minorSegments = 8)
    {
        for (let i = 0; i < majorSegments; i++) {
            const u = i * 2 * Math.PI / majorSegments;
            for (let j = 0; j < minorSegments; j++) {
                const v = j * 2 * Math.PI / minorSegments;

                const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
                const y = minorRadius * Math.sin(v);
                const z = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);

                mesh.AddVertex(new Coord3D(x, y, z));
            }
        }

        for (let i = 0; i < majorSegments; i++) {
            for (let j = 0; j < minorSegments; j++) {
                const next_i = (i + 1) % majorSegments;
                const next_j = (j + 1) % minorSegments;

                const v1 = i * minorSegments + j;
                const v2 = next_i * minorSegments + j;
                const v3 = next_i * minorSegments + next_j;
                const v4 = i * minorSegments + next_j;

                mesh.AddTriangle(v1, v2, v3);
                mesh.AddTriangle(v1, v3, v4);
            }
        }

        return mesh;
    }

    CreateIcosahedron(mesh)
    {
        const t = (1 + Math.sqrt(5)) / 2; // Golden ratio
        const vertices = [
            [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
            [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
            [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
        ];

        vertices.forEach(v => {
            mesh.AddVertex(new Coord3D(v[0], v[1], v[2]));
        });

        const faces = [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
        ];

        faces.forEach(f => {
            mesh.AddTriangle(f[0], f[1], f[2]);
        });

        return mesh;
    }

    CreateOctahedron(mesh)
    {
        const vertices = [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0],
            [0, -1, 0], [0, 0, 1], [0, 0, -1]
        ];

        vertices.forEach(v => {
            mesh.AddVertex(new Coord3D(v[0], v[1], v[2]));
        });

        const faces = [
            [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
            [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
        ];

        faces.forEach(f => {
            mesh.AddTriangle(f[0], f[1], f[2]);
        });

        return mesh;
    }

    SelectObject(primitiveObj)
    {
        this.DeselectObject();
        this.selectedObject = primitiveObj;

        // Change color to indicate selection
        primitiveObj.material.color = new RGBColor(76, 175, 80); // Green selection color
        this.viewer.SetModel(this.model);

        this.ShowTransformInfo();
        console.log(`Selected ${primitiveObj.type} primitive`);
    }

    DeselectObject()
    {
        if (this.selectedObject) {
            // Restore original color
            this.selectedObject.material.color = new RGBColor(
                this.selectedObject.originalColor.r,
                this.selectedObject.originalColor.g,
                this.selectedObject.originalColor.b
            );
            this.viewer.SetModel(this.model);
            this.selectedObject = null;
            this.HideTransformInfo();
        }
    }

    TransformObject(primitiveObj, transformType, value)
    {
        if (!primitiveObj || !primitiveObj.mesh) return;

        const mesh = primitiveObj.mesh;

        switch(transformType) {
            case 'moveX':
            case 'moveY':
            case 'moveZ':
                this.MoveObject(mesh, transformType, value);
                break;
            case 'scale':
                this.ScaleObject(mesh, value);
                break;
            case 'rotateY':
                this.RotateObject(mesh, value);
                break;
        }

        this.viewer.SetModel(this.model);
    }

    MoveObject(mesh, axis, value)
    {
        for (let i = 0; i < mesh.VertexCount(); i++) {
            const vertex = mesh.GetVertex(i);
            switch(axis) {
                case 'moveX': vertex.x += value; break;
                case 'moveY': vertex.y += value; break;
                case 'moveZ': vertex.z += value; break;
            }
        }
    }

    ScaleObject(mesh, scale)
    {
        for (let i = 0; i < mesh.VertexCount(); i++) {
            const vertex = mesh.GetVertex(i);
            vertex.x *= scale;
            vertex.y *= scale;
            vertex.z *= scale;
        }
    }

    RotateObject(mesh, angle)
    {
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        for (let i = 0; i < mesh.VertexCount(); i++) {
            const vertex = mesh.GetVertex(i);
            const x = vertex.x;
            const z = vertex.z;
            vertex.x = x * cos - z * sin;
            vertex.z = x * sin + z * cos;
        }
    }

    ChangeObjectColor(primitiveObj)
    {
        if (!primitiveObj) return;

        const newColor = new RGBColor(
            Math.random() * 255,
            Math.random() * 255,
            Math.random() * 255
        );

        primitiveObj.originalColor = new RGBColor(newColor.r, newColor.g, newColor.b);
        primitiveObj.material.color = newColor;
        this.viewer.SetModel(this.model);
    }

    SetActiveIcon(icon)
    {
        document.querySelectorAll('.primitive_icon').forEach(i => {
            i.classList.remove('active');
        });
        icon.classList.add('active');

        setTimeout(() => {
            icon.classList.remove('active');
        }, 1000);
    }

    ShowTransformInfo()
    {
        if (this.transformInfo) {
            this.transformInfo.classList.add('show');
        }
    }

    HideTransformInfo()
    {
        if (this.transformInfo) {
            this.transformInfo.classList.remove('show');
        }
    }
}
