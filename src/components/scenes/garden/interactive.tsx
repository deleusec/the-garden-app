import gsap from "gsap";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";

export default function GardenSceneInteractive() {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // ----- SCENE
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#000000");

        // ----- CAMERA
        const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(5, 2, 5);
        camera.lookAt(0, -1, 0);

        // ----- RENDERER
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        mount.appendChild(renderer.domElement);

        // ----- LIGHTS
        const setupLights = () => {
            scene.add(new THREE.AmbientLight(0xffffff, 0.5));

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 12, 7).normalize();
            directionalLight.castShadow = true;
            scene.add(directionalLight);

            const pastelPinkLight = new THREE.DirectionalLight(0xffc0cb, 0.5);
            pastelPinkLight.position.set(-5, 12, -10).normalize();
            pastelPinkLight.castShadow = true;
            scene.add(pastelPinkLight);

            const pastelBlueLightDown = new THREE.DirectionalLight(0xadd8e6, 0.8);
            pastelBlueLightDown.position.set(0, -10, 0).normalize();
            pastelBlueLightDown.castShadow = true;
            scene.add(pastelBlueLightDown);
        };
        setupLights();

        // ----- PARTICLES
        const createParticles = () => {
            const particleCount = 600;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount; i++) {
                const x = (Math.random() - 0.5) * 300;
                const y = (Math.random() - 0.5) * 200;
                const z = (Math.random() - 0.5) * 300;
                positions.set([x, y, z], i * 3);
            }

            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const texture = new THREE.TextureLoader().load("/textures/particles/1.png");

            const material = new THREE.PointsMaterial({
                size: 1,
                map: texture,
                blending: THREE.AdditiveBlending,
                transparent: true,
                opacity: 0.6,
                color: 0xffe0f0,
                depthWrite: false
            });

            const particles = new THREE.Points(geometry, material);
            scene.add(particles);

            return particles;
        };
        const particles = createParticles();

        // ----- PHYSICS WORLD
        const world = new CANNON.World();
        world.gravity.set(0, -9.82, 0);

        // ----- DRAG STATE
        let isDragging = false;
        const dragOffset = new THREE.Vector3();

        // ----- OBJECTS
        let planeBody: CANNON.Body | null = null;
        let sphereMesh: THREE.Mesh | null = null;
        let sphereBody: CANNON.Body | null = null;

        // ----- INTERACTION
        const originalYMap = new WeakMap<THREE.Object3D, number>();
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let currentHovered: THREE.Object3D | null = null;
        const hitboxToText = new Map<THREE.Object3D, THREE.Object3D>();

        // ----- LOAD GLTF
        const gltfLoader = new GLTFLoader();
        gltfLoader.load("/models/garden/garden.glb", (gltf) => {
            const model = gltf.scene;
            const sphereRadius = 0.3;
            const sphereMaterial = new CANNON.Material("sphereMaterial");
            sphereMaterial.restitution = 0.5; // Entre 0 (aucun rebond) et 1 (super rebond)
            
            const groundMaterial = new CANNON.Material("groundMaterial");
            groundMaterial.restitution = 0.5;
            
            const contactMaterial = new CANNON.ContactMaterial(sphereMaterial, groundMaterial, {
                restitution: 0.5,
                friction: 0.3,
            });
            
            world.addContactMaterial(contactMaterial);

            // ----- SPHERE
            sphereBody = new CANNON.Body({
                mass: 1,
                shape: new CANNON.Sphere(sphereRadius),
                material: sphereMaterial,
                position: new CANNON.Vec3(0, 3, 0),
            });
            world.addBody(sphereBody);

            sphereMesh = new THREE.Mesh(
                new THREE.SphereGeometry(sphereRadius, 32, 32),
                new THREE.MeshStandardMaterial({ color: 0xffc0cb })
            );
            sphereMesh.castShadow = true;
            sphereMesh.receiveShadow = true;
            scene.add(sphereMesh);

            // ----- TRAVERSE MODEL
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                    if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                        const material = mesh.material as THREE.MeshStandardMaterial;
                        material.envMapIntensity = 1;
                        material.roughness = 0.4;
                        material.metalness = 0.2;
                    }
                }

                // ----- PLANE COLLISION
                if (child.name.toLowerCase() === "plane" && (child as THREE.Mesh).isMesh) {
                    const plane = child as THREE.Mesh;
                    plane.receiveShadow = true;

                    const box = new THREE.Box3().setFromObject(plane);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const center = new THREE.Vector3();
                    box.getCenter(center);

                    const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, 0.05, size.z / 2));
                    planeBody = new CANNON.Body({
                        mass: 0,
                        shape,
                        position: new CANNON.Vec3(center.x, center.y - 1, center.z),
                        material: groundMaterial,
                    });
                    world.addBody(planeBody);
                }

                // ----- TEXT HOVER HITBOX
                if (child.name.toLowerCase().includes("text")) {
                    child.name = "Text";
                    originalYMap.set(child, child.position.y);

                    const bbox = new THREE.Box3().setFromObject(child);
                    const size = new THREE.Vector3();
                    bbox.getSize(size);

                    const hitboxGeo = new THREE.BoxGeometry(size.x * 1.5, size.y * 2, size.z * 1.5);
                    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false});

                    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
                    const center = new THREE.Vector3();
                    bbox.getCenter(center);
                    hitbox.position.copy(center);
                    hitbox.position.y -= 1;
                    hitbox.position.x += 0.5;
                    hitbox.name = "TextHitbox";
                    scene.add(hitbox);

                    hitboxToText.set(hitbox, child);
                }
            });

            model.position.set(0, -1, 0);
            model.scale.set(1.2, 1.2, 1.2);
            scene.add(model);
        });

        // ----- EVENT LISTENERS
        const handleResize = () => {
            camera.aspect = mount.clientWidth / mount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mount.clientWidth, mount.clientHeight);
        };
        window.addEventListener("resize", handleResize);

        const handleMouseMove = (event: MouseEvent) => {
            const rect = mount.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };
        window.addEventListener("mousemove", handleMouseMove);

        const handleMouseDown = () => {
            if (!sphereMesh || !sphereBody) return;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(sphereMesh);

            if (intersects.length > 0) {
                isDragging = true;
                dragOffset.copy(intersects[0].point).sub(sphereMesh.position);
                sphereBody.type = CANNON.Body.KINEMATIC;
                sphereBody.velocity.setZero();
                sphereBody.angularVelocity.setZero();
            }
        };
        window.addEventListener("mousedown", handleMouseDown);

        const handleMouseUp = () => {
            if (isDragging && sphereBody) {
                isDragging = false;
                sphereBody.type = CANNON.Body.DYNAMIC;
            }
        };
        window.addEventListener("mouseup", handleMouseUp);

        // ----- ANIMATION LOOP
        const animate = () => {
            requestAnimationFrame(animate);

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(Array.from(hitboxToText.keys()), true);
            const hit = intersects.find((i) => i.object.name === "TextHitbox");
            const hovered = hit ? hitboxToText.get(hit.object) : null;

            if (hovered !== currentHovered) {
                if (currentHovered) {
                    const originalY = originalYMap.get(currentHovered) ?? 0;
                    gsap.to(currentHovered.position, { y: originalY, duration: 0.4, ease: "power2.out" });
                }

                if (hovered) {
                    const baseY = originalYMap.get(hovered) ?? hovered.position.y;
                    gsap.to(hovered.position, { y: baseY + 0.2, duration: 0.4, ease: "power2.out" });
                }

                currentHovered = hovered ?? null;
            }

            if (sphereBody && sphereMesh) {
                world.step(1 / 60);
                sphereMesh.position.copy(sphereBody.position);
                sphereMesh.quaternion.copy(sphereBody.quaternion);

                // ----- DRAG CONTROL
                if (isDragging) {
                    raycaster.setFromCamera(mouse, camera);
                    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -sphereBody.position.y);
                    const intersectPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(plane, intersectPoint);

                    intersectPoint.sub(dragOffset);
                    sphereBody.position.set(intersectPoint.x, sphereBody.position.y, intersectPoint.z);
                }

                // ----- FALL RESET
                if (sphereBody.position.y < -20) {
                    sphereBody.position.set(0, 3, 0);
                    sphereBody.velocity.set(0, 0, 0);
                    sphereBody.angularVelocity.set(0, 0, 0);
                    sphereBody.quaternion.set(0, 0, 0, 1);
                }
            }

            particles.rotation.y += 0.0008;
            renderer.render(scene, camera);
        };
        animate();

        // ----- CLEANUP
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("resize", handleResize);
            mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, []);

    return <div ref={mountRef} className="w-full h-screen" />;
}
