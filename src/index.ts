import {
  cleanupDatabase,
  downloadAndExtractDatabase,
  isPodcastDbOldOrMissing,
} from "./api.podcastindex";
import { enrichAll } from "./enrichment";
import { startServer } from "./server";
import { prisma } from "./utils";

async function main() {
  try {
    if (isPodcastDbOldOrMissing()) {
      await downloadAndExtractDatabase();
      await cleanupDatabase();
    }
    startServer();
    enrichAll();
  } catch (e) {
    console.error(`Error starting up enricher: ${e}`);
  }
}

main();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
