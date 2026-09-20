/**
 * toastIds — collision-free toast id generation (Task 64).
 *
 * WHY: addToast used `Date.now()` alone. The onboarding congratulations
 * cluster ("Matter created successfully", "✓ … — complete!", offline-sync
 * notices…) can fire several toasts within the SAME millisecond → identical
 * ids → identical React keys in ToastContainer → React reuses one Toast
 * instance for two logical toasts. The reused instance's ToastAutoDismiss
 * controller may have already fired (its `dismissed` flag is one-shot), so
 * dismiss() becomes a silent no-op — the user-reported "toast that refused
 * to close when I clicked X".
 *
 * Fix: a module-level monotonic sequence suffix makes ids unique within any
 * realistic burst (up to 1000 toasts per millisecond).
 */
let __toastIdSeq = 0;

export const nextToastId = (): number =>
  Date.now() * 1000 + (__toastIdSeq = (__toastIdSeq + 1) % 1000);

/** Test hook: reset the sequence (keeps tests independent). */
export const __resetToastIdSeq_forTests = (): void => {
  __toastIdSeq = 0;
};
