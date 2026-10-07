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
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastLoggedSecRef = useRef<number>(-1);
  const shouldPlayRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    shouldPlayRef.current = isPlaying;
  }, [isPlaying]);

  const safePlay = (el: HTMLMediaElement, type: string) => {
    shouldPlayRef.current = true;
    if (el.ended) {
      el.currentTime = 0;
    }
    const logInfo =
      `readyState=${el.readyState}, paused=${el.paused}, ` +
      `currentTime=${el.currentTime.toFixed(2)}`;
    window.electronAPI?.writeTraceLog?.(
      `[RENDERER] ${type} play() requested (${logInfo})`
    );
    const promise = el.play();
    playPromiseRef.current = promise;
    promise
      .then(() => {
        if (playPromiseRef.current === promise) {
          playPromiseRef.current = null;
        }
        window.electronAPI?.writeTraceLog?.(
          `[RENDERER] ${type} play() resolved ` +
            `(cur=${el.currentTime.toFixed(2)})`
        );
      })
      .catch((err: unknown) => {
        if (playPromiseRef.current === promise) {
          playPromiseRef.current = null;
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const msg =
          `[RENDERER] ${type} play rejected: ` +
          (err instanceof Error ? err.message : String(err));
        console.error(msg);
        window.electronAPI?.writeTraceLog?.(msg);
      });
  };

  const safePause = (
    el: HTMLMediaElement,
    type: string,
    reason = 'control'
  ) => {
    const status = `${reason}, paused=${el.paused}`;
    window.electronAPI?.writeTraceLog?.(
      `[RENDERER] ${type} pause() requested (${status})`
    );
    if (playPromiseRef.current) {
      playPromiseRef.current
        .then(() => {
          if (!shouldPlayRef.current) {
            window.electronAPI?.writeTraceLog?.(
              `[RENDERER] ${type} executing deferred pause (${reason})`
            );
            el.pause();
          } else {
            window.electronAPI?.writeTraceLog?.(
              `[RENDERER] ${type} ignoring deferred pause (${reason}): ` +
                'shouldPlay=true'
            );
          }
        })
        .catch(() => {
          if (!shouldPlayRef.current) {
            el.pause();
          }
        });
    } else {
      if (!shouldPlayRef.current) {
        el.pause();
      }
    }
  };

  const handleCanPlay = (el: HTMLMediaElement, type: string) => {
    window.electronAPI?.writeTraceLog?.(
      `[RENDERER] ${type} canplay ` +
        `(readyState=${el.readyState}, paused=${el.paused})`
    );
    if (shouldPlayRef.current && el.paused) {
      safePlay(el, type);
    }
  };

  // Sync play/pause commands from parent (Admin controls)
  useEffect(() => {
    const el =
      media.type === 'audio'
        ? audioRef.current
        : media.type === 'video'
          ? videoRef.current
          : null;

    if (!el) return;

    if (isPlaying) {
      shouldPlayRef.current = true;
      safePlay(el, media.type === 'audio' ? 'Audio' : 'Video');
    } else {
      shouldPlayRef.current = false;
      safePause(
        el,
        media.type === 'audio' ? 'Audio' : 'Video',
        'prop-change'
      );
    }
  }, [isPlaying, media.type, resolvedUrl]);

  // Clean up playback when component unmounts
  useEffect(() => {
    return () => {
      shouldPlayRef.current = false;
      const audioEl = audioRef.current;
      const videoEl = videoRef.current;
      if (audioEl) {
        safePause(audioEl, 'Audio', 'unmount');
      }
      if (videoEl) {
        safePause(videoEl, 'Video', 'unmount');
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
          'border border-white/15 bg-black/85 p-1.5 md:p-2 ' +
          'shadow-[0_12px_40px_rgba(0,0,0,0.8)] block select-none ' +
          'shrink min-h-0 ' +
          className
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
          loop
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
          onCanPlay={(e) => handleCanPlay(e.currentTarget, 'Video')}
          onPlay={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Video onPlay event fired'
            );
            onPlayStateChange?.(true);
          }}
          onPause={() => {
            const status = `shouldPlay=${shouldPlayRef.current}`;
            window.electronAPI?.writeTraceLog?.(
              `[RENDERER] Video onPause event fired (${status})`
            );
            if (shouldPlayRef.current) {
              window.electronAPI?.writeTraceLog?.(
                '[RENDERER] Video resuming after unexpected pause'
              );
              if (videoRef.current) {
                safePlay(videoRef.current, 'Video');
              }
            } else {
              onPlayStateChange?.(false);
            }
          }}
          onEnded={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Video onEnded event fired'
            );
            onPlayStateChange?.(false);
          }}
          onTimeUpdate={(e) => {
            const sec = Math.floor(e.currentTarget.currentTime);
            if (sec !== lastLoggedSecRef.current && sec <= 5) {
              lastLoggedSecRef.current = sec;
              const dur = e.currentTarget.duration
                ? e.currentTarget.duration.toFixed(1)
                : '?';
              window.electronAPI?.writeTraceLog?.(
                `[RENDERER] Video progress: ${sec}s / ${dur}s`
              );
            }
          }}
          onWaiting={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Video waiting / buffering'
            );
          }}
          onStalled={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Video playback stalled'
            );
          }}
          onError={(e) => {
            const err = e.currentTarget.error;
            const msg =
              '[RENDERER] Video element error: ' +
              (err ? `${err.code}: ${err.message}` : 'unknown error') +
              ' | url: ' +
              resolvedUrl;
            console.error(msg);
            window.electronAPI?.writeTraceLog?.(msg);
          }}
          onLoadedData={() => {
            window.electronAPI?.writeTraceLog?.(
              `[RENDERER] Video data loaded: ${resolvedUrl}`
            );
          }}
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
          autoPlay={autoPlay}
          loop
          preload="auto"
          onCanPlay={(e) => handleCanPlay(e.currentTarget, 'Audio')}
          onPlay={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Audio onPlay event fired'
            );
            onPlayStateChange?.(true);
          }}
          onPause={() => {
            const status = `shouldPlay=${shouldPlayRef.current}`;
            window.electronAPI?.writeTraceLog?.(
              `[RENDERER] Audio onPause event fired (${status})`
            );
            if (shouldPlayRef.current) {
              window.electronAPI?.writeTraceLog?.(
                '[RENDERER] Audio resuming after unexpected pause'
              );
              if (audioRef.current) {
                safePlay(audioRef.current, 'Audio');
              }
            } else {
              onPlayStateChange?.(false);
            }
          }}
          onEnded={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Audio onEnded event fired'
            );
            onPlayStateChange?.(false);
          }}
          onTimeUpdate={(e) => {
            const sec = Math.floor(e.currentTarget.currentTime);
            if (sec !== lastLoggedSecRef.current && sec <= 5) {
              lastLoggedSecRef.current = sec;
              const dur = e.currentTarget.duration
                ? e.currentTarget.duration.toFixed(1)
                : '?';
              window.electronAPI?.writeTraceLog?.(
                `[RENDERER] Audio progress: ${sec}s / ${dur}s`
              );
            }
          }}
          onWaiting={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Audio waiting / buffering'
            );
          }}
          onStalled={() => {
            window.electronAPI?.writeTraceLog?.(
              '[RENDERER] Audio playback stalled'
            );
          }}
          onError={(e) => {
            const err = e.currentTarget.error;
            const msg =
              '[RENDERER] Audio element error: ' +
              (err ? `${err.code}: ${err.message}` : 'unknown error') +
              ' | url: ' +
              resolvedUrl;
            console.error(msg);
            window.electronAPI?.writeTraceLog?.(msg);
          }}
          onLoadedData={() => {
            window.electronAPI?.writeTraceLog?.(
              `[RENDERER] Audio data loaded: ${resolvedUrl}`
            );
          }}
          className="w-full mt-2"
        />
      </div>
    );
  }

  return null;
};
