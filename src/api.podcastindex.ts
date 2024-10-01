import axios from "axios";
import { sha1 } from "./utils";
import { Podcast } from "@prisma/client";

export async function getRecentPodcastEpisodes(
  podcast: Podcast,
  max: number
): Promise<RecentEpisodes | null> {
  const podcastIndexRecentsUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${podcast.id}&max=${max}`;
  const unixTime = Math.floor(Date.now() / 1000);
  const authHeader = sha1(
    `XXF5LPTCMAZMMSKTQYJ6JFwVNqbTbv#duL6kgX3P^RfPQqsKgfjm9HpTzRrP${unixTime}`
  );

  const res = await axios.get(podcastIndexRecentsUrl, {
    headers: {
      "X-Auth-Key": "XXF5LPTCMAZMMSKTQYJ6",
      "User-Agent": "node-server",
      "X-Auth-Date": unixTime,
      Authorization: authHeader,
    },
  });

  return res.data;
}

export interface RecentEpisodes {
  status: string;
  items: Episode[];
  count: number;
  max: string;
  description: string;
}

export interface Episode {
  id: number;
  title: string;
  link: string;
  description: string;
  guid: string;
  datePublished: number;
  datePublishedPretty: string;
  dateCrawled: number;
  enclosureUrl: string;
  enclosureType: string;
  enclosureLength: number;
  explicit: number;
  episode: null;
  episodeType: string;
  season: number;
  image: string;
  feedItunesId: number;
  feedImage: string;
  feedId: number;
  feedTitle: string;
  feedLanguage: string;
}
