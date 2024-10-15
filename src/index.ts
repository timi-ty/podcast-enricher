import { enrichAll } from "./enrichment";
import { startServer } from "./server";
import { prisma } from "./utils";

startServer();

enrichAll();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
