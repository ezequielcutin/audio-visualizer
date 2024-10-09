// export async function setupAudio(file) {
//     const AudioContext = window.AudioContext || window.webkitAudioContext;
//     const audioContext = new AudioContext();
//     const analyser = audioContext.createAnalyser();
//     analyser.fftSize = 2048;
  
//     const arrayBuffer = await file.arrayBuffer();
//     const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
//     console.log("Audio setup complete, analyser connected");
  
//     return { audioContext, analyserNode: analyser, audioBuffer };
//   }