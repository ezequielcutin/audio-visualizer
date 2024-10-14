import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import * as Meyda from 'meyda';

interface SceneProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  mode: string;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  uniform float audioLevel;
  uniform float audioBass;
  uniform float audioMid;
  uniform float audioTreble;
  uniform float audioPeak;
  uniform float rotationSpeed;
  uniform int instrumentType; // Added uniform
  uniform int mode;
  uniform vec3 color;
  varying vec2 vUv;

  const float PI = 3.1415926535897932384626433832795;

  vec2 kaleidoscope(vec2 uv) {
    float angle = PI / 3.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x) / angle;
    a = fract(a) * angle;
    return vec2(cos(a), sin(a)) * r;
  }

  mat2 rotate2d(float angle){
    return mat2(cos(angle), -sin(angle),
                sin(angle),  cos(angle));
  }

  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  float sdSquare(vec2 p, float size) {
    vec2 d = abs(p) - size;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  float sdDiamond(vec2 p, float size) {
    p = abs(p);
    return (p.x + p.y) - size;
  }
  
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 fractalKaleidoscope(vec2 uv) {
    uv -= 0.5;
    uv *= 2.0;

    float angle = time * 0.2 + audioBass * 5.0;
    uv = rotate2d(angle) * uv;

    vec2 p = uv;
    float scale = 1.5 + audioMid * 2.0;
    float c = 0.0;
    for (int i = 0; i < 6; i++) {
      p = abs(p) / dot(p, p) - 0.5;
      c += length(p) * exp(-float(i));
      p *= scale;
    }
    float colorFactor = sin(c + time);
    vec3 color = hsv2rgb(vec3(colorFactor * 0.5 + 0.5 + audioTreble, 1.0, 1.0));
    return color * 0.5;
  }

  vec3 defaultMode(vec2 uv) {
    uv -= 0.5;
    uv *= 2.0;

    float angle = time * rotationSpeed;
    uv = rotate2d(angle) * uv;

    float size = 0.3 + 0.05 * sin(time);
    size += 0.1 * audioLevel;

    float shapeSDF;

    // Modify shape based on detected instrument
    if (instrumentType == 1) { // Kick
      shapeSDF = sdCircle(uv, size);
      size += 0.1 * sin(time * 10.0); // Pulsate faster for kick
    } else if (instrumentType == 2) { // Bass
      shapeSDF = sdSquare(uv, size);
    } else if (instrumentType == 3) { // Synth
      shapeSDF = sdDiamond(uv, size);
    } else {
      // Default shape when no instrument is detected
      shapeSDF = mix(sdCircle(uv, size), sdSquare(uv, size), audioLevel);
    }

    float edgeWidth = 0.005;
    float alpha = smoothstep(-edgeWidth, edgeWidth, -shapeSDF);

    float hue = mod(audioBass * 2.0 + time * 0.1, 1.0);
    vec3 shapeColor = hsv2rgb(vec3(hue, 1.0, 1.0));

    vec3 backgroundColor = vec3(0.0);

    vec3 color = mix(backgroundColor, shapeColor, alpha);

    float glow = exp(-abs(shapeSDF) * 5.0);
    color += glow * vec3(1.0) * 0.1;

    return color;
  }


  vec3 bassMode(vec2 uv) {
    float f = sin(uv.x * 20.0 + time * audioBass * 10.0) * cos(uv.y * 20.0 + time * audioBass * 10.0) * 0.5 + 0.5;
    vec3 color = vec3(f * audioBass, f * audioMid * 0.5, f * audioTreble * 0.2);
    if (audioPeak > 0.8) {
      color = 1.0 - color;
    }
    return color;
  }

  vec3 chillMode(vec2 uv) {
    vec2 uv_bg = uv;
    uv_bg = kaleidoscope(uv_bg);
    float r = length(uv_bg);
    float angle = atan(uv_bg.y, uv_bg.x);

    float f = sin(r * 10.0 - time * 2.0) * 0.5 + 0.5;
    f += sin(angle * 6.0 + time * 3.0) * 0.5 + 0.5;
    f *= audioLevel;

    vec3 background = vec3(f);
    background.r += sin(time * 0.5) * 0.5 + 0.5 + audioBass * 0.5;
    background.g += cos(time * 0.7) * 0.5 + 0.5 + audioMid * 0.3;
    background.b += sin(time * 0.9) * 0.5 + 0.5 + audioTreble * 0.2;
    background *= audioLevel;

    vec3 overlay = fractalKaleidoscope(uv);

    vec3 finalColor = background + overlay;

    return finalColor;
  }

  vec3 explosiveMode(vec2 uv) {
    float f = fract(length(uv) - time * audioPeak * 4.0);
    vec3 color = vec3(f * audioBass, f * audioMid * 0.5, f * audioTreble * 0.2);
    if (audioPeak > 0.9) {
      color += vec3(1.0, 0.5, 0.2) * (audioPeak - 0.9) * 10.0;
    }
    return color;
  }

  void main() {
    vec2 uv = vUv;
    vec3 finalColor;
    
    if (mode == 0) {
      finalColor = defaultMode(uv);
    } else if (mode == 1) {
      finalColor = bassMode(uv);
    } else if (mode == 2) {
      finalColor = chillMode(uv);
    } else if (mode == 3) {
      finalColor = explosiveMode(uv);
    }
    
    finalColor *= color;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const Scene: React.FC<SceneProps> = ({ analyser, isPlaying, mode }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const timeRef = useRef<number>(0);
  const [kickDetected, setKickDetected] = useState(false);
  const [bassDetected, setBassDetected] = useState(false);
  const [synthDetected, setSynthDetected] = useState(false);
  const [instrumentType, setInstrumentType] = useState(0); // New state variable

  const smoothedAudioDataRef = useRef({
    kick: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    average: 0,
    peak: 0,
  });

  const audioDataRef = useRef({
    kick: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    average: 0,
    peak: 0,
  });

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer();

    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(2 * aspect, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0.5 },
        audioBass: { value: 0.5 },
        audioMid: { value: 0.5 },
        audioTreble: { value: 0.5 },
        audioPeak: { value: 0.5 },
        rotationSpeed: { value: 0.2 },
        mode: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        instrumentType: { value: 0 }, // Added uniform
      },
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    materialRef.current = material;

    const handleResize = () => {
      const newAspect = window.innerWidth / window.innerHeight;
      if (cameraRef.current) {
        cameraRef.current.left = -newAspect;
        cameraRef.current.right = newAspect;
        cameraRef.current.updateProjectionMatrix();
      }
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    const currentMount = mountRef.current;

    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    let meydaAnalyzer: any;
    let lastAnalysisTime = 0;
    const analysisInterval = 100; // in milliseconds

    if (analyser && isPlaying) {
      meydaAnalyzer = Meyda.default.createMeydaAnalyzer({
        audioContext: analyser.context,
        source: analyser,
        bufferSize: 512,
        featureExtractors: ['rms', 'spectralCentroid', 'spectralFlatness', 'spectralSlope', 'spectralRolloff'],
        callback: (features) => {
          const currentTime = performance.now();
          if (currentTime - lastAnalysisTime > analysisInterval) {
            lastAnalysisTime = currentTime;

            const { rms, spectralCentroid, spectralFlatness, spectralSlope, spectralRolloff } = features;

            // Adjusted scoring system with new ranges
            const kickScore = (rms > 0.2 && spectralCentroid < 20) ? rms * (1 - spectralFlatness) * 2 : 0;
            const bassScore = (rms > 0.1 && spectralCentroid >= 20 && spectralCentroid < 40) ? rms * (1 - spectralFlatness) * 1.5 : 0;
            const synthScore = (rms > 0.05 && spectralCentroid >= 40) ? rms * spectralFlatness * 3 : 0;

            // Find the instrument with the highest score
            const scores = [
              { instrument: 'Kick', score: kickScore },
              { instrument: 'Bass', score: bassScore },
              { instrument: 'Synth', score: synthScore },
            ];

            const detectedInstrument = scores.reduce(
              (max, current) => (current.score > max.score ? current : max),
              { instrument: 'None', score: 0 }
            );

            // Update state based on the detected instrument
            setKickDetected(detectedInstrument.instrument === 'Kick');
            setBassDetected(detectedInstrument.instrument === 'Bass');
            setSynthDetected(detectedInstrument.instrument === 'Synth');

            // Update instrumentType state
            if (detectedInstrument.instrument !== 'None' && detectedInstrument.score > 0.1) {
              setInstrumentType(
                detectedInstrument.instrument === 'Kick' ? 1 :
                detectedInstrument.instrument === 'Bass' ? 2 :
                detectedInstrument.instrument === 'Synth' ? 3 :
                0
              );
              console.log(
                `Detected: ${detectedInstrument.instrument}, Score: ${detectedInstrument.score.toFixed(4)}, Features:`,
                { rms, spectralCentroid, spectralFlatness, spectralSlope, spectralRolloff }
              );
            } else {
              setInstrumentType(0);
            }
          }
        },
      });

      meydaAnalyzer.start();
    }

    return () => {
      if (meydaAnalyzer) {
        meydaAnalyzer.stop();
      }
    };
  }, [analyser, isPlaying]);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const animate = () => {
      if (
        rendererRef.current &&
        sceneRef.current &&
        cameraRef.current &&
        materialRef.current
      ) {
        timeRef.current += 0.01;

        materialRef.current.uniforms.time.value = timeRef.current;

        // Update instrumentType uniform
        materialRef.current.uniforms.instrumentType.value = instrumentType;

        // Change color based on instrument detection
        const targetColor = kickDetected
          ? new THREE.Color(1, 0, 0)
          : bassDetected
          ? new THREE.Color(0, 0, 1)
          : synthDetected
          ? new THREE.Color(0, 1, 0)
          : new THREE.Color(0.5, 0.5, 0.5);

        const currentColor = materialRef.current.uniforms.color.value;
        currentColor.lerp(targetColor, 0.1); // Smooth transition between colors
        materialRef.current.uniforms.color.value = currentColor;

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animate();
    } else {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, instrumentType, kickDetected, bassDetected, synthDetected]);

  useEffect(() => {
    if (materialRef.current) {
      switch (mode) {
        case 'default':
          materialRef.current.uniforms.mode.value = 0;
          break;
        case 'bass':
          materialRef.current.uniforms.mode.value = 1;
          break;
        case 'chill':
          materialRef.current.uniforms.mode.value = 2;
          break;
        case 'explosive':
          materialRef.current.uniforms.mode.value = 3;
          break;
      }
    }
  }, [mode]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Scene;
