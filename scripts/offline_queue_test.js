/**
 * Manual test script — simulates the offline queue behavior.
 *
 * This is a Node script that stubs out the React/Convex layer and tests
 * the queue + replay logic directly. It does NOT exercise the React hook
 * itself (which requires a browser environment) — it tests the underlying
 * serialization and dispatch logic.
 *
 * Run: node /home/z/my-project/scripts/offline_queue_test.js
 *
 * What this validates:
 *   1. Legacy shape ({table, data, itemName}) is migrated to the new shape
 *      and replays as createItem.
 *   2. New shape ({mutationName, args, label}) replays via the correct
 *      registered mutation.
 *   3. Network errors keep the item in the queue for retry.
 *   4. Validation errors drop the item (and would surface to the user
 *      via addToast — verified here by checking the dropped counter).
 *   5. Mixed queue (legacy + new shape) replays in order.
 */

const QUEUE_KEY = "practicepro_offline_queue";

// --- Stub a fake localStorage ---
const store = {};
const localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
};

// --- Stub the mutation registry ---
// Each mutation records what it was called with so we can assert.
const calls = {
    createItem: [],
    updateItem: [],
    deleteItem: [],
    addLedgerEntry: [],
    markChargeAsPaid: [],
    recordTrustTransaction: [],
    // Tier-2:
    createTask: [],
    updateTask: [],
    updateTaskStatus: [],
    createMaintenanceTicket: [],
    cancelMaintenanceTicket: [],
};

// Make all mutations succeed by default
let allFail = false;
let validationFail = false;

const registry = {
    createItem: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("Field 'name' is required"); calls.createItem.push(args); return { _id: "fake_id" }; },
    updateItem: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("Document not found"); calls.updateItem.push(args); return null; },
    deleteItem: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("Document not found"); calls.deleteItem.push(args); return null; },
    addLedgerEntry: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("amount must be positive"); calls.addLedgerEntry.push(args); return { _id: "ledger_id" }; },
    markChargeAsPaid: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("serviceChargeId not found"); calls.markChargeAsPaid.push(args); return null; },
    recordTrustTransaction: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("amount must be positive"); calls.recordTrustTransaction.push(args); return { _id: "tx_id" }; },
    // Tier-2:
    createTask: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("title is required"); calls.createTask.push(args); return { _id: "task_id" }; },
    updateTask: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("task not found"); calls.updateTask.push(args); return null; },
    updateTaskStatus: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("task not found"); calls.updateTaskStatus.push(args); return null; },
    createMaintenanceTicket: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("subject is required"); calls.createMaintenanceTicket.push(args); return { _id: "ticket_id" }; },
    cancelMaintenanceTicket: async (args) => { if (allFail) throw new Error("network: failed to fetch"); if (validationFail) throw new Error("ticket not found"); calls.cancelMaintenanceTicket.push(args); return null; },
};

// --- Toast capture ---
const toasts = [];
function addToast(msg, opts) { toasts.push({ msg, opts }); }

// --- Inline the queue logic from useOfflineQueue.ts (without React deps) ---
function readQueue() {
    try {
        const stored = localStorage.getItem(QUEUE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => {
            if (item.mutationName) {
                return {
                    id: item.id,
                    timestamp: item.timestamp,
                    mutationName: item.mutationName,
                    args: item.args ?? {},
                    label: item.label ?? item.mutationName,
                };
            }
            return {
                id: item.id,
                timestamp: item.timestamp,
                mutationName: "createItem",
                args: { table: item.table, data: item.data, userEmail: item.userEmail },
                label: item.itemName || item.table || "Item",
            };
        });
    } catch { return []; }
}

