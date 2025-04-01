import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer, OBJLoader, RenderPass, UnrealBloomPass } from "three/examples/jsm/Addons.js";
import gsap from "gsap";
import Loading from "../components/ui/loading";

export default function HomeView() {
    const mountRef = useRef<HTMLDivElement>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const [showUI, setShowUI] = useState(false);
    const [loading, setLoading] = useState(true);
    const isTransitioningRef = useRef(false);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // Scene and Camera
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(0, 3, 10);
        camera.layers.enable(1);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.shadowMap.enabled = true;
        mount.appendChild(renderer.domElement);

        renderer.setPixelRatio(window.devicePixelRatio);

        // Post-processing
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(mount.clientWidth, mount.clientHeight),
            1.5,
            0.4,
            0.3,
        );
        composer.addPass(bloomPass);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enableRotate = false;
        controls.enableZoom = false;
        controls.enablePan = false;
        controlsRef.current = controls;

        // Lights
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

        // Textures
        const textureLoader = new THREE.TextureLoader();
        const baseColor = textureLoader.load("/models/water_lily_flower/flower_Mat_baseColor.png");
        const normalMap = textureLoader.load("/models/water_lily_flower/flower_Mat_normal.png");
        const metallicMap = textureLoader.load("/models/water_lily_flower/flower_Mat_metallic.png");
        const roughnessMap = textureLoader.load("/models/water_lily_flower/flower_Mat_roughness.png");

        // Load OBJ Model
        const objLoader = new OBJLoader();
        let flower: THREE.Object3D | null = null;

        objLoader.load("/models/water_lily_flower/water_lily_white_flower.obj", (object) => {
            object.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.layers.set(1);
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    mesh.material = new THREE.MeshStandardMaterial({
                        map: baseColor,
                        normalMap,
                        metalnessMap: metallicMap,
                        roughnessMap,
                        metalness: 0.5,
                        roughness: 0.5,
                        side: THREE.DoubleSide,
                        flatShading: false,
                        emissive: new THREE.Color(0xffc0cb),
                        emissiveIntensity: 0.1,
                        emissiveMap: null,
                        alphaMap: null,
                        transparent: true,
                        opacity: 1.0,
                        depthWrite: true,
                    });
                }
            });

            object.scale.set(0.5, 0.5, 0.5);
            object.position.set(0, -1, 0);
            scene.add(object);
            flower = object;

            setShowUI(true);
            setTimeout(() => {
                setLoading(false);
            }, 1000);
        });

        // Particles
        const createParticles = () => {
            const particleCount = 600;
            const particleGeometry = new THREE.BufferGeometry();
            const textureLoader = new THREE.TextureLoader();
            const particleTexture = textureLoader.load("/textures/particles/1.png");
            const positions = new Float32Array(particleCount * 3);
            const velocities = new Float32Array(particleCount);

            for (let i = 0; i < particleCount; i++) {
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                const radius = 3 + Math.random() * 2;

                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = Math.random() * 2 - 1;
                const z = radius * Math.sin(phi) * Math.sin(theta);

                positions.set([x, y, z], i * 3);
                velocities[i] = 0.005 + Math.random() * 0.01;
            }

            particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            particleGeometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 1));

            const particleMaterial = new THREE.PointsMaterial({
                map: particleTexture,
                color: 0xffc0cb,
                size: 0.1,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            const particles = new THREE.Points(particleGeometry, particleMaterial);
            scene.add(particles);

            return particles;
        };

        const particles = createParticles();

        // Linear Particles
        const createLinearParticles = () => {
            const particleCount = 200;
            const particleGeometry = new THREE.BufferGeometry();
            const textureLoader = new THREE.TextureLoader();
            const particleTexture = textureLoader.load("/textures/particles/12.png");

            const positions = new Float32Array(particleCount * 3);
            const velocities = new Float32Array(particleCount * 3);
            const accelerations = new Float32Array(particleCount);
            const colors = new Float32Array(particleCount * 3);
            const startDelays = new Float32Array(particleCount);
            const color = new THREE.Color();

            for (let i = 0; i < particleCount; i++) {
                const radius = 4 + Math.random() * 2;
                const angle = Math.random() * 2 * Math.PI;

                const x = radius * Math.cos(angle);
                const y = -1 + Math.random() * 0.5;
                const z = radius * Math.sin(angle);

                positions.set([x, y, z], i * 3);

                const vx = (Math.random() - 0.5) * 0.001;
                const vy = 0.004 + Math.random() * 0.005;
                const vz = (Math.random() - 0.5) * 0.001;

                velocities.set([vx, vy, vz], i * 3);

                accelerations[i] = 0.0001 + Math.random() * 0.0003;
                startDelays[i] = Math.random() * 3;

                color.setHSL(0.95 + Math.random() * 0.05, 1, 0.9);
                color.toArray(colors, i * 3);
            }

            particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            particleGeometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
            particleGeometry.setAttribute("acceleration", new THREE.BufferAttribute(accelerations, 1));
            particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            particleGeometry.setAttribute("startDelay", new THREE.BufferAttribute(startDelays, 1)); // 👈

            const particleMaterial = new THREE.PointsMaterial({
                map: particleTexture,
                vertexColors: true,
                size: 0.1,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            const particles = new THREE.Points(particleGeometry, particleMaterial);
            scene.add(particles);

            return particles;
        };

        const linearParticles = createLinearParticles();

        // Animation loop
        const animate = () => {
            if (flower && !isTransitioningRef.current) {
                const time = Date.now() * 0.0005;
                const radius = 5;
                camera.position.set(Math.cos(time) * radius, 2, Math.sin(time) * radius);
                camera.lookAt(flower.position);
            }

            // Animate particles
            const positions = particles.geometry.attributes.position.array;
            const velocities = particles.geometry.attributes.velocity.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += velocities[i / 3];
                if (positions[i + 1] > 5) positions[i + 1] = -1;
            }
            particles.geometry.attributes.position.needsUpdate = true;

            const linearPositions = linearParticles.geometry.attributes.position.array;
            const linearVelocities = linearParticles.geometry.attributes.velocity.array;
            const linearAccelerations = linearParticles.geometry.attributes.acceleration.array;

            for (let i = 0; i < linearPositions.length; i += 3) {
                const index = i / 3;

                linearVelocities[i + 1] += linearAccelerations[index];

                linearPositions[i] += linearVelocities[i];
                linearPositions[i + 1] += linearVelocities[i + 1];
                linearPositions[i + 2] += linearVelocities[i + 2];

                if (linearPositions[i + 1] > 6) {
                    const radius = 2 + Math.random() * 1;
                    const angle = Math.random() * 2 * Math.PI;

                    linearPositions[i] = radius * Math.cos(angle);
                    linearPositions[i + 1] = -1 + Math.random() * 0.5;
                    linearPositions[i + 2] = radius * Math.sin(angle);

                    linearVelocities[i] = (Math.random() - 0.5) * 0.002;
                    linearVelocities[i + 1] = 0.01 + Math.random() * 0.01;
                    linearVelocities[i + 2] = (Math.random() - 0.5) * 0.002;

                    linearAccelerations[index] = 0.0001 + Math.random() * 0.0003;
                }
            }

            linearParticles.geometry.attributes.position.needsUpdate = true;

            particles.rotation.y += 0.001;
            controls.update();
            composer.render();
            requestAnimationFrame(animate);
        };
        animate();

        // Resize handler
        const handleResize = () => {
            if (mount) {
                camera.aspect = mount.clientWidth / mount.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(mount.clientWidth, mount.clientHeight);
                composer.setSize(mount.clientWidth, mount.clientHeight);
            }
        };
        window.addEventListener("resize", handleResize);
        window.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                isTransitioningRef.current = true;
            } else {
                isTransitioningRef.current = false;
            }
        });

        // Cleanup
        return () => {
            mount.removeChild(renderer.domElement);
            renderer.dispose();
            composer.dispose();
            controls.dispose();
            scene.clear();
        };
    }, []);


    const handleClick = () => {
        if (!cameraRef.current || !controlsRef.current) return;

        isTransitioningRef.current = true;
        controlsRef.current.enabled = false;

        gsap.to(cameraRef.current.position, {
            duration: 2,
            x: 0,
            y: 2,
            z: 1,
            ease: "power2.inOut",
            onUpdate: () => {
                if (!cameraRef.current) return;
                cameraRef.current.lookAt(0, 0, 0);
            },
            onComplete: () => {
                window.location.href = "/garden";
            }
        });
    };

    return (
        <div ref={mountRef} className="relative w-full h-screen overflow-hidden bg-black">
            {loading ? (
                <Loading />
            ) : (
                <>
                    {showUI && (
                        <div className="absolute inset-0 p-20 flex flex-col items-center justify-between text-white z-10 gap-28 drop-shadow-[0_0_1px_rgba(0,0,0,0.5)]">
                            <div className="flex flex-col items-center justify-center gap-4">
                                <h1 className="text-7xl font-beverly">Welcome</h1>
                                <h2 className="text-4xl font-beverly">
                                    <span className="text-primary">to</span> the Garden
                                </h2>
                            </div>
                            <div
                                onClick={handleClick}
                                className="cursor-pointer flex items-center justify-center uppercase gap-2 font-light text-lg text-white py-2 px-4 group scale-100 hover:scale-105 transition-transform duration-150 ease-in-out"
                            >
                                <img src="/floral_ornement_left.svg" alt="Floral Ornament" className="w-8 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" />
                                <div>
                                    Discover
                                </div>
                                <img src="/floral_ornement_right.svg" alt="Floral Ornament" className="w-8 group-hover:translate-x-1 transition-transform duration-150 ease-in-out" />
                            </div>
                        </div>
                    )}
                </>

            )}
        </div>
    );
}
