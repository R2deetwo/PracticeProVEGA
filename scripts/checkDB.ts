import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://keen-jaguar-204.convex.cloud");

async function check() {
    try {
        console.log("Checking DB...");
        // Since myFunctions:dumpAll exists, I will call it.
        const result = await client.query("myFunctions:dumpAll" as any, {});
        console.log(JSON.stringify(result, null, 2));
    } catch(e) {
        console.error(e);
    }
}
check();
