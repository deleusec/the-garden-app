import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/Addons.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function GardenView() {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(80, 80, 80);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        mount.appendChild(renderer.domElement);

        // OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.enableZoom = true;
        controls.target.set(0, 0, 0);

        // HDR Background (Sky)
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load("/src/assets/textures/sky.hdr", (hdrTexture) => {
            hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = hdrTexture;
            scene.environment = hdrTexture;
        });

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.8, 50);
        pointLight.position.set(5, 10, 5);
        scene.add(pointLight);

        // Load GLTF Model
        const gltfLoader = new GLTFLoader();
        let skylandBoundingBox : THREE.Box3 | null = null;
        gltfLoader.load("/src/assets/models/skyland.glb", (gltf) => {
            const model = gltf.scene;

            // Improve materials
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                    if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                        const material = mesh.material as THREE.MeshStandardMaterial;
                        material.envMapIntensity = 1;
                        material.roughness = 0.5;
                    }
                }
            });

            model.position.set(10, -100, 0);
            model.scale.set(1, 1, 1);

            scene.add(model);

            // Create bounding box for collision detection
            const box = new THREE.Box3().setFromObject(model);
            skylandBoundingBox = box;
        });

        // Helpers (optional, remove in production)
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        // Resize handler
        const handleResize = () => {
            if (mount) {
                camera.aspect = mount.clientWidth / mount.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(mount.clientWidth, mount.clientHeight);
            }
        };

        window.addEventListener("resize", handleResize);

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);

            // Example collision detection logic
            if (skylandBoundingBox) {
                const objectBoundingBox = new THREE.Box3().setFromCenterAndSize(
                    new THREE.Vector3(0, 0, 0), // Replace with your object's position
                    new THREE.Vector3(1, 1, 1) // Replace with your object's size
                );

                if (skylandBoundingBox.intersectsBox(objectBoundingBox)) {
                    console.log("Collision detected with Skyland!");
                }
            }

            controls.update();
            renderer.render(scene, camera);
        };

        animate();

        // Cleanup
        return () => {
            mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, []);

    return <div ref={mountRef} className="w-full h-screen" />;
}