import axios from "axios";
import { sha1 } from "./utils";
import { Podcast } from "@prisma/client";
import fs from "fs";
import path from "path";
import https from "https";
import * as tar from "tar";
import zlib from "zlib";
import sqlite3 from "sqlite3";
import { promisify } from "util";

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

const dbDownloadUrl =
  "https://public.podcastindex.org/podcastindex_feeds.db.tgz";
const dbDownloadPath = path.join(__dirname, "podcastindex_feeds.db.tgz");
const dbExtractPath = path.join(__dirname, "prisma");
const dbFilePath = path.join(dbExtractPath, "podcastindex_feeds.db");

export async function downloadAndExtractDatabase() {
  // Ensure the prisma directory exists
  if (!fs.existsSync(dbExtractPath)) {
    fs.mkdirSync(dbExtractPath, { recursive: true });
  }

  console.log("Downloading podcastindex_feeds.db...");
  await downloadFile(dbDownloadUrl, dbDownloadPath);

  console.log("Extracting podcastindex_feeds.db...");
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(dbDownloadPath)
      .pipe(zlib.createGunzip())
      .pipe(
        tar.extract({
          cwd: dbExtractPath,
          // Override existing files
          keep: false,
        })
      )
      .on("finish", resolve)
      .on("error", reject);
  });

  console.log("Cleaning up podcastindex_feeds.db archive...");
  fs.unlinkSync(dbDownloadPath);

  // Verify that the .db file exists after extraction
  if (fs.existsSync(dbFilePath)) {
    console.log(
      "Database downloaded and extracted successfully, replacing any existing file."
    );
  } else {
    throw new Error("Failed to extract the database file.");
  }
}

// Promisify sqlite3 methods
const dbAll = promisify(sqlite3.Database.prototype.all);
const dbRun = promisify(sqlite3.Database.prototype.run);
const dbClose = promisify(sqlite3.Database.prototype.close);

export async function cleanupDatabase() {
  const db = new sqlite3.Database("podcastindex_feeds.db");

  try {
    console.log(
      "Connected to the SQLite database. Cleaning up podcastindex_feeds.db..."
    );

    // Get all tables in the database
    const tables = (await dbAll.call(
      db,
      "SELECT name FROM sqlite_master WHERE type='table'"
    )) as { name: string }[];

    for (const table of tables) {
      // Get all columns for the current table
      const columns = (await dbAll.call(
        db,
        `PRAGMA table_info(${table.name})`
      )) as { name: string }[];

      for (const column of columns) {
        // Update empty strings to NULL for each column
        const updateQuery = `UPDATE ${table.name} SET ${column.name} = NULL WHERE ${column.name} = ''`;
        const result: any = await dbRun.call(db, updateQuery);
        console.log(
          `Updated ${result.changes} rows in ${table.name}.${column.name}`
        );
      }
    }

    console.log("Database cleanup completed.");
  } catch (err) {
    console.error("Error during database cleanup:", (err as Error).message);
  } finally {
    // Close the database connection
    try {
      await dbClose.call(db);
      console.log("Database connection closed.");
    } catch (err) {
      console.error("Error closing database:", (err as Error).message);
    }
  }
}

export function isPodcastDbOldOrMissing(): boolean {
  const dbFilePath = path.join(
    process.cwd(),
    "prisma",
    "podcastindex_feeds.db"
  );

  // Check if the file exists
  if (!fs.existsSync(dbFilePath)) {
    return true;
  }

  try {
    const stats = fs.statSync(dbFilePath);
    const lastModifiedDate = stats.mtime;
    const currentDate = new Date();

    // Calculate the difference in days
    const differenceInDays =
      (currentDate.getTime() - lastModifiedDate.getTime()) / (1000 * 3600 * 24);

    // Return true if the file is 7 or more days old
    return differenceInDays >= 7;
  } catch (error) {
    console.error("Error checking file modification time:", error);
    // If there's an error reading the file stats, return true as a precaution
    return true;
  }
}

async function downloadFile(url: string, downloadPath: string) {
  return new Promise<void>((resolve, reject) => {
    https
      .get(url, (response) => {
        const fileStream = fs.createWriteStream(downloadPath);
        const totalSize = parseInt(
          response.headers["content-length"] ?? "0",
          10
        );
        let downloadedSize = 0;
        let startTime = Date.now();

        response.pipe(fileStream);

        response.on("data", (chunk) => {
          downloadedSize += chunk.length;
          const progress = (downloadedSize / totalSize) * 100;
          const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
          const speed = (downloadedSize / elapsedTime / 1024).toFixed(2); // in KB/s

          process.stdout.write(
            `\rProgress: ${progress.toFixed(2)}% | Speed: ${speed} KB/s`
          );
        });

        fileStream.on("finish", () => {
          fileStream.close();
          console.log("\nDownload completed!");
          resolve();
        });
      })
      .on("error", reject);
  });
}
