import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface SceneProps {
  analyser: AnalyserNode | null
  isPlaying: boolean
  mode: string
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float time;
  uniform float audioLevel;
  uniform float audioBass;
  uniform float audioMid;
  uniform float audioTreble;
  uniform float audioPeak;
  uniform float rotationSpeed;
  uniform int mode;
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

  vec3 defaultMode(vec2 uv) {
    // Center UV coordinates
    uv -= 0.5;
    // Scale UV coordinates
    uv *= 2.0;

    // Rotate UV coordinates based on bass level
    float angle = time * rotationSpeed;
    uv = rotate2d(angle) * uv;

    // Calculate size
    float size = 0.3 + 0.05 * sin(time);
    size += 0.1 * audioLevel;

    // Calculate SDFs
    float circleSDF = sdCircle(uv, size);
    float squareSDF = sdSquare(uv, size);
    float diamondSDF = sdDiamond(uv, size);

    // Transition between shapes based on audioLevel
    float shapeSDF;
    if (audioLevel < 0.4) {
      shapeSDF = circleSDF;
    } else if (audioLevel < 0.7) {
      float t = (audioLevel - 0.4) / 0.3;
      shapeSDF = mix(circleSDF, squareSDF, t);
    } else if (audioLevel < 0.9) {
      shapeSDF = squareSDF;
    } else {
      float t = (audioLevel - 0.9) / 0.1;
      shapeSDF = mix(squareSDF, diamondSDF, t);
    }

    // Compute the antialiased edge
    float edgeWidth = 0.005;
    float alpha = smoothstep(-edgeWidth, edgeWidth, -shapeSDF);

    // Determine color inside the shape using HSV
    float hue = mod(audioBass * 2.0 + time * 0.1, 1.0);
    vec3 shapeColor = hsv2rgb(vec3(hue, 1.0, 1.0));

    // Background color
    vec3 backgroundColor = vec3(0.0);

    // Final color
    vec3 color = mix(backgroundColor, shapeColor, alpha);

    // Optional: Modify glow effect
    float glow = exp(-abs(shapeSDF) * 5.0);
    color += glow * vec3(1.0) * 0.1;

    return color;
  }

  vec3 bassMode(vec2 uv) {
    float f = sin(uv.x * 20.0 + time * audioBass * 10.0) * cos(uv.y * 20.0 + time * audioBass * 10.0) * 0.5 + 0.5;
    vec3 color = vec3(f * audioBass, f * audioMid * 0.5, f * audioTreble * 0.2);
    if (audioPeak > 0.8) {
      color = 1.0 - color; // Invert colors on beat drops
    }
    return color;
  }

  vec3 chillMode(vec2 uv) {
    uv = kaleidoscope(uv);
    float r = length(uv);
    float angle = atan(uv.y, uv.x);
    
    float f = sin(r * 10.0 - time * 2.0) * 0.5 + 0.5;
    f += sin(angle * 6.0 + time * 3.0) * 0.5 + 0.5;
    f *= audioLevel;
    
    vec3 color = vec3(f);
    color.r += sin(time * 0.5) * 0.5 + 0.5 + audioBass * 0.5;
    color.g += cos(time * 0.7) * 0.5 + 0.5 + audioMid * 0.3;
    color.b += sin(time * 0.9) * 0.5 + 0.5 + audioTreble * 0.2;
    return color * audioLevel;
  }

  vec3 explosiveMode(vec2 uv) {
    float f = fract(length(uv) - time * audioPeak * 4.0);
    vec3 color = vec3(f * audioBass, f * audioMid * 0.5, f * audioTreble * 0.2);
    if (audioPeak > 0.9) {
      color += vec3(1.0, 0.5, 0.2) * (audioPeak - 0.9) * 10.0; // Add explosive effect on strong beats
    }
    return color;
  }

  void main() {
    vec2 uv = vUv;
    vec3 color;
    
    if (mode == 0) {
      color = defaultMode(uv);
    } else if (mode == 1) {
      color = bassMode(uv);
    } else if (mode == 2) {
      color = chillMode(uv);
    } else if (mode == 3) {
      color = explosiveMode(uv);
    }
    
    gl_FragColor = vec4(color, 1.0);
  }
`

const Scene: React.FC<SceneProps> = ({ analyser, isPlaying, mode }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const timeRef = useRef<number>(0)

  const smoothedAudioDataRef = useRef({
    bass: 0,
    mid: 0,
    treble: 0,
    average: 0,
    peak: 0,
  });

  const audioDataRef = useRef({
    bass: 0,
    mid: 0,
    treble: 0,
    average: 0,
    peak: 0,
  })

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    const aspect = window.innerWidth / window.innerHeight
    const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100)
    const renderer = new THREE.WebGLRenderer()

    renderer.setSize(window.innerWidth, window.innerHeight)
    mountRef.current.appendChild(renderer.domElement)

    camera.position.z = 1

    const geometry = new THREE.PlaneGeometry(2 * aspect, 2)
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
      },
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    materialRef.current = material

    const handleResize = () => {
      const newAspect = window.innerWidth / window.innerHeight
      if (cameraRef.current) {
        cameraRef.current.left = -newAspect
        cameraRef.current.right = newAspect
        cameraRef.current.updateProjectionMatrix()
      }
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      mountRef.current?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const analyzeAudio = () => {
      if (analyser && isPlaying) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        const mid = dataArray.slice(10, 100).reduce((a, b) => a + b, 0) / 90;
        const treble = dataArray.slice(100, 256).reduce((a, b) => a + b, 0) / 156;
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const peak = Math.max(...dataArray);

        audioDataRef.current = {
          bass: bass / 255,
          mid: mid / 255,
          treble: treble / 255,
          average: average / 255,
          peak: peak / 255,
        };

        // Exponential smoothing
        const smoothingFactor = 0.8; // Adjust between 0 (no smoothing) and 1 (very smooth)
        smoothedAudioDataRef.current.bass =
          smoothedAudioDataRef.current.bass * smoothingFactor +
          audioDataRef.current.bass * (1 - smoothingFactor);
        smoothedAudioDataRef.current.mid =
          smoothedAudioDataRef.current.mid * smoothingFactor +
          audioDataRef.current.mid * (1 - smoothingFactor);
        smoothedAudioDataRef.current.treble =
          smoothedAudioDataRef.current.treble * smoothingFactor +
          audioDataRef.current.treble * (1 - smoothingFactor);
        smoothedAudioDataRef.current.average =
          smoothedAudioDataRef.current.average * smoothingFactor +
          audioDataRef.current.average * (1 - smoothingFactor);
        smoothedAudioDataRef.current.peak =
          smoothedAudioDataRef.current.peak * smoothingFactor +
          audioDataRef.current.peak * (1 - smoothingFactor);
      } else {
        audioDataRef.current = {
          bass: 0,
          mid: 0,
          treble: 0,
          average: 0,
          peak: 0,
        };
        smoothedAudioDataRef.current = { ...audioDataRef.current };
      }
    };

    const animate = () => {
      requestAnimationFrame(animate);
    
      analyzeAudio();
    
      if (rendererRef.current && sceneRef.current && cameraRef.current && materialRef.current) {
        timeRef.current += 0.01;
    
        const scalingFactor = 5; // Adjust as needed
        const scaledAudioLevel = THREE.MathUtils.clamp(
          smoothedAudioDataRef.current.average * scalingFactor + 0.1,
          0.0,
          1.0
        );
        materialRef.current.uniforms.audioLevel.value = scaledAudioLevel;

        // Calculate rotation speed based on bass level
        const rotationSpeed = smoothedAudioDataRef.current.bass * 5.0 + 0.2; // Adjust multiplier and offset as needed
        materialRef.current.uniforms.rotationSpeed.value = rotationSpeed;
    
        // Update other uniforms as needed
        materialRef.current.uniforms.audioBass.value = THREE.MathUtils.clamp(
          smoothedAudioDataRef.current.bass * scalingFactor + 0.1,
          0.0,
          1.0
        );
        materialRef.current.uniforms.audioMid.value = THREE.MathUtils.clamp(
          smoothedAudioDataRef.current.mid * scalingFactor + 0.1,
          0.0,
          1.0
        );
        materialRef.current.uniforms.audioTreble.value = THREE.MathUtils.clamp(
          smoothedAudioDataRef.current.treble * scalingFactor + 0.1,
          0.0,
          1.0
        );
        materialRef.current.uniforms.audioPeak.value = THREE.MathUtils.clamp(
          smoothedAudioDataRef.current.peak * scalingFactor + 0.1,
          0.0,
          1.0
        );
    
        materialRef.current.uniforms.time.value = timeRef.current;
    
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }

    animate()
  }, [analyser, isPlaying])

  useEffect(() => {
    if (materialRef.current) {
      switch (mode) {
        case 'default':
          materialRef.current.uniforms.mode.value = 0
          break
        case 'bass':
          materialRef.current.uniforms.mode.value = 1
          break
        case 'chill':
          materialRef.current.uniforms.mode.value = 2
          break
        case 'explosive':
          materialRef.current.uniforms.mode.value = 3
          break
      }
    }
  }, [mode])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}

export default Scene
