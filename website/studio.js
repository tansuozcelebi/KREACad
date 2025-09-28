import { Viewer } from '../source/engine/viewer/viewer.js';
import { NavigationMode, ProjectionMode } from '../source/engine/viewer/camera.js';
import { Coord3D } from '../source/engine/geometry/coord3d.js';
import { Model } from '../source/engine/model/model.js';
import { Mesh } from '../source/engine/model/mesh.js';
import { RGBColor } from '../source/engine/model/color.js';
import { PhysicalMaterial } from '../source/engine/model/material.js';
import { PrimitivesManager } from '../source/website/primitivesmanager.js';

// Simple helper to create a checker grid texture via canvas
function createGrid (canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;
    const size = 48;
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h / size + 2; y++) {
        for (let x = 0; x < w / size + 2; x++) {
            ctx.fillStyle = ((x + y) % 2 === 0) ? '#141a20' : '#182029';
            ctx.fillRect(x * size, y * size, size, size);
        }
    }
}

class PrimitiveStudio {
    constructor () {
        this.canvas = document.getElementById('viewer_canvas');
        this.gridCanvas = document.getElementById('grid_canvas');
        createGrid(this.gridCanvas);

        this.viewer = new Viewer();
        this.viewer.Init(this.canvas);
        this.viewer.SetBackgroundColor(new RGBColor(18, 20, 26));
        this.viewer.SetNavigationMode(NavigationMode.Orbit);
        this.viewer.camera.SetProjection(ProjectionMode.Perspective);

        this.model = new Model();
        this.primitivesManager = new PrimitivesManager(this.viewer, this.model);

        // Enhance selection: keep original color, overlay ghost (simple re-color approach for now)
        const originalSelect = this.primitivesManager.SelectObject.bind(this.primitivesManager);
        this.primitivesManager.SelectObject = (obj) => {
            originalSelect(obj);
            // Slight brighten
            const c = obj.material.color;
            obj.material.color = new RGBColor(Math.min(c.r + 30, 255), Math.min(c.g + 30, 255), Math.min(c.b + 30, 255));
            this.viewer.SetModel(this.model);
        };
        const originalDeselect = this.primitivesManager.DeselectObject.bind(this.primitivesManager);
        this.primitivesManager.DeselectObject = () => {
            originalDeselect();
        };

        this.primitivesManager.CreatePhysicalMaterial = () => {
            const mat = new PhysicalMaterial();
            mat.color = new RGBColor(Math.random() * 255, Math.random() * 255, Math.random() * 255);
            mat.metalness = parseFloat(document.getElementById('metalness_slider').value);
            mat.roughness = parseFloat(document.getElementById('roughness_slider').value);
            mat.opacity = parseFloat(document.getElementById('opacity_slider').value);
            return mat;
        };

    this.initLights();
    this.initGround();
    this.initUI();

    // Check URL parameters to determine if primitives bar should be shown
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    // After ground creation, fit camera if we have any mesh
    this.fitScene();
        // No longer auto-populate primitive_bar; handled by static HTML in toolbar

        // Only add default cube and show primitives if in 'new' mode
        if (mode === 'new') {
            // Show the primitives bar
            const primitivesBar = document.getElementById('studio_primitives_bar');
            if (primitivesBar) {
                primitivesBar.style.display = 'flex';
            }

            // Add a default cube so the scene isn't empty/dark
            if (this.model.MeshCount() === 0) {
                this.primitivesManager.GenerateMaterial = () => this.primitivesManager.CreatePhysicalMaterial();
                this.primitivesManager.CreatePrimitive('cube');
                this.viewer.SetModel(this.model);
                this.focusOnModel();
            }
        }

        this.initDebugOverlay();
        this.bindResize();
    }

    initLights () {
        // Since engine doesn't yet support dynamic light sources here, emulate brightness
        // by slightly brighter background and relying on material roughness/metalness sliders.
        this.viewer.SetBackgroundColor(new RGBColor(28, 30, 36));
    }

    initGround () {
        const mesh = new Mesh();
        const size = 40;
        mesh.AddVertex(new Coord3D(-size, -2, -size));
        mesh.AddVertex(new Coord3D(size, -2, -size));
        mesh.AddVertex(new Coord3D(size, -2, size));
        mesh.AddVertex(new Coord3D(-size, -2, size));
        mesh.AddTriangle(0, 1, 2);
        mesh.AddTriangle(0, 2, 3);
        const mat = new PhysicalMaterial();
        // Slight gradient imitation by random subtle variation later if needed
        mat.color = new RGBColor(110, 115, 125); // a bit lighter for visibility
        mat.metalness = 0.0;
        mat.roughness = 1.0;
        const meshIndex = this.model.AddMesh(mesh);
        const matIndex = this.model.AddMaterial(mat);
        for (let i = 0; i < mesh.TriangleCount(); i++) {
            mesh.GetTriangle(i).SetMaterial(matIndex);
        }
        this.viewer.SetModel(this.model);
    }

