import React from 'react';
import { ImageIcon, Volume2, Video } from 'lucide-react';
import { MediaClue } from '../../types/game';

export interface MediaIndicatorProps {
  media?: MediaClue | null;
  className?: string;
  iconClassName?: string;
}

export const YoutubeIcon: React.FC<{
  className?: string;
  'data-testid'?: string;
}> = ({ className = 'w-3.5 h-3.5', 'data-testid': testId }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    data-testid={testId}
  >
    <path
      d={
        'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 ' +
        '3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186' +
        'C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 ' +
        '2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 ' +
        '3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814' +
        'zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'
      }
    />
  </svg>
);

export const MediaIndicator: React.FC<MediaIndicatorProps> = ({
  media,
  className = '',
  iconClassName = 'w-3.5 h-3.5',
}) => {
  if (!media || media.type === 'none') {
    return null;
  }

  const baseClasses =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded shadow-sm ' +
    'shrink-0';

  if (media.type === 'image') {
    const pillClasses =
      `${baseClasses} bg-sky-950/80 text-sky-300 ` +
      'border border-sky-500/60';
    return (
      <span
        className={`${pillClasses} ${className}`.trim()}
        title="Image Clue"
        aria-label="Image clue"
        data-testid="media-indicator"
      >
        <ImageIcon
          className={iconClassName}
          strokeWidth={2.25}
          data-testid="media-icon-image"
          aria-hidden="true"
        />
      </span>
    );
  }

  if (media.type === 'audio') {
    const pillClasses =
      `${baseClasses} bg-purple-950/80 text-purple-300 ` +
      'border border-purple-500/60';
    return (
      <span
        className={`${pillClasses} ${className}`.trim()}
        title="Audio Clue"
        aria-label="Audio clue"
        data-testid="media-indicator"
      >
        <Volume2
          className={iconClassName}
          strokeWidth={2.25}
          data-testid="media-icon-audio"
          aria-hidden="true"
        />
      </span>
    );
  }

  if (media.type === 'video') {
    const pillClasses =
      `${baseClasses} bg-teal-950/80 text-teal-300 ` +
      'border border-teal-500/60';
    return (
      <span
        className={`${pillClasses} ${className}`.trim()}
        title="Video Clue"
        aria-label="Video clue"
        data-testid="media-indicator"
      >
        <Video
          className={iconClassName}
          strokeWidth={2.25}
          data-testid="media-icon-video"
          aria-hidden="true"
        />
      </span>
    );
  }

  if (media.type === 'youtube') {
    if (media.audioOnly) {
      const pillClasses =
        `${baseClasses} bg-purple-950/80 text-purple-300 ` +
        'border border-purple-500/60';
      return (
        <span
          className={`${pillClasses} ${className}`.trim()}
          title="YouTube (Audio Only)"
          aria-label="YouTube audio-only clue"
          data-testid="media-indicator"
        >
          <YoutubeIcon
            className={`${iconClassName} text-red-400`}
            data-testid="media-icon-youtube"
          />
          <Volume2
            className={`${iconClassName} text-purple-300`}
            strokeWidth={2.25}
            data-testid="media-icon-audio"
            aria-hidden="true"
          />
        </span>
      );
    }

    const pillClasses =
      `${baseClasses} bg-red-950/80 text-red-400 ` +
      'border border-red-600/60';
    return (
      <span
        className={`${pillClasses} ${className}`.trim()}
        title="YouTube Clue"
        aria-label="YouTube clue"
        data-testid="media-indicator"
      >
        <YoutubeIcon
          className={`${iconClassName} text-red-400`}
          data-testid="media-icon-youtube"
        />
      </span>
    );
  }

  return null;
};
