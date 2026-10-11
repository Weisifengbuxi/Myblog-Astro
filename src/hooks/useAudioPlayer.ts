/**
 * React hook for HTML5 Audio playback.
 *
 * Creates a persistent Audio element internally and delegates
 * all playback logic to the shared useMediaPlayer hook.
 */

import type { MetingSong } from '@lib/meting';
import { isQqLazyUrl, qqLazySongMid, resolveQqStream } from '@lib/qq-music';
import { useCallback, useEffect, useRef } from 'react';
import { getStoredVolume } from '../store/player';
import { useMediaPlayer } from './useMediaPlayer';

function getTrackUrl(track: MetingSong): string {
  // A lazy placeholder is not playable; `resolveUrl` supplies the real stream.
  return isQqLazyUrl(track.url) ? '' : track.url;
}

export function useAudioPlayer(tracks: MetingSong[], onTracksResolved?: (tracks: MetingSong[]) => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = getStoredVolume();
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const getElement = useCallback(() => audioRef.current, []);

  /**
   * Fetch the signed stream URL for a QQ Music track at play time.
   *
   * The URL embeds a `vkey` that expires, so holding one per track for a whole
   * playlist would leave most of them stale by the time they are played.
   * Returning `null` keeps the player's error state for genuinely unplayable
   * tracks (paid tracks never reach here — they are flagged `vip`).
   */
  const resolveUrl = useCallback(async (track: MetingSong): Promise<{ url: string; track: MetingSong } | null> => {
    const songMid = qqLazySongMid(track.url);
    if (!songMid) return null;

    const stream = await resolveQqStream(songMid);
    if (!stream) return null;

    return { url: stream, track: { ...track, url: stream } };
  }, []);

  return useMediaPlayer({
    tracks,
    getUrl: getTrackUrl,
    getElement,
    resolveUrl,
    onTracksResolved,
  });
}
