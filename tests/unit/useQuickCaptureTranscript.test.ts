// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventListener: null as null | ((event: {
    type: string;
    clientLocalId?: string;
    verbatimSoFar?: string;
  }) => void),
}));

vi.mock("../../src/services/voice/audioQueue", () => ({
  voiceSync: {
    start: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((listener: typeof mocks.eventListener) => {
      mocks.eventListener = listener;
      return () => {
        mocks.eventListener = null;
      };
    }),
    getStats: vi.fn().mockRejectedValue(new Error("queue stats are not part of this test")),
    ensureCapture: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/services/voice/audioRecorder", () => ({
  recorderSupported: () => true,
  VoiceRecorder: class {
    start = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
    isActive = () => false;
    getSegmentCount = () => 0;
  },
}));

vi.mock("../../src/services/voice/voiceCaptureService", () => ({
  getCaptureByLocalId: vi.fn().mockResolvedValue(null),
}));

import { useQuickCapture } from "../../src/hooks/useQuickCapture";

describe("useQuickCapture live transcript", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    mocks.eventListener = null;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("exposes transcribed segments only for the active capture", async () => {
    let capture: ReturnType<typeof useQuickCapture> | undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const Harness = () => {
      capture = useQuickCapture({ outputMode: "verbatim" });
      return null;
    };

    act(() => root?.render(React.createElement(Harness)));
    await act(async () => {
      await capture?.startRecording();
    });

    const activeId = capture?.clientLocalId;
    expect(activeId).toBeTruthy();
    expect(mocks.eventListener).toBeTypeOf("function");

    act(() => {
      mocks.eventListener?.({
        type: "segment-uploaded",
        clientLocalId: "another-capture",
        verbatimSoFar: "Unrelated transcript",
      });
    });
    expect(capture?.transcriptSoFar).toBe("");

    act(() => {
      mocks.eventListener?.({
        type: "segment-uploaded",
        clientLocalId: activeId || undefined,
        verbatimSoFar: "Court was called",
      });
    });
    expect(capture?.transcriptSoFar).toBe("Court was called");
  });
});
