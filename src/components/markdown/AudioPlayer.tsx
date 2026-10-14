/**
 * AudioPlayer — main container component for the custom Meting audio player.
 *
 * Rendered via portal from ContentEnhancer. Resolves music URLs through the
 * Meting API at runtime, builds a grouped playlist, and renders the player UI.
 */

import { useAudioPlayer } from '@hooks/useAudioPlayer';
import { useElementVisibility } from '@hooks/useElementVisibility';
import { useTranslation } from '@hooks/useTranslation';
import type { MetingSong } from '@lib/meting';
import { parseMusicUrl, resolvePlaylist } from '@lib/meting';
import { fetchQqLyric, fetchQqPlaylist, isQqPlaylistUrl, qqLazySongMid } from '@lib/qq-music';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PlayerPlaylist } from './audio-player/PlayerPlaylist';
import { PlayerPreview } from './audio-player/PlayerPreview';
import { MediaControls } from './shared/MediaControls';

interface AudioGroup {
  title?: string;
  list: string[];
}

interface PlaylistGroup {
  title?: string;
  startIndex: number;
  count: number;
}

interface AudioPlayerProps {
  element: HTMLElement;
}

/**
 * Resolve one group into tracks, in the order the URLs were written.
 *
 * QQ Music playlist links are resolved through QQ Music's own endpoints rather
 * than the Meting API, because every public Meting instance returns an empty
 * stream for `server=tencent`.
 */
async function resolveGroupSongs(group: AudioGroup, apiUrl: string | undefined): Promise<MetingSong[]> {
  const parts = await Promise.all(
    group.list.map(async (url) => {
      if (isQqPlaylistUrl(url)) {
        const parsed = parseMusicUrl(url);
        return parsed ? fetchQqPlaylist(parsed.id) : [];
      }
      return resolvePlaylist([url], apiUrl);
    }),
  );

  return parts.flat();
}

async function resolveGroupsSequentially(
  groups: AudioGroup[],
  apiUrl: string | undefined,
  index = 0,
  resolved: MetingSong[][] = [],
): Promise<MetingSong[][]> {
  if (index >= groups.length) return resolved;

  const songs = await resolveGroupSongs(groups[index], apiUrl);
  return resolveGroupsSequentially(groups, apiUrl, index + 1, [...resolved, songs]);
}

export function AudioPlayer({ element }: AudioPlayerProps) {
  const { t } = useTranslation();
  const isVisible = useElementVisibility(element);
  const dataSrc = element.dataset.src || '[]';
  const apiUrl = element.dataset.api;

  const audioGroups: AudioGroup[] = useMemo(() => {
    try {
      return JSON.parse(dataSrc);
    } catch {
      return [];
    }
  }, [dataSrc]);

  const [tracks, setTracks] = useState<MetingSong[]>([]);
  const [groups, setGroups] = useState<PlaylistGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  /** Index currently resolving its stream (QQ tracks resolve on demand). */
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  /** Mirror of `tracks` for the player, which updates tracks outside React state. */
  const tracksRef = useRef<MetingSong[]>([]);

  const handleTracksResolved = useCallback((next: MetingSong[]) => {
    tracksRef.current = next;
    setTracks(next);
  }, []);

  // Resolve all URLs via Meting API
  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount is an intentional trigger to re-run the effect
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setError(null);

      try {
        // Resolve groups sequentially to provide backpressure and avoid triggering Meting API rate limits.
        const songsByGroup = await resolveGroupsSequentially(audioGroups, apiUrl);
        const allTracks = songsByGroup.flat();
        let startIndex = 0;
        const resolvedGroups = audioGroups.map((group, index) => {
          const songs = songsByGroup[index];
          const resolvedGroup = {
            title: group.title,
            startIndex,
            count: songs.length,
          };
          startIndex += songs.length;
          return resolvedGroup;
        });

        if (!cancelled) {
          setTracks(allTracks);
          setGroups(resolvedGroups);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load playlist');
          setLoading(false);
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [audioGroups, apiUrl, retryCount, isVisible]);

  const player = useAudioPlayer(tracks, handleTracksResolved);
  const currentTrack = tracks[player.state.currentIndex] ?? null;
  const playerRef = useRef(player);
  playerRef.current = player;
  tracksRef.current = tracks;

  /**
   * QQ Music streams are fetched when a track is played, not upfront: the list
   * load stays a single request, and no `vkey` is left to expire unused. The
   * player handles the stream itself (click *and* auto-advance); this fills in
   * the lyrics for the preview.
   */
  const handleTrackSelect = useCallback(
    async (index: number) => {
      const track = tracksRef.current[index];
      if (!track) return;

      if (track.vip) {
        toast(t('audio.vipUnavailable'), {
          description: track.name,
          action: track.sourceUrl
            ? { label: t('audio.openInQq'), onClick: () => window.open(track.sourceUrl, '_blank', 'noopener,noreferrer') }
            : undefined,
        });
        return;
      }

      const songMid = qqLazySongMid(track.url);
      if (!songMid) {
        playerRef.current.play(index);
        return;
      }

      setPendingIndex(index);
      try {
        const lrc = await fetchQqLyric(songMid);
        if (lrc) {
          const nextTracks = tracksRef.current.map((item, i) => (i === index ? { ...item, lrc } : item));
          tracksRef.current = nextTracks;
          setTracks(nextTracks);
        }
      } catch {
        // Lyrics are optional — playback still proceeds without them.
      } finally {
        setPendingIndex(null);
      }

      playerRef.current.play(index);
    },
    [t],
  );

  if (loading) {
    return (
      <div className="audio-player audio-player-loading">
        <div className="audio-player-spinner" />
        <span>{t('audio.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="audio-player audio-player-error">
        <span>{t('audio.loadError', { error })}</span>
        <button type="button" className="audio-player-btn" onClick={() => setRetryCount((c) => c + 1)}>
          {t('audio.retry')}
        </button>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="audio-player audio-player-empty">
        <span>{t('audio.empty')}</span>
      </div>
    );
  }

  return (
    <div className="audio-player not-prose">
      <PlayerPreview track={currentTrack} playing={player.state.playing} timeStore={player.timeStore} />
      <MediaControls
        playing={player.state.playing}
        loading={player.state.loading}
        mode={player.state.mode}
        volume={player.state.volume}
        muted={player.state.muted}
        timeStore={player.timeStore}
        onTogglePlay={player.togglePlay}
        onPrev={player.prevTrack}
        onNext={player.nextTrack}
        onSeek={player.seek}
        onSetMode={player.setMode}
        onSetVolume={player.setVolume}
        onToggleMute={player.toggleMute}
      />
      <PlayerPlaylist
        tracks={tracks}
        groups={groups}
        currentIndex={player.state.currentIndex}
        timeStore={player.timeStore}
        activeTab={activeTab}
        pendingIndex={pendingIndex}
        onTabChange={setActiveTab}
        onTrackSelect={handleTrackSelect}
        onSeek={player.seek}
      />
    </div>
  );
}
