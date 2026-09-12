/**
 * Sept 2026 push-fix regression suite.
 *
 * Locks in the corrected FCM dispatch pipeline:
 *   1. Legacy FCM_SERVER_KEY is treated as the dead end it is (Google shut
 *      the legacy API down in June 2024) — loud reason, no silent success.
 *   2. Missing service account surfaces FCM_NOT_CONFIGURED with actionable
 *      guidance (previously this "succeeded" with sent: 0).
 *   3. Malformed service-account JSON fails closed with a clear reason.
 *   4. The v1 message payload is correct: NO clickAction (the old
 *      FCM_PLUGIN_ACTIVITY value made taps do nothing), correct channelId,
 *      string-ified data values (v1 rejects non-string data with 400).
 *   5. Stale tokens (404/UNREGISTERED) are deactivated via internal
 *      mutation so they stop being retried.
 *   6. sendTestPush / sendTestPushToUser return the REAL FCM result
 *      (sent/failed/errors) to the caller instead of a fire-and-forget lie.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";

// A real RSA key so the RS256 JWT signing path in the dispatcher actually
// runs (a fake PEM would throw before fetch is ever reached).
const { privateKey: REAL_RSA_KEY } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const REAL_KEY = REAL_RSA_KEY.export({ type: "pkcs8", format: "pem" }) as string;

// The node file imports "./_generated/server" which is committed — safe to
// import directly in the node test environment. Registered Convex functions
// expose the raw implementation as `._handler` at RUNTIME (it is absent from
// the Registered* TYPE, hence the `as any` casts at the call sites).
import {
  sendFcmPush,
  sendTestPush,
  sendTestPushToUser,
  stringifyData,
} from "../../convex/pushNotificationsNode";

type FetchMock = ReturnType<typeof vi.fn>;

const SERVICE_ACCOUNT = {
  project_id: "practicepro-42178",
  client_email: "firebase-adminsdk-abc@practicepro-42178.iam.gserviceaccount.com",
  private_key: REAL_KEY,
};

function okJson(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** Build a fetch mock that answers the OAuth token endpoint then FCM sends. */
function makeFetchMock(opts: {
  accessToken?: string;
  oauthStatus?: number;
  sendStatus?: number;
  sendBody?: any;
} = {}): FetchMock {
  const accessToken = opts.accessToken ?? "ya29.test-token";
  const oauthStatus = opts.oauthStatus ?? 200;
  const sendStatus = opts.sendStatus ?? 200;
  const sendBody = opts.sendBody ?? { name: "projects/x/messages/1" };
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "https://oauth2.googleapis.com/token") {
      if (oauthStatus !== 200) {
        return okJson({ error: "invalid_grant" }, oauthStatus);
      }
      return okJson({ access_token: accessToken, expires_in: 3600 });
    }
    if (url.startsWith("https://fcm.googleapis.com/v1/")) {
      capturedMessages.push(JSON.parse(String(init?.body)));
      return okJson(sendBody, sendStatus);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

const capturedMessages: any[] = [];

function makeCtx(overrides: Record<string, any> = {}) {
  return {
    runQuery: vi.fn(),
    runMutation: vi.fn(async () => ({ success: true })),
    ...overrides,
  };
}

let ENV_BACKUP: Record<string, string | undefined>;

beforeEach(() => {
  ENV_BACKUP = {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    FCM_SERVER_KEY: process.env.FCM_SERVER_KEY,
  };
  capturedMessages.length = 0;
});

afterEach(() => {
  for (const [k, v] of Object.entries(ENV_BACKUP)) {
    if (v === undefined) delete (process.env as any)[k];
    else (process.env as any)[k] = v;
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("stringifyData", () => {
  it("leaves strings untouched and JSON-stringifies objects", () => {
    expect(stringifyData({ type: "app_update", apkUrl: "https://x/y.apk", n: 3, obj: { a: 1 } })).toEqual({
      type: "app_update",
      apkUrl: "https://x/y.apk",
      n: "3",
      obj: '{"a":1}',
    });
  });

  it("handles null/undefined payloads", () => {
    expect(stringifyData(undefined)).toEqual({});
    expect(stringifyData(null)).toEqual({});
  });
});

describe("sendFcmPush (internal action)", () => {
  it("reports FCM_NOT_CONFIGURED with actionable guidance when no credentials exist", async () => {
    delete (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON;
    delete (process.env as any).FCM_SERVER_KEY;
    const result: any = await (sendFcmPush as any)._handler(makeCtx(), {
      tokens: ["tok-1"],
      title: "T",
      body: "B",
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("FCM_NOT_CONFIGURED");
    expect(result.error).toMatch(/FIREBASE_SERVICE_ACCOUNT_JSON/);
    expect(result.sent).toBe(0);
  });

  it("rejects legacy FCM_SERVER_KEY as the dead mechanism it is", async () => {
    delete (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON;
    (process.env as any).FCM_SERVER_KEY = "legacy-key";
    const result: any = await (sendFcmPush as any)._handler(makeCtx(), {
      tokens: ["tok-1"],
      title: "T",
      body: "B",
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("LEGACY_FCM_REMOVED");
    expect(result.error).toMatch(/June 2024/);
  });

  it("fails closed on malformed service-account JSON", async () => {
    (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON = "not json{";
    delete (process.env as any).FCM_SERVER_KEY;
    const result: any = await (sendFcmPush as any)._handler(makeCtx(), {
      tokens: ["tok-1"],
      title: "T",
      body: "B",
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("INVALID_SERVICE_ACCOUNT");
  });

  it("builds a v1 payload with NO clickAction, the right channel, and string data", async () => {
    (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(SERVICE_ACCOUNT);
    delete (process.env as any).FCM_SERVER_KEY;
    vi.stubGlobal("fetch", makeFetchMock());

    const result: any = await (sendFcmPush as any)._handler(makeCtx(), {
      tokens: ["tok-1"],
      title: "Update ready",
      body: "Tap to download",
      data: { type: "app_update", apkUrl: "https://x.apk" },
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);

    const message = capturedMessages[0]?.message;
    expect(message).toBeTruthy();
    // The old bug: clickAction FCM_PLUGIN_ACTIVITY made taps do nothing.
    expect(message.android?.notification?.clickAction).toBeUndefined();
    expect(message.android?.notification?.channelId).toBe("practicepro-general");
    expect(message.android?.priority).toBe("HIGH");
    expect(message.notification?.title).toBe("Update ready");
    // FCM v1 requires string data values.
    expect(message.data).toEqual({ type: "app_update", apkUrl: "https://x.apk" });
  });

  it("retires stale tokens that FCM reports as UNREGISTERED", async () => {
    (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(SERVICE_ACCOUNT);
    delete (process.env as any).FCM_SERVER_KEY;
    vi.stubGlobal(
      "fetch",
      makeFetchMock({ sendStatus: 404, sendBody: { error: { code: 404, status: "UNREGISTERED" } } })
    );

    const ctx = makeCtx();
    const result: any = await (sendFcmPush as any)._handler(ctx, {
      tokens: ["tok-1", "tok-2"],
      title: "T",
      body: "B",
    });

    expect(result.success).toBe(false);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.deactivated).toBe(2);
    const retired = (ctx.runMutation as FetchMock).mock.calls.map((c: any[]) => c[1]);
    expect(retired).toEqual([{ token: "tok-1" }, { token: "tok-2" }]);
  });
});

describe("sendTestPush (public action, real results)", () => {
  it("returns FCM failure details instead of claiming success", async () => {
    (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(SERVICE_ACCOUNT);
    delete (process.env as any).FCM_SERVER_KEY;
    vi.stubGlobal(
      "fetch",
      makeFetchMock({ sendStatus: 401, sendBody: { error: { code: 401, status: "UNAUTHENTICATED" } } })
    );

    const ctx = makeCtx({
      runQuery: vi.fn(async () => ({
        reason: "OK",
        userId: "founder-1",
        tokens: ["tok-1"],
      })),
    });

    const result: any = await (sendTestPush as any)._handler(ctx, {
      tokenIdentifier: "founder@example.com",
      title: "T",
      body: "B",
    });

    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
    expect(result.errors?.[0]).toMatch(/401/);
    expect(result.totalDevices).toBe(1);
  });

  it("surfaces NO_REGISTERED_DEVICES with the truthful guidance", async () => {
    const ctx = makeCtx({
      runQuery: vi.fn(async () => ({
        reason: "NO_REGISTERED_DEVICES",
        userId: "founder-1",
        tokens: [] as string[],
      })),
    });
    const result: any = await (sendTestPush as any)._handler(ctx, {
      tokenIdentifier: "founder@example.com",
      title: "T",
      body: "B",
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("NO_REGISTERED_DEVICES");
    // The old message told the founder to open the founder APK — which can
    // never register while its Firebase app entry is a cloned app id.
    expect(result.error).toMatch(/MAIN PracticePro app/);
    expect(result.error).toMatch(/com\.practicepro\.admin/);
  });

  it("writes the in-app notification before dispatching", async () => {
    (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(SERVICE_ACCOUNT);
    delete (process.env as any).FCM_SERVER_KEY;
    vi.stubGlobal("fetch", makeFetchMock());

    const ctx = makeCtx({
      runQuery: vi.fn(async () => ({
        reason: "OK",
        userId: "founder-1",
        tokens: ["tok-1"],
      })),
    });

    const result: any = await (sendTestPush as any)._handler(ctx, {
      tokenIdentifier: "founder@example.com",
      title: "Hello",
      body: "World",
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "founder-1", title: "Hello", body: "World", type: "system" })
    );
  });
});

describe("sendTestPushToUser (public action)", () => {
  it("reports FCM_NOT_CONFIGURED to the end user (previously silent)", async () => {
    delete (process.env as any).FIREBASE_SERVICE_ACCOUNT_JSON;
    delete (process.env as any).FCM_SERVER_KEY;

    const ctx = makeCtx({
      runQuery: vi.fn(async () => ({
        reason: "OK",
        userId: "user-1",
        tokens: ["tok-1"],
      })),
    });

    const result: any = await (sendTestPushToUser as any)._handler(ctx, { userEmail: "u@example.com" });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("FCM_NOT_CONFIGURED");
  });

  it("rejects callers that are not the target user", async () => {
    const ctx = makeCtx({
      runQuery: vi.fn(async () => ({ reason: "UNAUTHORIZED" })),
    });
    const result: any = await (sendTestPushToUser as any)._handler(ctx, { userEmail: "victim@example.com" });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("UNAUTHORIZED");
  });
});
