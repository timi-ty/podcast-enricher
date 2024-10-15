"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const utils_1 = require("./utils");
const enrichment_1 = require("./enrichment");
function startServer() {
    const app = (0, express_1.default)();
    const port = process.env.PORT;
    app.use(body_parser_1.default.json());
    // Endpoint to re-enrich podcasts
    app.post("/re-enrich", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { podcasts } = req.body;
            if (!Array.isArray(podcasts) || podcasts.length === 0) {
                return res.status(400).json({
                    error: "Invalid input. Expected an array of podcasts wrapped in a JSON object.",
                });
            }
            // Extract podcast_index_ids from the received podcasts
            const podcastIndexIds = podcasts
                .map((podcast) => podcast.podcast_index_id)
                .filter((id) => id !== null);
            // Fetch podcasts from the database using the extracted podcast_index_ids
            const podcastsToEnrich = yield utils_1.prisma.podcast.findMany({
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
            const isAllEnriched = yield (0, enrichment_1.enrichBatch)(podcastsToEnrich, true);
            if (!isAllEnriched) {
                return res
                    .status(500)
                    .json({ error: "Enrichment process did not finish." });
            }
            yield (0, utils_1.closeBrowser)();
            res.json({ success: isAllEnriched });
        }
        catch (error) {
            console.error("Error in re-enrichment process:", error);
            res
                .status(500)
                .json({ error: "An error occurred during the re-enrichment process." });
        }
    }));
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
