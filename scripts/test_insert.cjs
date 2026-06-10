const { ConvexHttpClient } = require("convex/browser");

async function run() {
    try {
        const client = new ConvexHttpClient("https://decent-panther-570.convex.cloud");
        console.log("Attempting insert...");
        const id = await client.mutation("myFunctions:createItem", { 
            table: "properties", 
            data: { firmId: "test", contactId: "test", address: "test" } 
        });
        console.log("Success! ID:", id);
    } catch (e) {
        console.error("Error occurred:");
        console.error(e.message);
        console.error(e.data);
    }
}
run();
