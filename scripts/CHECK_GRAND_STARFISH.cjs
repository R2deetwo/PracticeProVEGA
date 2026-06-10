const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://grand-starfish-982.convex.cloud");

async function check() {
    try {
        console.log("Checking grand-starfish-982...");
        const result = await client.query("myFunctions:dumpAll", {});
        console.log("Found Users:", result.users.length);
        console.log("Found Firms:", result.firms.length);
    } catch(e) {
        console.error("ERROR checking grand-starfish-982:", e.message);
    }
}
check();
