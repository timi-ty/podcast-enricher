import env from "dotenv";
import {
  closeBrowser,
  extractAppleReview,
  extractSpotifyReview,
  extractStringFromParantheses,
  fetchHydratedHtmlContent,
  loadEnrichmentState,
  saveEnrichmentState,
} from "./utils";
import { searchSpotify } from "./api.spotify";
import {
  getChannelInfo,
  getVideoInfo,
  getVideosFromPlaylist,
  searchYouTube,
} from "./api.youtube";
import { Podcast, PrismaClient } from "@prisma/client";
import { getRecentPodcastEpisodes } from "./api.podcastindex";
import {
  emptyEnriched as emptyPodcastEnriched,
  PodcastEnriched,
  PodcastsEnrichedPayload,
} from "./model";

env.config();

const backendUrl = process.env.BACKEND_URL ?? "";

const prisma = new PrismaClient();

async function enrichBatch(podcasts: Podcast[]): Promise<boolean> {
  const promises: Promise<any>[] = [];
  let res = await fetch(`${backendUrl}/enriched`, {
    method: "POST",
    body: JSON.stringify({ items: podcasts.map((podcast) => podcast.id) }),
    headers: [["Content-Type", "application/json"]],
  });
  const enrichedPodcasts: { items: number[]; error: string } = await res.json();
  if (enrichedPodcasts.error) {
    throw new Error(enrichedPodcasts.error);
  }
  const unseenPodcasts = podcasts.filter(
    (podcast) => !enrichedPodcasts.items.includes(podcast.id)
  );
  console.log(
    `Found ${unseenPodcasts.length} unseen podcasts in this batch. Only unseen podcasts will be enriched.`
  );
  const payload: PodcastsEnrichedPayload = { items: [] };
  for (let i = 0; i < unseenPodcasts.length; i++) {
    const newReportRow = { ...emptyPodcastEnriched };
    const enrichRow = async () => {
      console.log(
        `Enriching podcast "${unseenPodcasts[i].title}" with popularity score = ${unseenPodcasts[i].popularityScore}`
      );
      addBasicInfo(unseenPodcasts[i], newReportRow);
      //some error conditions during scraping may mark the scrape as essentially failed meaning the podcast item should be skipped so that it can be retried later.
      let shouldPush = await addSpotifyInfo(unseenPodcasts[i], newReportRow);
      shouldPush &&= await addAppleInfo(unseenPodcasts[i], newReportRow);
      shouldPush &&= await addYoutubeInfo(unseenPodcasts[i], newReportRow);
      if (shouldPush) payload.items.push(newReportRow);
    };
    promises.push(enrichRow());
  }
  await Promise.all(promises);
  res = await fetch(`${backendUrl}/podcasts`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: [["Content-Type", "application/json"]],
  });
  if (res.ok) {
    console.log(
      `Posted ${
        unseenPodcasts.length
      } enriched podcasts. Result: ${await res.text()}`
    );
    return true;
  } else {
    console.log(
      `Failed to post ${
        unseenPodcasts.length
      } enriched podcast. Error: ${await res.text()}`
    );
    return false;
  }
}

async function enrichAll() {
  const saveFileName = `enrichment_state_${backendUrl.split("://")[1]}.json`;
  const saveState = await loadEnrichmentState(saveFileName);

  const thirtyDaysAgoTimestamp =
    Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  //be carefule to ensure that the filters for this count are the same as the filters for the podcasts that get enriched
  saveState.totalCount = await prisma.podcast.count({
    where: {
      dead: 0,
    },
  });

  while (saveState.seenCount < saveState.totalCount) {
    try {
      const podcasts = await prisma.podcast.findMany({
        where: {
          dead: 0,
        },
        skip: saveState.page * saveState.limit,
        take: saveState.limit,
        orderBy: [{ popularityScore: "desc" }, { newestItemPubdate: "desc" }],
      });
      console.log(
        `Started enriching batch ${saveState.page} with ${podcasts.length} items...`
      );
      const enriched = await enrichBatch(podcasts);
      if (!enriched) {
        console.log(
          `Enrichment halted due to an error. Page - ${saveState.page}, Batch Limit - ${saveState.limit}, Progress - ${saveState.seenCount}/${saveState.totalCount}`
        );
        process.exit(1);
      }
      console.log(
        `Finished enriching batch ${saveState.page} with ${podcasts.length} items`
      );
      saveState.seenCount = saveState.page * saveState.limit + podcasts.length;
      console.log(
        `Enriched ${saveState.seenCount} Podcast so far out of ${saveState.totalCount}`
      );
      saveState.page++;

      await saveEnrichmentState(saveState, saveFileName);
      await closeBrowser();
    } catch (e) {
      console.log(
        `An error occured. Stopped at batch ${saveState.page}. Error: ${e}`
      );
      process.exit(1);
    }
  }

  console.log("All enrichments complete.");
}

function addBasicInfo(podcast: Podcast, row: PodcastEnriched) {
  row.podcast_index_id = podcast.id;
  row.podcast_name = podcast.title ?? "";
  row.podcast_description = podcast.description ?? "";
  row.rss_feed_url = podcast.url ?? "";
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
  row.rss_total_episodes = podcast.episodeCount ?? 0;
  row.host = podcast.host;
  row.author = podcast.itunesAuthor;
  row.owner = podcast.itunesOwnerName;
}

