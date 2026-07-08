import { useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { validateStreamedHtml } from '../utils/validateStreamedHtml';

interface ProgressiveStreamResult {
  isStreaming: boolean;
  error: string | null;
}

const CHECKPOINT_CHUNKS = 8;
const CHECKPOINT_INTERVAL_MS = 400;
const BLOCK_CLOSE_REGEX = /<\/(?:p|div|table|tr|td|ul|ol|li|h[1-6]|blockquote|section|article)>$/i;

/**
 * Progressive streaming hook for DraftPro.
 *
 * Accumulates chunks into a buffer. Every N chunks OR every 400ms (whichever
 * first), checks if the buffer ends at a natural HTML boundary (closing tag
 * of a block element). If yes, validates and renders into the editor using
 * setContent(..., false) to avoid undo-stack pollution.
 *
 * On completion: final validation + setContent with update event for persistence.
 * On failure: falls back to plain-text rendering.
 */
export function useProgressiveStream(
  editor: Editor | null,
  onComplete?: (html: string) => void,
  onError?: (err: string) => void,
): ProgressiveStreamResult & {
  startStream: (streamSource: AsyncIterable<string> | Promise<{ text?: string }>) => Promise<void>;
  stopStream: () => void;
} {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<string>('');
  const chunkCountRef = useRef(0);
  const lastRenderRef = useRef<number>(0);

  const renderCheckpoint = useCallback(() => {
    if (!editor) return;
    const buffer = bufferRef.current;
    if (!buffer.trim()) return;

    // Only render if at a natural boundary
    if (!BLOCK_CLOSE_REGEX.test(buffer.trimEnd())) return;

    const result = validateStreamedHtml(buffer);
    if (result.valid && result.sanitized) {
      // setContent with false = don't emit update event / don't add to undo stack
      editor.commands.setContent(result.sanitized, false);
      lastRenderRef.current = Date.now();
    }
  }, [editor]);

  const startStream = useCallback(async (
    streamSource: AsyncIterable<string> | Promise<{ text?: string }>,
  ) => {
    if (!editor || isStreaming) return;

    setIsStreaming(true);
    setError(null);
    bufferRef.current = '';
    chunkCountRef.current = 0;
    lastRenderRef.current = Date.now();

    const abortController = new AbortController();
    abortRef.current = abortController;

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastRenderRef.current >= CHECKPOINT_INTERVAL_MS) {
        renderCheckpoint();
      }
    }, CHECKPOINT_INTERVAL_MS);

    try {
      // Handle async iterable (streaming fetch reader)
      if (Symbol.asyncIterator in (streamSource as any)) {
        for await (const chunk of streamSource as AsyncIterable<string>) {
          if (abortController.signal.aborted) break;
          bufferRef.current += chunk;
          chunkCountRef.current++;

          if (chunkCountRef.current % CHECKPOINT_CHUNKS === 0) {
            renderCheckpoint();
          }
        }
      } else {
        // Handle promise (non-streaming fallback)
        const result = await streamSource as { text?: string };
        if (result?.text) {
          bufferRef.current = result.text;
        }
      }

      // Final validation
      const finalBuffer = bufferRef.current.trim();
      const finalResult = validateStreamedHtml(finalBuffer);

      if (finalResult.valid && finalResult.sanitized) {
        // Final setContent WITH update event for persistence
        editor.commands.setContent(finalResult.sanitized);
        onComplete?.(finalResult.sanitized);
      } else if (finalBuffer) {
        // Fallback: strip tags, show as plain text
        const plainText = finalBuffer.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
        editor.commands.setContent(`<p style="color:#94a3b8;font-style:italic;">[Formatting error — showing raw text]</p><p>${plainText}</p>`);
        onComplete?.(plainText);
      } else {
        setError('AI returned empty response');
        onError?.('Empty response');
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // Partial content — try to render what we have
        const partial = bufferRef.current.trim();
        if (partial) {
          const partialResult = validateStreamedHtml(partial);
          if (partialResult.valid && partialResult.sanitized) {
            editor.commands.setContent(partialResult.sanitized);
            onComplete?.(partialResult.sanitized);
          }
        }
      } else {
        setError(e.message || 'Streaming failed');
        onError?.(e.message || 'Streaming failed');
      }
    } finally {
      window.clearInterval(intervalId);
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [editor, isStreaming, renderCheckpoint, onComplete, onError]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isStreaming, error, startStream, stopStream };
}