    initUI () {
        // No longer populate primitive_bar in param_panel; handled by static HTML in toolbar

        document.getElementById('metalness_slider').addEventListener('input', (e) => {
            document.getElementById('metalness_val').textContent = parseFloat(e.target.value).toFixed(2);
            this.updateSelectedMaterial();
        });
        document.getElementById('roughness_slider').addEventListener('input', (e) => {
            document.getElementById('roughness_val').textContent = parseFloat(e.target.value).toFixed(2);
            this.updateSelectedMaterial();
        });
        document.getElementById('opacity_slider').addEventListener('input', (e) => {
            document.getElementById('opacity_val').textContent = parseFloat(e.target.value).toFixed(2);
            this.updateSelectedMaterial();
        });

        const genBtn = document.getElementById('generate_trefoil');
        if (genBtn) {
            genBtn.addEventListener('click', () => this.generateTrefoilFromUI());
        }

        document.getElementById('reset_cam_btn').addEventListener('click', () => {
            this.viewer.camera.OrbitToDefault();
        });
        document.getElementById('clear_btn').addEventListener('click', () => {
            this.model = new Model();
            this.primitivesManager.model = this.model;
            this.viewer.SetModel(this.model);
        });
        document.getElementById('back_btn').addEventListener('click', () => {
            // Prefer history navigation to preserve previous page state/header.
            const ref = document.referrer;
            if ((ref && ref.indexOf('index.html') !== -1) || window.history.length > 1) {
                try {
                    window.history.back();
                    return;
                } catch (e) { /* fall through */ }
            }
            // Fallback if no history (opened directly) -> go to index
            window.location.href = './index.html';
        });

        // Inline primitives bar wiring (toolbar)
        const toolbarButtons = document.querySelectorAll('#studio_primitives_bar .prim_icon_btn');
        toolbarButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-prim');
                this.createPrimitive(type, btn);
                toolbarButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        const addTrefoilBtn = document.getElementById('add_trefoil_btn');
        if (addTrefoilBtn) {
            addTrefoilBtn.addEventListener('click', () => {
                this.generateTrefoilFromUI();
            });
        }
    }