async function addSpotifyInfo(
  podcast: Podcast,
  row: PodcastEnriched
): Promise<boolean> {
  try {
    let searchResults = await searchSpotify(
      `${podcast.title} ${podcast.itunesAuthor}`
    );
    if (searchResults.shows.items.length < 1 && podcast.title) {
      // If there are no results on title + name, then the podcast is obscurely named and the title only should be unique enough to find it.
      searchResults = await searchSpotify(podcast.title);
    }
    for (let i = 0; i < searchResults.shows.items.length; i++) {
      const show = searchResults.shows.items[i];
      if (!show) continue;
      if (
        show.name.includes(podcast.title ?? "null%") ||
        podcast?.title?.includes(show.name)
      ) {
        console.log(
          `Found name title match on Spotify show "${show.name}". Adding corresponding Spotify info...`
        );
        row.spotify_url = show.external_urls.spotify;
        const html = await fetchHydratedHtmlContent(show.external_urls.spotify);
        console.log(
          `Fetched Spotify html for ${show.name}. It has ${html.length} characters.`
        );
        const rating = extractSpotifyReview(html) ?? ["0", "0"];
        console.log(`Extracted Spotify rating ${rating} for ${show.name}.`);
        row.spotify_review_count = parseInt(
          extractStringFromParantheses(rating[0] ?? "0") ?? "0"
        );
        row.spotify_review_score = parseFloat(rating[1] ?? "0");
        return true;
      }
    }
    return true;
  } catch (e) {
    console.log(
      `Failed to add Spotify info to podcast "${podcast.title}". Error: ${e}`
    );
    return false;
  }
}

async function addAppleInfo(
  podcast: Podcast,
  row: PodcastEnriched
): Promise<boolean> {
  try {
    if (!podcast.itunesId) return true;
    const url = `https://podcasts.apple.com/podcast/id${podcast.itunesId}`;
    row.apple_podcast_url = url;
    const html = await fetchHydratedHtmlContent(url);
    console.log(
      `Fetched Apple podcast html for ${podcast.title}. It has ${html.length} characters.`
    );
    const rating = extractAppleReview(html) ?? ["No Rating"];
    console.log(
      `Extracted Apple podcast rating ${rating} for ${podcast.title}.`
    );
    row.apple_review_count = parseInt(
      extractStringFromParantheses(rating[0] ?? "0") ?? "0"
    );
    row.apple_review_score = parseInt((rating[0] ?? "0").split("(")[0]);
    return true;
  } catch (e) {
    console.log(
      `Failed to add Apple info to podcast "${podcast.title}". Error: ${e}`
    );
    return false;
  }
}

async function addYoutubeInfo(
  podcast: Podcast,
  row: PodcastEnriched
): Promise<boolean> {
  try {
    const lastEpisode = (await getRecentPodcastEpisodes(podcast, 1))?.items[0];
    if (!lastEpisode) {
      throw new Error(
        `Failed to find an episode on podcast "${podcast.title}"`
      );
    }
    let searchResults = await searchYouTube(
      `${lastEpisode.title} ${podcast.title}`
    );
    if (!searchResults || !searchResults.items) {
      throw new Error(
        `Youtube search for episode "${lastEpisode.title}" on podcast "${podcast.title}"  failed`
      );
    }
    if (searchResults.items.length < 1) {
      // If there are no results on ep title + feed title, then the podcast is obscure and the ep title only should be unique enough to find it.
      searchResults = await searchYouTube(lastEpisode.title);
    }
    for (let i = 0; i < (searchResults.items?.length ?? 0); i++) {
      const result = searchResults.items[i];
      if (!result) continue;

      if (
        (result?.channelTitle?.includes(podcast.title ?? "null%") ||
          podcast?.title?.includes(result?.channelTitle ?? "null%")) &&
        (result?.title?.includes(lastEpisode.title) ||
          lastEpisode.title.includes(result?.title ?? "null%"))
      ) {
        console.log(
          `Found name title match on Youtube "${result?.channelTitle}". Adding corresponding Youtube info...`
        );
        const videoInfo = await getVideoInfo(result?.id);
        const channelInfo = await getChannelInfo(
          videoInfo?.snippet?.channelId ?? ""
        );
        const recentUploads = await getVideosFromPlaylist(
          channelInfo?.contentDetails?.relatedPlaylists?.uploads ?? "",
          10
        );
        row.youtube_channel_url = `https://www.youtube.com/channel/${videoInfo?.snippet?.channelId}`;
        row.youtube_subscribers = parseInt(
          channelInfo?.statistics?.subscriberCount ?? "0"
        );
        const viewCount = Number.parseInt(
          channelInfo?.statistics?.viewCount ?? "0"
        );
        const videoCount = Number.parseInt(
          channelInfo?.statistics?.videoCount ?? "0"
        );
        row.youtube_average_views = Math.trunc(
          videoCount === 0 ? 0 : viewCount / videoCount
        );
        row.youtube_total_episodes = parseInt(
          channelInfo?.statistics?.videoCount ?? "0"
        );
        if (!recentUploads) return false;
        console.log(
          `Got ${recentUploads.length} recent videos from ${videoInfo?.snippet?.channelTitle}`
        );
        let recentViews = 0;
        for (let i = 0; i < recentUploads.length; i++) {
          const recentVideo = recentUploads[i];
          const recentVideoInfo = await getVideoInfo(
            recentVideo.snippet?.resourceId?.videoId ?? ""
          );
          recentViews += parseInt(
            recentVideoInfo?.statistics?.viewCount ?? "0"
          );
        }
        row.youtube_recent_average_views = Math.trunc(
          recentUploads.length === 0 ? 0 : recentViews / recentUploads.length
        );
        row.youtube_last_published_at = new Date(
          recentUploads[0].snippet?.publishedAt ?? "1970-01-01T00:00:00Z"
        );
        return true;
      }
    }
    return true;
  } catch (e) {
    console.log(
      `Failed to add Youtube info to podcast "${podcast.title}". Error: ${e}`
    );
    return false;
  }
}

enrichAll();
