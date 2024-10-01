import axios from "axios";

async function getSpotifyAccessToken(): Promise<string> {
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      grant_type: "refresh_token",
      refresh_token:
        "AQCquMgqNgzATgmK1z4rQYE6f9gWD0FIoGcCxg5HseXziQZUuVGjbXYrwJxCYwyduPbb51JSaaaBz2JfXG84OcsHwDHmsHX8G_alTmgwn0dOp9fR3pphIO9bJujEtrNsdz4",
    },
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.SPOTIFY_CLIENT_ID +
            ":" +
            process.env.SPOTIFY_CLIENT_SECRET
        ).toString("base64"),
    },
    json: true,
  };

  const response = await axios.post(authOptions.url, authOptions.form, {
    headers: authOptions.headers,
  });

  return response.data.access_token;
}

async function searchSpotify(query: string): Promise<SpotifySearchResult> {
  const accessToken = await getSpotifyAccessToken();

  const response = await axios.get("https://api.spotify.com/v1/search", {
    params: {
      q: query,
      type: "show",
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

export { searchSpotify };

export interface SpotifySearchResult {
  shows: Shows;
}

export interface Shows {
  href: string;
  limit: number;
  next: string;
  offset: number;
  previous: null;
  total: number;
  items: Item[];
}

export interface Item {
  available_markets: string[];
  copyrights: any[];
  description: string;
  html_description: string;
  explicit: boolean;
  external_urls: ExternalUrls;
  href: string;
  id: string;
  images: Image[];
  is_externally_hosted: boolean;
  languages: string[];
  media_type: MediaType;
  name: string;
  publisher: string;
  type: Type;
  uri: string;
  total_episodes: number;
}

export interface ExternalUrls {
  spotify: string;
}

export interface Image {
  url: string;
  height: number;
  width: number;
}

export enum MediaType {
  Audio = "audio",
  Mixed = "mixed",
}

export enum Type {
  Show = "show",
}
