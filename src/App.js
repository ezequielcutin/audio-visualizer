import React, { useState, useCallback, useRef, useEffect } from 'react';
import ModernVisualizer from './components/ModernVisualizer.tsx';
import { setupAudio } from './audioUtils';

function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRepeat, setIsRepeat] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState('default');
  const [isZenMode, setIsZenMode] = useState(false);
  
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioBufferRef = useRef(null);

  const handleFileUpload = useCallback((file) => {
    setAudioFile(file);
    setupAudio(file).then(({ audioContext, analyserNode, audioBuffer }) => {
      audioContextRef.current = audioContext;
      setAnalyser(analyserNode);
      audioBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.connect(audioContext.destination);
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (audioContextRef.current && audioBufferRef.current) {
      if (isPlaying) {
        if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
        }
      } else {
        sourceNodeRef.current = audioContextRef.current.createBufferSource();
        sourceNodeRef.current.buffer = audioBufferRef.current;
        sourceNodeRef.current.connect(analyser);
        analyser.connect(gainNodeRef.current);
        sourceNodeRef.current.start(0, currentTime);
        sourceNodeRef.current.onended = () => setIsPlaying(false);
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, analyser, currentTime]);

  const handleVolumeChange = useCallback((volume) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume / 100, audioContextRef.current.currentTime);
    }
  }, []);

  const handleSeek = useCallback((progress) => {
    setCurrentTime(progress);
    if (isPlaying) {
      handleTogglePlay();
      handleTogglePlay();
    }
  }, [isPlaying, handleTogglePlay]);

  const handleRepeatToggle = useCallback(() => {
    setIsRepeat(!isRepeat);
  }, [isRepeat]);

  const handleVisualizerModeChange = useCallback((mode) => {
    setVisualizerMode(mode);
  }, []);

  const handleZenModeToggle = useCallback(() => {
    setIsZenMode(!isZenMode);
  }, [isZenMode]);

  useEffect(() => {
    let animationFrameId;
    const updateTime = () => {
      if (isPlaying && audioContextRef.current) {
        setCurrentTime((audioContextRef.current.currentTime) % duration);
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };
    updateTime();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, duration]);

  return (
    <ModernVisualizer
      analyser={analyser}
      audioFile={audioFile}
      isPlaying={isPlaying}
      onTogglePlay={handleTogglePlay}
      onFileUpload={handleFileUpload}
      onVolumeChange={handleVolumeChange}
      onSeek={handleSeek}
      duration={duration}
      currentTime={currentTime}
      onRepeatToggle={handleRepeatToggle}
      isRepeat={isRepeat}
      onVisualizerModeChange={handleVisualizerModeChange}
      visualizerMode={visualizerMode}
      isZenMode={isZenMode}
      onZenModeToggle={handleZenModeToggle}
    />
  );
}

export default App;