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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const utils_1 = require("./utils");
const api_spotify_1 = require("./api.spotify");
const api_youtube_1 = require("./api.youtube");
const client_1 = require("@prisma/client");
const api_podcastindex_1 = require("./api.podcastindex");
const model_1 = require("./model");
dotenv_1.default.config();
const backendUrl = (_a = process.env.BACKEND_URL) !== null && _a !== void 0 ? _a : "";
const prisma = new client_1.PrismaClient();
function enrichBatch(podcasts) {
    return __awaiter(this, void 0, void 0, function* () {
        const promises = [];
        let res = yield fetch(`${backendUrl}/enriched`, {
            method: "POST",
            body: JSON.stringify({ items: podcasts.map((podcast) => podcast.id) }),
            headers: [["Content-Type", "application/json"]],
        });
        const enrichedPodcasts = yield res.json();
        const unseenPodcasts = podcasts.filter((podcast) => !enrichedPodcasts.items.includes(podcast.id));
        console.log(`Found ${unseenPodcasts.length} unseen podcasts in this batch. Only unseen podcasts will be enriched.`);
        const payload = { items: [] };
        for (let i = 0; i < unseenPodcasts.length; i++) {
            const newReportRow = Object.assign({}, model_1.emptyEnriched);
            const enrichRow = () => __awaiter(this, void 0, void 0, function* () {
                addBasicInfo(unseenPodcasts[i], newReportRow);
                //some error conditions during scraping may mark the scrape as essentially failed meaning the podcast item should be skipped so that it can be retried later.
                let shouldPush = yield addSpotifyInfo(unseenPodcasts[i], newReportRow);
                shouldPush && (shouldPush = yield addAppleInfo(unseenPodcasts[i], newReportRow));
                shouldPush && (shouldPush = yield addYoutubeInfo(unseenPodcasts[i], newReportRow));
                if (shouldPush)
                    payload.items.push(newReportRow);
            });
            promises.push(enrichRow());
        }
        yield Promise.all(promises);
        res = yield fetch(`${backendUrl}/podcasts`, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: [["Content-Type", "application/json"]],
        });
        if (res.ok) {
            console.log(`Posted ${unseenPodcasts.length} enriched podcasts. Result: ${yield res.text()}`);
            return true;
        }
        else {
            console.log(`Failed to post ${unseenPodcasts.length} enriched podcast. Error: ${yield res.text()}`);
            return false;
        }
    });
}
function enrichAll() {
    return __awaiter(this, void 0, void 0, function* () {
        const saveFileName = `enrichment_state_${backendUrl.split("://")[1]}.json`;
        const saveState = yield (0, utils_1.loadEnrichmentState)(saveFileName);
        saveState.totalCount = yield prisma.podcast.count({ where: {} });
        while (saveState.seenCount < saveState.totalCount) {
            try {
                const podcasts = yield prisma.podcast.findMany({
                    skip: saveState.page * saveState.limit,
                    take: saveState.limit,
                    orderBy: {
                        id: "asc",
                    },
                });
                console.log(`Started enriching batch ${saveState.page} with ${podcasts.length} items...`);
                const enriched = yield enrichBatch(podcasts);
                if (!enriched) {
                    console.log(`Enrichment halted due to an error. Page - ${saveState.page}, Batch Limit - ${saveState.limit}, Progress - ${saveState.seenCount}/${saveState.totalCount}`);
                    process.exit(1);
                }
                console.log(`Finished enriching batch ${saveState.page} with ${podcasts.length} items`);
                saveState.seenCount = saveState.page * saveState.limit + podcasts.length;
                console.log(`Enriched ${saveState.seenCount} Podcast so far out of ${saveState.totalCount}`);
                saveState.page++;
                yield (0, utils_1.saveEnrichmentState)(saveState, saveFileName);
                yield (0, utils_1.closeBrowser)();
            }
            catch (e) {
                console.log(`An error occured. Restarting batch ${saveState.page}. Error: ${e}`);
                process.exit(1);
            }
        }
        console.log("All enrichments complete.");
    });
}
function addBasicInfo(podcast, row) {
    var _a, _b, _c, _d;
    row.podcast_index_id = podcast.id;
    row.podcast_name = (_a = podcast.title) !== null && _a !== void 0 ? _a : "";
    row.podcast_description = (_b = podcast.description) !== null && _b !== void 0 ? _b : "";
    row.rss_feed_url = (_c = podcast.url) !== null && _c !== void 0 ? _c : "";
    row.rss_categories = [
        podcast.category1,
        podcast.category2,
        podcast.category3,
        podcast.category4,
        podcast.category5,
        podcast.category6,
        podcast.category7,
        podcast.category8,
        podcast.category9,
        podcast.category10,
    ]
        .filter((category) => category && category.trim() !== "")
        .join(", ");
    row.rss_total_episodes = (_d = podcast.episodeCount) !== null && _d !== void 0 ? _d : 0;
    row.host = podcast.host;
    row.author = podcast.itunesAuthor;
    row.owner = podcast.itunesOwnerName;
}
function addSpotifyInfo(podcast, row) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            let searchResults = yield (0, api_spotify_1.searchSpotify)(`${podcast.title} ${podcast.itunesAuthor}`);
            if (searchResults.shows.items.length < 1 && podcast.title) {
                // If there are no results on title + name, then the podcast is obscurely named and the title only should be unique enough to find it.
                searchResults = yield (0, api_spotify_1.searchSpotify)(podcast.title);
            }
            for (let i = 0; i < searchResults.shows.items.length; i++) {
                const show = searchResults.shows.items[i];
                if (!show)
                    continue;
                if (show.name.includes((_a = podcast.title) !== null && _a !== void 0 ? _a : "null%") ||
                    ((_b = podcast === null || podcast === void 0 ? void 0 : podcast.title) === null || _b === void 0 ? void 0 : _b.includes(show.name))) {
                    console.log(`Found name title match on Spotify show "${show.name}". Adding corresponding Spotify info...`);
                    row.spotify_url = show.external_urls.spotify;
                    const html = yield (0, utils_1.fetchHydratedHtmlContent)(show.external_urls.spotify);
                    console.log(`Fetched Spotify html for ${show.name}. It has ${html.length} characters.`);
                    const rating = (_c = (0, utils_1.extractSpotifyReview)(html)) !== null && _c !== void 0 ? _c : ["0", "0"];
                    console.log(`Extracted Spotify rating ${rating} for ${show.name}.`);
                    row.spotify_review_count = parseInt((_e = (0, utils_1.extractStringFromParantheses)((_d = rating[0]) !== null && _d !== void 0 ? _d : "0")) !== null && _e !== void 0 ? _e : "0");
                    row.spotify_review_score = parseFloat((_f = rating[1]) !== null && _f !== void 0 ? _f : "0");
                    return true;
                }
            }
            return true;
        }
        catch (e) {
            console.log(`Failed to add Spotify info to podcast "${podcast.title}". Error: ${e}`);
            return false;
        }
    });
}
function addAppleInfo(podcast, row) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            if (!podcast.itunesId)
                return true;
            const url = `https://podcasts.apple.com/podcast/id${podcast.itunesId}`;
            row.apple_podcast_url = url;
            const html = yield (0, utils_1.fetchHydratedHtmlContent)(url);
            console.log(`Fetched Apple podcast html for ${podcast.title}. It has ${html.length} characters.`);
            const rating = (_a = (0, utils_1.extractAppleReview)(html)) !== null && _a !== void 0 ? _a : ["No Rating"];
            console.log(`Extracted Apple podcast rating ${rating} for ${podcast.title}.`);
            row.apple_review_count = parseInt((_c = (0, utils_1.extractStringFromParantheses)((_b = rating[0]) !== null && _b !== void 0 ? _b : "0")) !== null && _c !== void 0 ? _c : "0");
            row.apple_review_score = parseInt(((_d = rating[0]) !== null && _d !== void 0 ? _d : "0").split("(")[0]);
            return true;
        }
        catch (e) {
            console.log(`Failed to add Apple info to podcast "${podcast.title}". Error: ${e}`);
            return false;
        }
    });
}
function addYoutubeInfo(podcast, row) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
        try {
            const lastEpisode = (_a = (yield (0, api_podcastindex_1.getRecentPodcastEpisodes)(podcast, 1))) === null || _a === void 0 ? void 0 : _a.items[0];
            if (!lastEpisode) {
                throw new Error(`Failed to find an episode on podcast "${podcast.title}"`);
            }
            let searchResults = yield (0, api_youtube_1.searchYouTube)(`${lastEpisode.title} ${podcast.title}`);
            if (!searchResults || !searchResults.items) {
                throw new Error(`Youtube search for episode "${lastEpisode.title}" on podcast "${podcast.title}"  failed`);
            }
            if (searchResults.items.length < 1) {
                // If there are no results on ep title + feed title, then the podcast is obscure and the ep title only should be unique enough to find it.
                searchResults = yield (0, api_youtube_1.searchYouTube)(lastEpisode.title);
            }
            for (let i = 0; i < ((_c = (_b = searchResults.items) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0); i++) {
                const result = searchResults.items[i];
                if (!result)
                    continue;
                if ((((_d = result === null || result === void 0 ? void 0 : result.channelTitle) === null || _d === void 0 ? void 0 : _d.includes((_e = podcast.title) !== null && _e !== void 0 ? _e : "null%")) ||
                    ((_f = podcast === null || podcast === void 0 ? void 0 : podcast.title) === null || _f === void 0 ? void 0 : _f.includes((_g = result === null || result === void 0 ? void 0 : result.channelTitle) !== null && _g !== void 0 ? _g : "null%"))) &&
                    (((_h = result === null || result === void 0 ? void 0 : result.title) === null || _h === void 0 ? void 0 : _h.includes(lastEpisode.title)) ||
                        lastEpisode.title.includes((_j = result === null || result === void 0 ? void 0 : result.title) !== null && _j !== void 0 ? _j : "null%"))) {
                    console.log(`Found name title match on Youtube "${result === null || result === void 0 ? void 0 : result.channelTitle}". Adding corresponding Youtube info...`);
                    const videoInfo = yield (0, api_youtube_1.getVideoInfo)(result === null || result === void 0 ? void 0 : result.id);
                    const channelInfo = yield (0, api_youtube_1.getChannelInfo)((_l = (_k = videoInfo === null || videoInfo === void 0 ? void 0 : videoInfo.snippet) === null || _k === void 0 ? void 0 : _k.channelId) !== null && _l !== void 0 ? _l : "");
                    const recentUploads = yield (0, api_youtube_1.getVideosFromPlaylist)((_p = (_o = (_m = channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.contentDetails) === null || _m === void 0 ? void 0 : _m.relatedPlaylists) === null || _o === void 0 ? void 0 : _o.uploads) !== null && _p !== void 0 ? _p : "", 10);
                    row.youtube_channel_url = `https://www.youtube.com/channel/${(_q = videoInfo === null || videoInfo === void 0 ? void 0 : videoInfo.snippet) === null || _q === void 0 ? void 0 : _q.channelId}`;
                    row.youtube_subscribers = parseInt((_s = (_r = channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.statistics) === null || _r === void 0 ? void 0 : _r.subscriberCount) !== null && _s !== void 0 ? _s : "0");
                    const viewCount = Number.parseInt((_u = (_t = channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.statistics) === null || _t === void 0 ? void 0 : _t.viewCount) !== null && _u !== void 0 ? _u : "0");
                    const videoCount = Number.parseInt((_w = (_v = channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.statistics) === null || _v === void 0 ? void 0 : _v.videoCount) !== null && _w !== void 0 ? _w : "0");
                    row.youtube_average_views = Math.trunc(videoCount === 0 ? 0 : viewCount / videoCount);
                    row.youtube_total_episodes = parseInt((_y = (_x = channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.statistics) === null || _x === void 0 ? void 0 : _x.videoCount) !== null && _y !== void 0 ? _y : "0");
                    if (!recentUploads)
                        return false;
                    console.log(`Got ${recentUploads.length} recent videos from ${(_z = videoInfo === null || videoInfo === void 0 ? void 0 : videoInfo.snippet) === null || _z === void 0 ? void 0 : _z.channelTitle}`);
                    let recentViews = 0;
                    for (let i = 0; i < recentUploads.length; i++) {
                        const recentVideo = recentUploads[i];
                        const recentVideoInfo = yield (0, api_youtube_1.getVideoInfo)((_2 = (_1 = (_0 = recentVideo.snippet) === null || _0 === void 0 ? void 0 : _0.resourceId) === null || _1 === void 0 ? void 0 : _1.videoId) !== null && _2 !== void 0 ? _2 : "");
                        recentViews += parseInt((_4 = (_3 = recentVideoInfo === null || recentVideoInfo === void 0 ? void 0 : recentVideoInfo.statistics) === null || _3 === void 0 ? void 0 : _3.viewCount) !== null && _4 !== void 0 ? _4 : "0");
                    }
                    row.youtube_recent_average_views = Math.trunc(recentUploads.length === 0 ? 0 : recentViews / recentUploads.length);
                    row.youtube_last_published_at = new Date((_6 = (_5 = recentUploads[0].snippet) === null || _5 === void 0 ? void 0 : _5.publishedAt) !== null && _6 !== void 0 ? _6 : "1970-01-01T00:00:00Z");
                    return true;
                }
            }
            return true;
        }
        catch (e) {
            console.log(`Failed to add Youtube info to podcast "${podcast.title}". Error: ${e}`);
            return false;
        }
    });
}
enrichAll();
