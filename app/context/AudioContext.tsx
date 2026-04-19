'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

interface AudioTrack {
  id: string;
  title: string;
  src: string;
}

interface AudioContextType {
  tracks: AudioTrack[];
  currentTrackIndex: number;
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  isReady: boolean;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const TRACKS: AudioTrack[] = [
  { id: 'track-1', title: 'Tofubeats - What Should I Do?', src: '/audio/tofubeats.aac' },
  { id: 'track-2', title: 'Quiet Focus', src: '/audio/quiet-focus.mp3' },
  { id: 'track-3', title: 'Night Grid', src: '/audio/night-grid.mp3' },
];

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.4);
  const [isReady, setIsReady] = useState(false);

  const currentTrack = TRACKS[currentTrackIndex] ?? null;

  useEffect(() => {
    const audio = new Audio(TRACKS[0].src);
    audio.loop = false;
    audio.volume = volume;
    audio.muted = isMuted;
    audioRef.current = audio;

    const savedVolume = localStorage.getItem('bgm-volume');
    const savedMuted = localStorage.getItem('bgm-muted');
    const savedTrack = localStorage.getItem('bgm-track-index');

    if (savedVolume) {
      const parsed = Number(savedVolume);
      if (!Number.isNaN(parsed)) {
        audio.volume = parsed;
        setVolumeState(parsed);
      }
    }

    if (savedMuted) {
      const parsedMuted = savedMuted === 'true';
      audio.muted = parsedMuted;
      setIsMutedState(parsedMuted);
    }

    if (savedTrack) {
      const parsedTrack = Number(savedTrack);
      if (!Number.isNaN(parsedTrack) && TRACKS[parsedTrack]) {
        setCurrentTrackIndex(parsedTrack);
        audio.src = TRACKS[parsedTrack].src;
      }
    }

    const handleEnded = async () => {
      const nextIndex = (currentTrackIndex + 1) % TRACKS.length;
      setCurrentTrackIndex(nextIndex);
    };

    audio.addEventListener('ended', handleEnded);
    setIsReady(true);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current || !TRACKS[currentTrackIndex]) return;
    audioRef.current.src = TRACKS[currentTrackIndex].src;
    localStorage.setItem('bgm-track-index', String(currentTrackIndex));

    if (isPlaying) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentTrackIndex, isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    localStorage.setItem('bgm-volume', String(volume));
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = isMuted;
    localStorage.setItem('bgm-muted', String(isMuted));
  }, [isMuted]);

  const play = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.warn('Audio playback blocked or failed:', error);
    }
  };

  const pause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  };

  const nextTrack = async () => {
    const nextIndex = (currentTrackIndex + 1) % TRACKS.length;
    setCurrentTrackIndex(nextIndex);
  };

  const toggleMute = () => {
    setIsMutedState((prev) => !prev);
  };

  const setMuted = (muted: boolean) => {
    setIsMutedState(muted);
  };

  const setVolume = (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setVolumeState(clamped);
  };

  const value = useMemo(
    () => ({
      tracks: TRACKS,
      currentTrackIndex,
      currentTrack,
      isPlaying,
      isMuted,
      volume,
      isReady,
      play,
      pause,
      togglePlay,
      nextTrack,
      setMuted,
      toggleMute,
      setVolume,
    }),
    [currentTrackIndex, currentTrack, isPlaying, isMuted, volume, isReady]
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}