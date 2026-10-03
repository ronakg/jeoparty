import React, { useEffect, useRef } from 'react';
import { MediaClue } from '../../types/game';
import { Volume2, ExternalLink } from 'lucide-react';
import { parseYouTubeUrl } from '../../utils/youtube';

interface MediaRendererProps {
  media: MediaClue;
  resolvedUrl: string;
  isPlaying?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  showControls?: boolean;
  autoPlay?: boolean;
  fullScreen?: boolean;
  className?: string;
}

export const MediaRenderer: React.FC<MediaRendererProps> = ({
  media,
  resolvedUrl,
  isPlaying = false,
  onPlayStateChange,
  showControls = true,
  autoPlay = false,
  fullScreen = false,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync play/pause commands from parent (Admin controls)
  useEffect(() => {
    if (media.type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    } else if (media.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, media.type]);

  // Clean up playback and streams when component unmounts
  useEffect(() => {
    const audioEl = audioRef.current;
    const videoEl = videoRef.current;
    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.src = '';
      }
    };
  }, []);

  if (!media || media.type === 'none' || !resolvedUrl) {
    return null;
  }

  // YouTube Embed
  if (media.type === 'youtube') {
    const origin =
      typeof window !== 'undefined' &&
      window.location.origin &&
      window.location.origin.startsWith('http')
        ? window.location.origin
        : undefined;

    const { embedUrl } = parseYouTubeUrl(resolvedUrl, origin, showControls);

    const containerStyle = fullScreen
      ? 'w-full h-full max-w-full max-h-full aspect-video border-4 ' +
        'border-yellow-500 rounded-2xl shadow-[0_0_50px_rgba(6,12,233,0.8)]'
      : 'w-auto h-full max-w-full max-h-full aspect-video rounded-xl ' +
        'border-4 border-yellow-500/40 shadow-2xl';

    return (
      <div
        className={
          `relative overflow-hidden bg-black flex items-center ` +
          `justify-center ${containerStyle} ${className}`
        }
      >
        {/* Title bar shield obscuring spoiler title from player display */}
        {!showControls && (
          <div
            className="absolute top-0 left-0 right-0 h-14 bg-black
              pointer-events-none z-10"
            data-testid="youtube-title-mask"
          />
        )}
        <iframe
          src={embedUrl}
          title="YouTube Clue Video"
          className="w-full h-full"
          allow={
            'accelerometer; autoplay; clipboard-write; ' +
            'encrypted-media; gyroscope; picture-in-picture; web-share'
          }
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
        {showControls && (
          <button
            type="button"
            onClick={() => {
              if (window.electronAPI?.openExternalUrl) {
                window.electronAPI.openExternalUrl(resolvedUrl);
              } else {
                window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className={
              'absolute bottom-2 right-2 z-20 flex items-center ' +
              'gap-1.5 px-2.5 py-1 text-xs font-semibold text-white/90 ' +
              'bg-black/70 hover:bg-black/90 rounded border ' +
              'border-white/20 transition-colors shadow'
            }
            title="Open video in external browser"
          >
            <ExternalLink className="w-3.5 h-3.5 text-yellow-400" />
            <span>Open in Browser</span>
          </button>
        )}
      </div>
    );
  }

  // Image Clue (Zero-Cropping strictly bounded to container)
  if (media.type === 'image') {
    return (
      <img
        src={resolvedUrl}
        alt="Clue Picture"
        className={
          'max-h-full max-w-full w-auto h-auto object-contain rounded-2xl ' +
          'border-4 border-yellow-500/80 bg-black/95 p-1.5 md:p-2 ' +
          `shadow-2xl block select-none ${className}`
        }
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).alt =
            'Failed to load image at: ' + resolvedUrl;
        }}
      />
    );
  }

  // Video Clue
  if (media.type === 'video') {
    const containerStyle = fullScreen
      ? 'w-full h-full max-w-full max-h-full aspect-video border-4 ' +
        'border-yellow-500 rounded-2xl shadow-[0_0_50px_rgba(6,12,233,0.8)]'
      : 'w-auto h-full max-w-full max-h-full aspect-video border-4 ' +
        'border-yellow-500/40 rounded-xl shadow-2xl';

    return (
      <div
        className={
          `relative overflow-hidden bg-black flex flex-col ` +
          `items-center justify-center ${containerStyle} ${className}`
        }
      >
        <video
          ref={videoRef}
          src={resolvedUrl}
          controls={showControls}
          autoPlay={autoPlay}
          className="w-full h-full object-contain"
          onPlay={() => onPlayStateChange?.(true)}
          onPause={() => onPlayStateChange?.(false)}
        />
      </div>
    );
  }

  // Audio Clue
  if (media.type === 'audio') {
    const containerStyle = fullScreen
      ? 'w-full max-w-2xl p-8 border-4 border-yellow-500 rounded-3xl ' +
        'shadow-[0_0_50px_rgba(6,12,233,0.8)]'
      : 'w-full max-w-xl p-6 border-2 border-yellow-500/50 rounded-2xl ' +
        'shadow-2xl';

    return (
      <div
        className={
          'bg-gradient-to-r from-blue-900/95 to-indigo-900/95 flex ' +
          `flex-col items-center gap-4 ${containerStyle} ${className}`
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={
              'p-3 bg-yellow-500/20 text-yellow-400 rounded-full animate-pulse'
            }
          >
            <Volume2 className="w-8 h-8" />
          </div>
          <span className="text-xl font-bold tracking-wider text-yellow-300">
            AUDIO CLUE
          </span>
        </div>

        {/* Animated Sound Wave Graphic */}
        <div className="flex items-center gap-1.5 h-12 py-2">
          {[40, 75, 30, 95, 60, 85, 45, 100, 70, 35, 90, 50].map((h, i) => (
            <div
              key={i}
              className={
                'w-2 bg-gradient-to-t from-yellow-500 to-amber-300 ' +
                'rounded-full transition-all duration-300 ' +
                (isPlaying ? 'animate-pulse' : 'opacity-40')
              }
              style={{
                height: isPlaying
                  ? `${Math.max(20, (h * (i % 2 === 0 ? 0.9 : 1.1)) % 100)}%`
                  : '20%',
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        <audio
          ref={audioRef}
          src={resolvedUrl}
          controls={showControls}
          onPlay={() => onPlayStateChange?.(true)}
          onPause={() => onPlayStateChange?.(false)}
          className="w-full mt-2"
        />
      </div>
    );
  }

  return null;
};
