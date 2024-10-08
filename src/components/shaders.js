export const vertexShader = `
  uniform float time;
  varying vec3 vColor;
  
  void main() {
    vColor = color;
    vec3 pos = position;
    
    float frequency = 2.0;
    float amplitude = 0.1;
    pos.y += sin(pos.x * frequency + time) * amplitude;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const fragmentShader = `
  varying vec3 vColor;
  
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;