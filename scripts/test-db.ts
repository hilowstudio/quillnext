
export {}; // mark as an ES module (enables top-level await below)

// Trace loading
console.log("Loading db...");
console.log("ENGINE TYPE:", process.env.PRISMA_CLIENT_ENGINE_TYPE);
console.log("VERCEL:", process.env.VERCEL);
console.log("NODE_ENV:", process.env.NODE_ENV);
const { db } = await import("../src/server/db");
console.log("DB Loaded.", db);

async function main() {
    console.log("Connecting...");
    await db.$connect();
    console.log("Connected.");
    const user = await db.user.findFirst();
    console.log("User:", user);
    await db.$disconnect();
}

main().catch(e => {
    console.error("CRASH:", e);
    process.exit(1);
});
