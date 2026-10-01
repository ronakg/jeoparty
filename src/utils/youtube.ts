/**
 * YouTube URL and Timestamp Parsing Utilities
 */

/**
 * Parses a YouTube timestamp string into total seconds.
 * Supports:
 * - Pure seconds: "90", "90s" -> 90
 * - Minutes/seconds: "1m30s", "2m", "45s" -> 90, 120, 45
 * - Hours/minutes/seconds: "1h2m3s", "1h30m", "1h" -> 3723, 5400, 3600
 * - Colon format: "01:30" -> 90, "01:02:03" -> 3723
 */
export function parseYouTubeTimestamp(
  timestampStr: string | null | undefined
): number | null {
  if (!timestampStr) return null;
  const str = timestampStr.trim().toLowerCase();
  if (!str) return null;

  // Format: HH:MM:SS or MM:SS
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => parseInt(p, 10));
    if (parts.some((n) => isNaN(n) || n < 0)) return null;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }

  // Format: Pure integer in seconds (e.g. "90")
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Format: Integer with 's' (e.g. "90s")
  if (/^\d+s$/.test(str)) {
    return parseInt(str.slice(0, -1), 10);
  }

  // Format: Combinations of h, m, s (e.g. "1h2m30s", "1h30m", "2m45s", "1h10s")
  const regex = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = str.match(regex);
  if (match && (match[1] || match[2] || match[3])) {
    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

/**
 * Formats a duration in seconds to MM:SS or HH:MM:SS format
 */
export function formatSecondsToTime(totalSeconds: number): string {
  if (totalSeconds < 0) return '0:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface ParsedYouTubeResult {
  videoId: string | null;
  startTimestampSeconds: number | null;
  embedUrl: string;
}

/**
 * Parses any standard YouTube URL (watch, youtu.be, embed, shorts)
 * and extracts the videoId, start timestamp, and generates the embed URL with ?start=
 */
export function parseYouTubeUrl(
  rawUrl: string,
  origin?: string,
  showControls: boolean = true
): ParsedYouTubeResult {
  if (!rawUrl || !rawUrl.trim()) {
    return { videoId: null, startTimestampSeconds: null, embedUrl: '' };
  }

  const trimmed = rawUrl.trim();
  let videoId: string | null = null;
  let timestampRaw: string | null = null;

  try {
    const urlString = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(urlString);

    // Extract timestamp from search params: t, start, time_continue
    timestampRaw =
      url.searchParams.get('t') ||
      url.searchParams.get('start') ||
      url.searchParams.get('time_continue');

    // Also check hash for #t=... or #start=...
    if (!timestampRaw && url.hash) {
      const hashStr = url.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashStr);
      timestampRaw = hashParams.get('t') || hashParams.get('start');
      if (!timestampRaw && hashStr.startsWith('t=')) {
        timestampRaw = hashStr.slice(2);
      }
    }

    const hostname = url.hostname.toLowerCase();

    if (hostname.includes('youtube.com')) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/embed/')) {
        videoId =
          url.pathname.split('/embed/')[1]?.split('/')[0]?.split('?')[0] ||
          null;
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId =
          url.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0] ||
          null;
      } else if (url.pathname.startsWith('/v/')) {
        videoId =
          url.pathname.split('/v/')[1]?.split('/')[0]?.split('?')[0] || null;
      }
    } else if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      videoId = url.pathname.slice(1).split('/')[0]?.split('?')[0] || null;
    }
  } catch {
    // If URL parsing throws, fallback to regex
  }

  // Fallback regex for video ID
  if (!videoId) {
    const match = trimmed.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/
    );
    if (match) {
      videoId = match[1];
    }
  }

  // Fallback regex for timestamp if not found in URL searchParams
  if (!timestampRaw) {
    const tMatch = trimmed.match(/[?&#](?:t|start|time_continue)=([^&#]+)/);
    if (tMatch) {
      timestampRaw = tMatch[1];
    }
  }

  const startSeconds = parseYouTubeTimestamp(timestampRaw);

  if (!videoId) {
    return {
      videoId: null,
      startTimestampSeconds: startSeconds,
      embedUrl: trimmed,
    };
  }

  const originParam =
    origin && origin.startsWith('http')
      ? `&origin=${encodeURIComponent(origin)}`
      : '';

  const startParam =
    startSeconds !== null && startSeconds > 0 ? `&start=${startSeconds}` : '';

  const controlsParam = showControls
    ? ''
    : '&controls=0&rel=0&iv_load_policy=3';

  const embedUrl =
    `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1` +
    `&enablejsapi=1${startParam}${originParam}${controlsParam}`;

  return {
    videoId,
    startTimestampSeconds: startSeconds,
    embedUrl,
  };
}
