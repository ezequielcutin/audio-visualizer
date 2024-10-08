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

  vec3 defaultMode(vec2 uv) {
    float f = sin(length(uv) * 10.0 - time * 2.0) * 0.5 + 0.5;
    return vec3(f * audioLevel, f * audioLevel * 0.5, f * audioLevel * 0.2);
  }

  vec3 bassMode(vec2 uv) {
    float f = sin(uv.x * 20.0 + time * audioLevel * 5.0) * cos(uv.y * 20.0 + time * audioLevel * 5.0) * 0.5 + 0.5;
    return vec3(f * audioLevel, 0.0, 0.0);
  }

  vec3 chillMode(vec2 uv) {
    uv = kaleidoscope(uv);
    float r = length(uv);
    float angle = atan(uv.y, uv.x);
    
    float f = sin(r * 10.0 - time * 2.0) * 0.5 + 0.5;
    f += sin(angle * 6.0 + time * 3.0) * 0.5 + 0.5;
    f *= audioLevel;
    
    vec3 color = vec3(f);
    color.r += sin(time * 0.5) * 0.5 + 0.5;
    color.g += cos(time * 0.7) * 0.5 + 0.5;
    color.b += sin(time * 0.9) * 0.5 + 0.5;
    return color * audioLevel;
  }

  vec3 explosiveMode(vec2 uv) {
    float f = fract(length(uv) - time * audioLevel * 2.0);
    return vec3(f * audioLevel, f * audioLevel * 0.5, 0.0);
  }

  void main() {
    vec2 uv = vUv - 0.5;
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
    const animate = () => {
      requestAnimationFrame(animate)

      if (rendererRef.current && sceneRef.current && cameraRef.current && materialRef.current) {
        timeRef.current += 0.01

        if (analyser && isPlaying) {
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          const averageFrequency = dataArray.reduce((a, b) => a + b) / dataArray.length
          const normalizedLevel = averageFrequency / 255

          materialRef.current.uniforms.audioLevel.value = normalizedLevel * 2 + 0.1 // Amplify the effect
        } else {
          materialRef.current.uniforms.audioLevel.value = 0.1 // Small non-zero value for visibility when paused
        }

        materialRef.current.uniforms.time.value = timeRef.current

        rendererRef.current.render(sceneRef.current, cameraRef.current)
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