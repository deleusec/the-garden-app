import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from "gsap";

export default function GardenSceneIntro({ onComplete } : { onComplete: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.z = 140;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const light = new THREE.DirectionalLight(0xffc0cb, 0.5);
    light.position.set(0, 0, 1).normalize();
    scene.add(light);

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

    const texts = [
      "On racontait jadis que les jardins célestes n’étaient qu’une légende oubliée...",
      "Pourtant, quelques voyageurs en ont entrevu les murmures...",
      "Aujourd’hui, c’est à ton tour de franchir les portes du ciel."
    ];

    const baseUniforms = {
      uTime: { value: 0.0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uHover: { value: 0.0 },
    };

    const vertexShader = `
            uniform float uTime;
            uniform vec2 uMouse;
            uniform float uHover;
            uniform float uOpacity;

            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                vUv = uv;
                vPosition = position;

                float dist = distance(vec3(uMouse.x, uMouse.y, 0.0), position);
                float distortionFactor = 0.5 * uHover * smoothstep(24.0, 0.0, dist);

                vec3 newPosition = position;
                newPosition.x += sin(position.y * 8.0 + uTime * 2.0) * distortionFactor;
                newPosition.y += cos(position.x * 8.0 + uTime * 2.0) * distortionFactor;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
            }
        `;

    const fragmentShader = `
            varying vec2 vUv;
            varying vec3 vPosition;
            uniform float uTime;
            uniform float uHover;
            uniform vec2 uMouse;
            uniform float uOpacity;

            void main() {
                float dist = distance(vec2(vPosition.x, vPosition.y), uMouse);
                float glow = smoothstep(24.0, 0.0, dist) * uHover;
                glow = pow(glow, 1.2);
                float flare = 0.1 * sin(dist * 8.0 - uTime * 2.0);

                vec3 baseColor = vec3(1.0);
                vec3 pinkGlow = vec3(1.0, 0.75, 0.796);
                vec3 finalColor = mix(baseColor, pinkGlow + flare, glow);

                gl_FragColor = vec4(finalColor, uOpacity);
            }
        `;

    const fontLoader = new FontLoader();
    let currentTextIndex = 0;
    let currentMesh: THREE.Mesh<TextGeometry, THREE.ShaderMaterial> | null = null;

    fontLoader.load('Tangerine_Regular.json', (font) => {
      const textGeometries = texts.map((content) => {
        const geometry = new TextGeometry(content, {
          font,
          size: 12,
          depth: 0,
          curveSegments: 10,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.01,
          bevelSegments: 8,
          bevelOffset: 0,
        });
        geometry.center();
        return geometry;
      });

      const uniforms: Record<string, THREE.IUniform> = {
        ...baseUniforms,
        uOpacity: { value: 0.0 },
      };

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
      });

      const mesh = new THREE.Mesh(textGeometries[0], material);
      scene.add(mesh);
      currentMesh = mesh;

      const showNextText = () => {
        if (currentTextIndex < texts.length - 1) {
          gsap.to(uniforms.uOpacity, {
            value: 0,
            duration: 1.5,
            ease: "power2.out",
            onComplete: () => {
              currentTextIndex++;
              mesh.geometry = textGeometries[currentTextIndex];
              gsap.to(uniforms.uOpacity, {
                value: 1,
                duration: 1.5,
                ease: "power2.out",
              });
            },
          });
          setTimeout(showNextText, 5000);
        } else {
          gsap.to(camera.position, {
            z: -20,
            duration: 6,
            ease: "power2.inOut",
            onComplete: () => {
              onComplete(); 
            },
          });
        }
      };

      gsap.to(uniforms.uOpacity, { value: 1, duration: 2, ease: "power2.out" });
      setTimeout(showNextText, 5000);
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mount.addEventListener("mousemove", (event) => {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeZ, intersectPoint);

      if (currentMesh) {
        const mat = currentMesh.material as THREE.ShaderMaterial;
        mat.uniforms.uMouse.value.set(intersectPoint.x, intersectPoint.y);
        mat.uniforms.uHover.value = 1.0;
      }
    });

    mount.addEventListener("mouseleave", () => {
      if (currentMesh) {
        const mat = currentMesh.material as THREE.ShaderMaterial;
        mat.uniforms.uHover.value = 0.0;
      }
    });

    function animate() {
      requestAnimationFrame(animate);
      particles.rotation.y += 0.0008;
      if (currentMesh) {
        const mat = currentMesh.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value += 0.03;
      }
      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
    };
  }, [onComplete]);

  return (
    <div ref={mountRef} className="relative w-full h-screen overflow-hidden bg-black" />
  );
}
