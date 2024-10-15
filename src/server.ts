import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { PodcastEnriched } from "./model";
import { closeBrowser, prisma } from "./utils";
import { enrichBatch } from "./enrichment";

export function startServer() {
  const app = express();
  const port = process.env.PORT;

  app.use(bodyParser.json());

  // Endpoint to re-enrich podcasts
  app.post("/re-enrich", async (req: Request, res: Response) => {
    try {
      const { podcasts }: { podcasts: PodcastEnriched[] } = req.body;

      if (!Array.isArray(podcasts) || podcasts.length === 0) {
        return res.status(400).json({
          error:
            "Invalid input. Expected an array of podcasts wrapped in a JSON object.",
        });
      }

      // Extract podcast_index_ids from the received podcasts
      const podcastIndexIds = podcasts
        .map((podcast) => podcast.podcast_index_id)
        .filter((id) => id !== null) as number[];

      // Fetch podcasts from the database using the extracted podcast_index_ids
      const podcastsToEnrich = await prisma.podcast.findMany({
        where: {
          id: {
            in: podcastIndexIds,
          },
          dead: 0,
        },
      });

      if (podcastsToEnrich.length === 0) {
        return res
          .status(404)
          .json({ error: "No matching podcasts found in the database." });
      }

      // Re-enrich the podcasts
      const isAllEnriched = await enrichBatch(podcastsToEnrich, true);

      if (!isAllEnriched) {
        return res
          .status(500)
          .json({ error: "Enrichment process did not finish." });
      }

      await closeBrowser();

      res.json({ success: isAllEnriched });
    } catch (error) {
      console.error("Error in re-enrichment process:", error);
      res
        .status(500)
        .json({ error: "An error occurred during the re-enrichment process." });
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
