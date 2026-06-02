import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://keen-jaguar-204.convex.cloud");

async function run() {
    try {
        const res = await client.query("debug:dataSummary" as any, { "firmId": "any" });
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
