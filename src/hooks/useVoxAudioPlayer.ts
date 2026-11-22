/**
 * useVoxAudioPlayer — playback for a session's archived audio segments.
 *
 * The session's audio is stored as ≤60 s WAV segments; this hook stitches
 * them into one continuous timeline: positionMs maps to (segment index,
 * local offset), the segment URL is fetched on demand (getSegmentAudioUrl)
 * and cached, and the clock advances across segment boundaries
 * automatically. Speed control (1x/1.25x/1.5x/2x) rides HTMLAudioElement
 * playbackRate; seeking sets the nearest segment + offset.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoxSegmentAudioUrl } from "../services/voice/voxSessionService";

export interface AudioWindow {
  startMs: number;
  endMs: number;
}

const SPEEDS = [1, 1.25, 1.5, 2] as const;

export function useVoxAudioPlayer(
  clientLocalId: string | null,
  windows: AudioWindow[],
  opts?: { onError?: (msg: string) => void }
) {
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSegRef = useRef<number>(-1);
  const windowsRef = useRef<AudioWindow[]>(windows);
  const rateRef = useRef(rate);
  const idRef = useRef(clientLocalId);
  const onErrorRef = useRef(opts?.onError);
  const urlCache = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    onErrorRef.current = opts?.onError;
  }, [opts?.onError]);

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);
  useEffect(() => {
    rateRef.current = rate;
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);
  useEffect(() => {
    idRef.current = clientLocalId;
    urlCache.current.clear();
  }, [clientLocalId]);

  const totalMs = windows.length > 0 ? Math.max(...windows.map((w) => w.endMs)) : 0;

  /** Which segment index covers a position (-1 when out of range). */
  const segmentAt = useCallback((ms: number): number => {
    const list = windowsRef.current;
    for (let i = 0; i < list.length; i++) {
      if (ms >= list[i].startMs && ms < list[i].endMs) return i;
    }
    return ms >= (list.length ? list[list.length - 1].endMs : 0) ? list.length - 1 : -1;
  }, []);

  const teardownAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    activeSegRef.current = -1;
  }, []);

  /** Load + play the segment covering `ms`. */
  const playAt = useCallback(
    async (ms: number) => {
      const id = idRef.current;
      const segIndex = segmentAt(ms);
      if (!id || segIndex < 0) return;
      const list = windowsRef.current;
      const localOffsetSec = (ms - list[segIndex].startMs) / 1000;
      setLoading(true);
      try {
        let url = urlCache.current.get(segIndex);
        if (!url) {
          url = (await getVoxSegmentAudioUrl(id, segIndex)) || "";
          if (url) urlCache.current.set(segIndex, url);
        }
        if (!url) {
          onErrorRef.current?.("The audio for that part is no longer stored.");
          setLoading(false);
          return;
        }
        const sameSeg = activeSegRef.current === segIndex && audioRef.current;
        if (!sameSeg) {
          teardownAudio();
          const audio = new Audio(url);
          audio.preload = "auto";
          audioRef.current = audio;
          activeSegRef.current = segIndex;
          audio.addEventListener("ended", () => {
            // Cross the boundary into the next segment automatically.
            const next = segIndex + 1;
            const w = windowsRef.current;
            if (next < w.length) {
              void playAt(w[next].startMs);
            } else {
              setPlaying(false);
              setEnded(true);
            }
          });
          audio.addEventListener("timeupdate", () => {
            const a = audioRef.current;
            if (!a) return;
            const w = windowsRef.current[activeSegRef.current];
            if (!w) return;
            setPositionMs(Math.round(w.startMs + a.currentTime * 1000));
          });
        }
        const audio = audioRef.current!;
        audio.playbackRate = rateRef.current;
        audio.currentTime = Math.max(0, localOffsetSec);
        await audio.play();
        setPlaying(true);
        setEnded(false);
      } catch {
        setPlaying(false);
      } finally {
        setLoading(false);
      }
    },
    [segmentAt, teardownAudio]
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (playing && audio) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (ended) {
      setPositionMs(0);
      void playAt(0);
      return;
    }
    void playAt(positionMs);
  }, [playing, ended, positionMs, playAt]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, totalMs));
      setPositionMs(clamped);
      if (playing) {
        void playAt(clamped);
      } else {
        // Preload the target segment so the next play starts instantly.
        teardownAudio();
        setEnded(false);
      }
    },
    [playing, playAt, teardownAudio, totalMs]
  );

  const stop = useCallback(() => {
    teardownAudio();
    setPlaying(false);
    setPositionMs(0);
    setEnded(false);
  }, [teardownAudio]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  return {
    playing,
    loading,
    positionMs,
    totalMs,
    rate,
    speeds: SPEEDS,
    setRate,
    toggle,
    seek,
    stop,
    hasAudio: windows.length > 0,
  };
}
