import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://keen-jaguar-204.convex.cloud");

async function check() {
    try {
        const user = await client.query("myFunctions:getUser" as any, { tokenIdentifier: "prototypechigo@gmail.com" });
        console.log(JSON.stringify(user, null, 2));
    } catch(e) {
        console.error(e);
    }
}
check();
