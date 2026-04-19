'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useAudio } from '../context/AudioContext';
import { Button } from '@/components/ui/button';

const themes = ['light', 'dark', 'purple', 'redWhite', 'blue', 'green'] as const;
type ThemeName = (typeof themes)[number];

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const {
    currentTrack,
    isPlaying,
    isMuted,
    volume,
    togglePlay,
    nextTrack,
    toggleMute,
    setVolume,
  } = useAudio();

  const safeTheme: ThemeName =
    theme === 'light' || theme === 'dark' || theme === 'purple' || 'redWhite' || 'blue' || 'green'
      ? theme
      : 'light';

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer"
        aria-label="Open settings"
      >
        ⚙️
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-120 rounded-xl border border-border bg-card p-4 shadow-xl">
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Theme</h3>
              <div className="mt-3 flex gap-2">
                {themes.map((themeName) => (
                  <Button
                    key={themeName}
                    type="button"
                    variant={safeTheme === themeName ? 'default' : 'outline'}
                    onClick={() => setTheme(themeName)}
                    className="capitalize"
                  >
                    {themeName}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Background Music</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentTrack ? currentTrack.title : 'No track selected'}
              </p>

              <div className="mt-3 flex gap-2">
                <Button type="button" variant="outline" onClick={togglePlay}>
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button type="button" variant="outline" onClick={nextTrack}>
                  Next
                </Button>
                <Button type="button" variant="outline" onClick={toggleMute}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-foreground">
                  Volume
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="w-full cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}