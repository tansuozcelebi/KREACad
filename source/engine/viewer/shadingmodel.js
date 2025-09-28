import { SubCoord3D } from '../geometry/coord3d.js';
import { ProjectionMode } from '../viewer/camera.js';
import { ShadingType } from '../threejs/threeutils.js';

import * as THREE from 'three';

/**
 * Environment settings object.
 */
export class EnvironmentSettings
{
    /**
     * @param {string[]} textureNames Urls of the environment map images in this order:
     * posx, negx, posy, negy, posz, negz.
     * @param {boolean} backgroundIsEnvMap Use the environment map as background.
     */
    constructor (textureNames, backgroundIsEnvMap)
    {
        this.textureNames = textureNames;
        this.backgroundIsEnvMap = backgroundIsEnvMap;
    }

    /**
     * Creates a clone of the object.
     * @returns {EnvironmentSettings}
     */
    Clone ()
    {
        let textureNames = null;
        if (this.textureNames !== null) {
            textureNames = [];
            for (let textureName of this.textureNames) {
                textureNames.push (textureName);
            }
        }
        return new EnvironmentSettings (textureNames, this.backgroundIsEnvMap);
    }
}

export class ShadingModel
{
    constructor (scene)
    {
        this.scene = scene;

        this.type = ShadingType.Phong;
        this.projectionMode = ProjectionMode.Perspective;
        this.ambientLight = new THREE.AmbientLight (0x888888, 1.0 * Math.PI);
        this.directionalLight = new THREE.DirectionalLight (0x888888, 1.0 * Math.PI);
        this.environmentSettings = new EnvironmentSettings (null, false);
        this.environment = null;

        this.scene.add (this.ambientLight);
        this.scene.add (this.directionalLight);

        // Camera spotlight feature
        this.cameraSpotEnabled = false;
        this.cameraSpotLight = null;
    }

    EnableCameraSpotLight (enable)
    {
        if (enable && !this.cameraSpotLight) {
            this.cameraSpotLight = new THREE.SpotLight(0xffffff, 1.2, 0, Math.PI / 8, 0.25, 1.0);
            this.cameraSpotLight.position.set(0, 0, 0);
            this.cameraSpotLight.target.position.set(0, 0, -1);
            this.scene.add(this.cameraSpotLight);
            this.scene.add(this.cameraSpotLight.target);
        } else if (!enable && this.cameraSpotLight) {
            this.scene.remove(this.cameraSpotLight.target);
            this.scene.remove(this.cameraSpotLight);
            this.cameraSpotLight.dispose && this.cameraSpotLight.dispose();
            this.cameraSpotLight = null;
        }
        this.cameraSpotEnabled = enable;
    }

    ToggleCameraSpotLight ()
    {
        this.EnableCameraSpotLight(!this.cameraSpotEnabled);
    }

    SetShadingType (type)
    {
        this.type = type;
        this.UpdateShading ();
    }

    SetProjectionMode (projectionMode)
    {
        this.projectionMode = projectionMode;
        this.UpdateShading ();
    }

    UpdateShading ()
    {
        if (this.type === ShadingType.Phong) {
            this.ambientLight.color.set (0x888888);
            this.directionalLight.color.set (0x888888);
            this.scene.environment = null;
        } else if (this.type === ShadingType.Physical) {
            this.ambientLight.color.set (0x000000);
            this.directionalLight.color.set (0x555555);
            this.scene.environment = this.environment;
        }
        if (this.environmentSettings.backgroundIsEnvMap && this.projectionMode === ProjectionMode.Perspective) {
            this.scene.background = this.environment;
        } else {
            this.scene.background = null;
        }
    }

    SetEnvironmentMapSettings (environmentSettings, onLoaded)
    {
        let loader = new THREE.CubeTextureLoader ();
        this.environment = loader.load (environmentSettings.textureNames, (texture) => {
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            onLoaded ();
        });
        this.environmentSettings = environmentSettings;
    }

    UpdateByCamera (camera)
    {
        const lightDir = SubCoord3D (camera.eye, camera.center);
        this.directionalLight.position.set (lightDir.x, lightDir.y, lightDir.z);
        if (this.cameraSpotEnabled && this.cameraSpotLight) {
            // Place spotlight at camera eye, aim toward center
            this.cameraSpotLight.position.set(camera.eye.x, camera.eye.y, camera.eye.z);
            this.cameraSpotLight.target.position.set(camera.center.x, camera.center.y, camera.center.z);
        }
    }
}