    createPrimitive (type, btn) {
        this.primitivesManager.GenerateMaterial = () => this.primitivesManager.CreatePhysicalMaterial();
        this.primitivesManager.CreatePrimitive(type);
    document.querySelectorAll('#studio_primitives_bar .prim_icon_btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
        this.focusOnModel();
    }

    updateSelectedMaterial () {
        const sel = this.primitivesManager.selectedObject;
        if (!sel) return;
        const mat = sel.material;
        if (mat) {
            mat.metalness = parseFloat(document.getElementById('metalness_slider').value);
            mat.roughness = parseFloat(document.getElementById('roughness_slider').value);
            mat.opacity = parseFloat(document.getElementById('opacity_slider').value);
            this.viewer.SetModel(this.model);
        }
    }

    generateTrefoilFromUI () {
        const a = parseFloat(document.getElementById('trefoil_a').value);
        const b = parseFloat(document.getElementById('trefoil_b').value);
        const q = parseInt(document.getElementById('trefoil_q').value, 10);
        const tube = parseFloat(document.getElementById('trefoil_tube').value);
        const segU = parseInt(document.getElementById('trefoil_seg_u').value, 10);
        const segV = parseInt(document.getElementById('trefoil_seg_v').value, 10);
        this.createTrefoil(a, b, q, tube, segU, segV);
    }

    // Parametric center curve
    trefoilPoint (a, b, q, u) {
        return new Coord3D(
            (a + b * Math.cos(q * u)) * Math.cos(u),
            (a + b * Math.cos(q * u)) * Math.sin(u),
            b * Math.sin(q * u)
        );
    }

    createTrefoil (a, b, q, tube, segU, segV) {
        const mesh = new Mesh();
        const points = [];
        for (let i = 0; i <= segU; i++) {
            const u = (i / segU) * Math.PI * 2.0;
            points.push(this.trefoilPoint(a, b, q, u));
        }

        // Approximate tangent and build frame (simple method)
        const frames = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const pNext = points[(i + 1) % points.length];
            const tx = pNext.x - p.x;
            const ty = pNext.y - p.y;
            const tz = pNext.z - p.z;
            const len = Math.max(Math.hypot(tx, ty, tz), 1e-6);
            const tnx = tx / len, tny = ty / len, tnz = tz / len;
            // Choose a helper up vector
            const ux = 0, uy = 0, uz = 1;
            // Normal = tangent x up
            let nx = tny * uz - tnz * uy;
            let ny = tnz * ux - tnx * uz;
            let nz = tnx * uy - tny * ux;
            let nlen = Math.max(Math.hypot(nx, ny, nz), 1e-6);
            nx /= nlen; ny /= nlen; nz /= nlen;
            // Binormal = tangent x normal
            let bx = tny * nz - tnz * ny;
            let by = tnz * nx - tnx * nz;
            let bz = tnx * ny - tny * nx;
            let blen = Math.max(Math.hypot(bx, by, bz), 1e-6);
            bx /= blen; by /= blen; bz /= blen;
            frames.push({ p, t: { x: tnx, y: tny, z: tnz }, n: { x: nx, y: ny, z: nz }, b: { x: bx, y: by, z: bz } });
        }

        // Create tube vertices
        const ringVerts = [];
        for (let i = 0; i < frames.length; i++) {
            const f = frames[i];
            for (let j = 0; j <= segV; j++) {
                const v = (j / segV) * Math.PI * 2.0;
                const cx = Math.cos(v) * tube;
                const cy = Math.sin(v) * tube;
                const vx = f.p.x + f.n.x * cx + f.b.x * cy;
                const vy = f.p.y + f.n.y * cx + f.b.y * cy;
                const vz = f.p.z + f.n.z * cx + f.b.z * cy;
                mesh.AddVertex(new Coord3D(vx, vy, vz));
                ringVerts.push({ i, j });
            }
        }

        const ringSize = segV + 1;
        for (let i = 0; i < frames.length - 1; i++) {
            for (let j = 0; j < segV; j++) {
                const a0 = i * ringSize + j;
                const a1 = (i + 1) * ringSize + j;
                const a2 = (i + 1) * ringSize + (j + 1);
                const a3 = i * ringSize + (j + 1);
                mesh.AddTriangle(a0, a1, a2);
                mesh.AddTriangle(a0, a2, a3);
            }
        }

        const mat = new PhysicalMaterial();
        mat.color = new RGBColor(200, 160, 80);
        mat.metalness = parseFloat(document.getElementById('metalness_slider').value);
        mat.roughness = parseFloat(document.getElementById('roughness_slider').value);
        mat.opacity = parseFloat(document.getElementById('opacity_slider').value);

        const meshIndex = this.model.AddMesh(mesh);
        const matIndex = this.model.AddMaterial(mat);
        for (let i = 0; i < mesh.TriangleCount(); i++) {
            mesh.GetTriangle(i).SetMaterial(matIndex);
        }

        this.viewer.SetModel(this.model);
        this.focusOnModel();
    }

    bindResize () {
        window.addEventListener('resize', () => {
            createGrid(this.gridCanvas);
            this.viewer.Resize(window.innerWidth, window.innerHeight);
        });
        this.viewer.Resize(window.innerWidth, window.innerHeight);
    }

    // Fallback in case original initUI didn't run or DOM race
    // fallbackPopulateBar removed; no longer needed

    fitScene () {
        // Try to fit camera to model if there is at least one mesh
        if (this.model.MeshCount() > 0) {
            const sphere = this.viewer.GetBoundingSphere(() => true);
            if (sphere && sphere.radius > 0) {
                this.viewer.FitSphereToWindow(sphere, false);
                this.viewer.Render();
            }
        }
    }

    // More immediate camera focus after any object addition
    focusOnModel () {
        const sphere = this.viewer.GetBoundingSphere(() => true);
        if (sphere && sphere.radius > 0) {
            this.viewer.FitSphereToWindow(sphere, false);
        }
    }

    initDebugOverlay () {
        const overlay = document.createElement('div');
        overlay.id = 'studio_debug_overlay';
        overlay.style.position = 'absolute';
        overlay.style.bottom = '8px';
        overlay.style.right = '10px';
        overlay.style.background = 'rgba(0,0,0,0.45)';
        overlay.style.font = '11px monospace';
        overlay.style.color = '#8fd1ff';
        overlay.style.padding = '4px 6px';
        overlay.style.border = '1px solid #2e3945';
        overlay.style.borderRadius = '4px';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '20';
        document.getElementById('studio_root').appendChild(overlay);
        const update = () => {
            const meshCount = this.model.MeshCount();
            overlay.textContent = `Meshes:${meshCount}`;
        };
        setInterval(update, 1000);
        update();
        // Toggle with F2
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                overlay.style.display = (overlay.style.display === 'none') ? 'block' : 'none';
            }
        });
    }
}

window.addEventListener('load', () => {
    const studio = new PrimitiveStudio();
    window.__kreacadStudio = studio; // expose for debugging
});
