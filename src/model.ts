export interface PodcastEnriched {
  id: number;
  podcast_index_id: number | null;
  podcast_name: string;
  language: string;
  podcast_description: string;
  rss_feed_url: string;
  rss_categories: string;
  rss_total_episodes: number;
  host: string;
  author: string;
  owner: string;
  spotify_url: string;
  spotify_review_count: number;
  spotify_review_score: number;
  apple_podcast_url: string;
  apple_review_count: number;
  apple_review_score: number;
  youtube_channel_url: string;
  youtube_subscribers: number;
  youtube_average_views: number;
  youtube_total_episodes: number;
  youtube_recent_average_views: number;
  youtube_last_published_at: Date;
  stale: boolean;
}

export const emptyEnriched: PodcastEnriched = {
  id: -1, //Id of -1 will make the backend create a new entry
  podcast_index_id: null,
  podcast_name: "",
  language: "",
  podcast_description: "",
  rss_feed_url: "",
  rss_categories: "",
  rss_total_episodes: 0,
  host: "",
  author: "",
  owner: "",
  spotify_url: "",
  spotify_review_count: 0,
  spotify_review_score: 0,
  apple_podcast_url: "",
  apple_review_count: 0,
  apple_review_score: 0,
  youtube_channel_url: "",
  youtube_subscribers: 0,
  youtube_average_views: 0,
  youtube_total_episodes: 0,
  youtube_recent_average_views: 0,
  youtube_last_published_at: new Date("1970-01-01T00:00:00Z"),
  stale: false,
};

export interface PodcastsEnrichedPayload {
  items: PodcastEnriched[];
}

export interface EnrichmentState {
  page: number;
  limit: number;
  seenCount: number;
  totalCount: number;
}
