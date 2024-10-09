import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, UploadCloud, Repeat, Volume2, Volume1, VolumeX } from 'lucide-react'
import styles from './ModernVisualizer.module.css'
import Scene from './3DAudioVisualizer.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'

export default function ModernVisualizer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [volume, setVolume] = useState(100)
  const [visualizerMode, setVisualizerMode] = useState('default')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)

  useEffect(() => {
    if (audioFile) {
      const audio = new Audio(URL.createObjectURL(audioFile))
      audioRef.current = audio
      audio.crossOrigin = "anonymous"; // Important for CORS issues
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
      })
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })
      audio.addEventListener('ended', () => {
        if (isLooping) {
          audio.currentTime = 0
          audio.play()
        } else {
          setIsPlaying(false)
        }
      })

      // Create AudioContext and AnalyserNode
      audioContextRef.current = new window.AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048

      // Create a MediaElementAudioSourceNode from the audio element
      sourceRef.current = audioContextRef.current.createMediaElementSource(audio)
      sourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(audioContextRef.current.destination)

      return () => {
        audio.pause()
        URL.revokeObjectURL(audio.src)
        sourceRef.current?.disconnect()
        analyserRef.current?.disconnect()
        audioContextRef.current?.close()
      }
    }
  }, [audioFile, isLooping])

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
        audioContextRef.current?.resume()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleLoop = () => {
    setIsLooping(!isLooping)
    if (audioRef.current) {
      audioRef.current.loop = !isLooping
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }

  const handleVisualizerModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value
    setVisualizerMode(mode)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value)
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className={styles.container}>
      <div className={styles.visualizer}>
        {audioFile ? (
          <ErrorBoundary>
            <Scene analyser={analyserRef.current} isPlaying={isPlaying} mode={visualizerMode} />
          </ErrorBoundary>
        ) : (
          <div className={styles.noFileMessage}>
            <UploadCloud size={48} />
            <p>Upload a file to get started!</p>
          </div>
        )}
      </div>
      <div className={styles.controls}>
        <div className={styles.progressBarContainer}>
          <input
            type="range"
            min={0}
            max={duration}
            value={currentTime}
            onChange={handleProgressChange}
            className={styles.progressBar}
            disabled={!audioFile}
          />
          <div className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        <div className={styles.buttons}>
          <button onClick={handleLoop} disabled={!audioFile} className={styles.button}>
            <Repeat size={24} color={isLooping ? '#1DB954' : 'currentColor'} />
          </button>
          <button onClick={handlePlayPause} disabled={!audioFile} className={styles.button}>
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="audio-upload"
          />
          <label htmlFor="audio-upload" className={styles.uploadButton}>
            <UploadCloud size={24} />
          </label>
        </div>
        <div className={styles.additionalControls}>
          <div className={styles.volumeControl}>
            <VolumeIcon size={20} />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className={styles.volumeSlider}
              disabled={!audioFile}
            />
          </div>
          <select
            value={visualizerMode}
            onChange={handleVisualizerModeChange}
            className={styles.modeSelect}
            disabled={!audioFile}
          >
            <option value="default">Default Mode</option>
            <option value="bass">Bass Mode</option>
            <option value="chill">Chill Mode</option>
            <option value="explosive">Explosive Mode</option>
          </select>
        </div>
      </div>
    </div>
  )
}
