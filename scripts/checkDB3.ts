import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://keen-jaguar-204.convex.cloud");

async function check() {
    try {
        console.log("Checking DB user passwords (securely debugged locally)...");
        // I will write a custom action using the cli, but I don't have access to convex dashboard.
        // Wait! I can't just fetch arbitrary fields unless the query returns them.
        // The `myFunctions:dumpAll` query only returns exactly: { id: u._id, email: u.tokenIdentifier, firmId: u.firmId }
        // BUT `myFunctions:getUser` returns the WHOLE user object, including `password`!
        
        const emails = [
            'prototypechigo@gmail.com',
            'Tosfash@gmail.com',
            'legalpromise@gmail.com',
            'averyandjarvis@gmail.com'
        ];
        
        for (const email of emails) {
            const user = await client.query("myFunctions:getUser" as any, { tokenIdentifier: email });
            if (user) {
                console.log(`User ${email}: has password field? ${user.password !== undefined}, value: ${user.password ? '***' : 'NONE'}`);
            } else {
                console.log(`User ${email} not found via getUser`);
            }
        }
    } catch(e) {
        console.error(e);
    }
}
check();