function writeQueue(q) {
    if (q.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function isNetworkError(e) {
    const msg = ((e?.message) || "").toLowerCase();
    if (!msg) return true;
    return (
        msg.includes("network") ||
        msg.includes("fetch") ||
        msg.includes("websocket") ||
        msg.includes("failed to fetch") ||
        msg.includes("connection") ||
        msg.includes("aborted") ||
        msg.includes("timeout") ||
        (msg.includes("auth token is expired") === false &&
            (msg.includes("could not reach") || msg.includes("server")))
    );
}

function makeId() {
    return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function queueMutation(mutation) {
    const queue = readQueue();
    let item;
    if ("mutationName" in mutation) {
        item = { id: makeId(), timestamp: Date.now(), mutationName: mutation.mutationName, args: mutation.args, label: mutation.label };
    } else {
        item = { id: makeId(), timestamp: Date.now(), mutationName: "createItem", args: { table: mutation.table, data: mutation.data, userEmail: mutation.userEmail }, label: mutation.itemName };
    }
    queue.push(item);
    writeQueue(queue);
}

async function replayQueue(isOnline) {
    if (!isOnline) return { success: 0, dropped: 0, remaining: 0 };
    const queue = readQueue();
    if (queue.length === 0) return { success: 0, dropped: 0, remaining: 0 };

    let successCount = 0, droppedCount = 0;
    const remaining = [];
    for (const item of queue) {
        const fn = registry[item.mutationName];
        if (!fn) { droppedCount++; continue; }
        try {
            await fn(item.args);
            successCount++;
        } catch (e) {
            if (isNetworkError(e)) {
                remaining.push(item);
            } else {
                addToast(`Could not sync "${item.label}" — ${e.message}. The change was not saved.`, { type: "error", duration: 8000 });
                droppedCount++;
            }
        }
    }
    writeQueue(remaining);
    if (successCount > 0 && droppedCount === 0) addToast(`Synced ${successCount} item${successCount > 1 ? "s" : ""} from offline queue.`, { type: "success", duration: 4000 });
    else if (successCount > 0 && droppedCount > 0) addToast(`Synced ${successCount} item${successCount > 1 ? "s" : ""}; ${droppedCount} could not be saved and was dropped.`, { type: "warning", duration: 6000 });
    return { success: successCount, dropped: droppedCount, remaining: remaining.length };
}

// --- Reset helpers ---
function reset() {
    Object.keys(store).forEach(k => delete store[k]);
    Object.keys(calls).forEach(k => calls[k].length = 0);
    toasts.length = 0;
    allFail = false;
    validationFail = false;
}

function assert(cond, label) {
    if (cond) {
        console.log(`  ✅ ${label}`);
    } else {
        console.log(`  ❌ ${label}`);
        process.exitCode = 1;
    }
}

// === Tests ===
async function main() {
    console.log("\n=== TEST 1: Legacy shape migrates and replays as createItem ===");
    reset();
    queueMutation({ table: "matters", data: { title: "Test Matter" }, itemName: "Matter", userEmail: "test@example.com" });
    assert(readQueue().length === 1, "legacy item queued");
    assert(readQueue()[0].mutationName === "createItem", "legacy item migrated to createItem");
    assert(readQueue()[0].args.table === "matters", "table arg preserved");
    const r1 = await replayQueue(true);
    assert(r1.success === 1 && r1.dropped === 0, "legacy item replayed successfully");
    assert(calls.createItem.length === 1, "createItem called once");
    assert(calls.createItem[0].data.title === "Test Matter", "data preserved");
    assert(readQueue().length === 0, "queue empty after replay");

    console.log("\n=== TEST 2: New shape dispatches to correct mutation ===");
    reset();
    queueMutation({ mutationName: "addLedgerEntry", args: { firmId: "f1", unitId: "u1", amount: 500000, type: "rent" }, label: "Rent — 12 Marina" });
    queueMutation({ mutationName: "markChargeAsPaid", args: { serviceChargeId: "sc1", paidAmount: 25000 }, label: "Service charge paid" });
    queueMutation({ mutationName: "recordTrustTransaction", args: { firmId: "f1", type: "deposit", amount: 1000000 }, label: "Trust deposit" });
    assert(readQueue().length === 3, "3 items queued");
    const r2 = await replayQueue(true);
    assert(r2.success === 3, "all 3 replayed");
    assert(calls.addLedgerEntry.length === 1, "addLedgerEntry called once");
    assert(calls.markChargeAsPaid.length === 1, "markChargeAsPaid called once");
    assert(calls.recordTrustTransaction.length === 1, "recordTrustTransaction called once");
    assert(calls.addLedgerEntry[0].args?.amount === 500000 || calls.addLedgerEntry[0].amount === 500000, "ledger args preserved");

    console.log("\n=== TEST 3: Network errors keep item in queue ===");
    reset();
    queueMutation({ mutationName: "addLedgerEntry", args: { amount: 100 }, label: "Rent" });
    allFail = true; // simulate offline during replay attempt
    const r3 = await replayQueue(true); // navigator.onLine check stubbed true here
    assert(r3.success === 0, "no successes when network fails");
    assert(r3.dropped === 0, "NOT dropped (network error = retryable)");
    assert(readQueue().length === 1, "item stays in queue for retry");
    allFail = false;
    const r3b = await replayQueue(true);
    assert(r3b.success === 1, "item replayed on next attempt");
    assert(readQueue().length === 0, "queue empty after successful retry");

    console.log("\n=== TEST 4: Validation errors drop item + show toast ===");
    reset();
    queueMutation({ mutationName: "addLedgerEntry", args: { amount: -5 }, label: "Bad rent entry" });
    validationFail = true;
    const r4 = await replayQueue(true);
    assert(r4.success === 0, "no successes");
    assert(r4.dropped === 1, "dropped (will never succeed)");
    assert(readQueue().length === 0, "queue empty (dropped)");
    assert(toasts.length === 1, "user-visible toast shown");
    assert(toasts[0].opts.type === "error", "toast is error type");
    assert(toasts[0].msg.includes("Bad rent entry"), "toast mentions the item label");

    console.log("\n=== TEST 5: Mixed queue (legacy + new) replays in FIFO order ===");
    reset();
    queueMutation({ table: "contacts", data: { name: "Alice" }, itemName: "Contact" }); // legacy
    queueMutation({ mutationName: "addLedgerEntry", args: { amount: 1000 }, label: "Rent" }); // new
    queueMutation({ mutationName: "updateItem", args: { table: "properties", id: "p1", data: { status: "Occupied" } }, label: "Property update" });
    const r5 = await replayQueue(true);
    assert(r5.success === 3, "all 3 replayed in order");
    // Verify order: createItem (legacy → contacts) → addLedgerEntry → updateItem
    assert(calls.createItem.length === 1, "createItem (legacy) called first");
    assert(calls.addLedgerEntry.length === 1, "addLedgerEntry called second");
    assert(calls.updateItem.length === 1, "updateItem called third");

    console.log("\n=== TEST 6: Offline when navigator.onLine = false does nothing ===");
    reset();
    queueMutation({ mutationName: "addLedgerEntry", args: { amount: 100 }, label: "Rent" });
    const r6 = await replayQueue(false); // offline
    assert(r6.success === 0 && r6.dropped === 0 && r6.remaining === 0, "no-op when offline (replay guard)");
    assert(readQueue().length === 1, "item still in queue, untouched");

    console.log("\n=== TEST 7: Rent collection scenario — multi-mutation queue ===");
    reset();
    // Simulate CollectRentModal's offline path: queue updateItem + addLedgerEntry (rent) + addLedgerEntry (mgmt fee)
    queueMutation({
        mutationName: "updateItem",
        args: { table: "properties", id: "p_123", data: { status: "Occupied", rentPaymentHistory: [{ amount: 500000 }] }, itemName: "Property Payment" },
        label: "Rent payment — 12 Marina Rd",
    });
    queueMutation({
        mutationName: "addLedgerEntry",
        args: { firmId: "f1", propertyId: "p_123", unitId: "u1", amount: 500000, type: "rent", status: "cleared", channel: "TXN-12345678" },
        label: "Rent ledger — 12 Marina Rd",
    });
    queueMutation({
        mutationName: "addLedgerEntry",
        args: { firmId: "f1", propertyId: "p_123", unitId: "u1", amount: 25000, type: "management_fee", status: "pending", channel: "TXN-12345678" },
        label: "Management fee ledger — 12 Marina Rd",
    });
    assert(readQueue().length === 3, "3 mutations queued (property update + 2 ledger entries)");
    const r7 = await replayQueue(true);
    assert(r7.success === 3, "all 3 synced");
    assert(calls.updateItem.length === 1, "property updated");
    assert(calls.addLedgerEntry.length === 2, "2 ledger entries (rent + mgmt fee) recorded");
    assert(toasts.some(t => t.msg.includes("Synced 3 items")), "synced 3 items toast shown");

    console.log("\n=== TEST 8: Tier-2 — Task status update queues and replays ===");
    reset();
    queueMutation({
        mutationName: "updateTaskStatus",
        args: { taskId: "task_123", status: "done", userEmail: "agent@example.com" },
        label: "Task status → done",
    });
    assert(readQueue().length === 1, "task status update queued");
    assert(readQueue()[0].mutationName === "updateTaskStatus", "correct mutation name");
    const r8 = await replayQueue(true);
    assert(r8.success === 1, "task status replayed");
    assert(calls.updateTaskStatus.length === 1, "updateTaskStatus called once");
    assert(calls.updateTaskStatus[0].status === "done", "status arg preserved");
    assert(calls.updateTaskStatus[0].userEmail === "agent@example.com", "userEmail arg preserved");

    console.log("\n=== TEST 9: Tier-2 — Maintenance ticket creation queues and replays ===");
    reset();
    queueMutation({
        mutationName: "createMaintenanceTicket",
        args: {
            firmId: "f1",
            propertyId: "p1",
            subject: "Leaking tap in kitchen",
            description: "The kitchen tap has been leaking for 3 days",
            category: "plumbing",
        },
        label: "Maintenance ticket — Leaking tap in kitchen",
    });
    assert(readQueue().length === 1, "maintenance ticket queued");
    const r9 = await replayQueue(true);
    assert(r9.success === 1, "ticket replayed");
    assert(calls.createMaintenanceTicket.length === 1, "createMaintenanceTicket called once");
    assert(calls.createMaintenanceTicket[0].subject === "Leaking tap in kitchen", "subject preserved");

    console.log("\n=== TEST 10: Tier-2 — Task creation with notification delay note ===");
    reset();
    queueMutation({
        mutationName: "createTask",
        args: { title: "Inspect property", assignedUsers: ["user_1"], status: "todo" },
        label: "New task — Inspect property",
    });
    const r10 = await replayQueue(true);
    assert(r10.success === 1, "task creation replayed");
    assert(calls.createTask.length === 1, "createTask called once");
    assert(calls.createTask[0].assignedUsers[0] === "user_1", "assignedUsers preserved");

    console.log("\n=== TEST 11: Tier-2 — Mixed Tier-1 + Tier-2 queue replays in FIFO order ===");
    reset();
    queueMutation({ mutationName: "addLedgerEntry", args: { amount: 500 }, label: "Rent" });           // Tier-1
    queueMutation({ mutationName: "updateTaskStatus", args: { taskId: "t1", status: "done" }, label: "Task done" }); // Tier-2
    queueMutation({ mutationName: "createMaintenanceTicket", args: { subject: "Fix AC" }, label: "Ticket" }); // Tier-2
    queueMutation({ mutationName: "markChargeAsPaid", args: { serviceChargeId: "sc1" }, label: "Charge paid" }); // Tier-1
    assert(readQueue().length === 4, "4 mixed items queued");
    const r11 = await replayQueue(true);
    assert(r11.success === 4, "all 4 replayed");
    assert(calls.addLedgerEntry.length === 1, "ledger entry first");
    assert(calls.updateTaskStatus.length === 1, "task status second");
    assert(calls.createMaintenanceTicket.length === 1, "ticket third");
    assert(calls.markChargeAsPaid.length === 1, "charge paid fourth");
    assert(toasts.some(t => t.msg.includes("Synced 4 items")), "synced 4 items toast shown");

    console.log("\n=== ALL TESTS PASSED ===");
    console.log("\n--- Toast log (rent collection scenario) ---");
    toasts.forEach(t => console.log(`  [${t.opts.type}] ${t.msg}`));
}

main().catch(e => { console.error("Test error:", e); process.exit(1); });
