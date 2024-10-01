import { google } from "googleapis";
import * as YouTubeSearchApi from "youtube-search-api";

const youtube = google.youtube("v3");

export async function searchYouTube(
  query: string,
  limit: number = 5
): Promise<SearchResults> {
  const options = [{ type: "video" }];
  const results = await YouTubeSearchApi.GetListByKeyword(
    query,
    false,
    limit,
    options
  );
  return results;
}

export async function getVideoInfo(videoId: string) {
  const response = await youtube.videos.list({
    id: [videoId],
    part: ["snippet", "statistics", "contentDetails"],
    key: process.env.YOUTUBE_API_KEY,
  });

  return response.data.items ? response.data.items[0] : null;
}

export async function getChannelInfo(channelId: string) {
  const response = await youtube.channels.list({
    id: [channelId],
    part: ["statistics", "contentDetails"],
    key: process.env.YOUTUBE_API_KEY,
  });

  return response.data.items ? response.data.items[0] : null;
}

export async function getVideosFromPlaylist(playlistId: string, count: number) {
  const response = await youtube.playlistItems.list({
    part: ["snippet"],
    playlistId: playlistId,
    maxResults: count,
    key: process.env.YOUTUBE_API_KEY,
  });

  return response.data.items;
}

export interface SearchResults {
  items: Item[];
}

export interface Item {
  id: string;
  type: string;
  title: string;
  channelTitle?: string;
  isLive?: boolean;
}
