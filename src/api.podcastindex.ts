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
const dbDownloadPath = path.join(process.cwd(), "podcastindex_feeds.db.tgz");
const dbExtractPath = path.join(process.cwd(), "prisma");
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

export function cleanupDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFilePath);

    console.log(
      "Connected to the SQLite database. Cleaning up podcastindex_feeds.db..."
    );

    db.all(
      "SELECT name FROM sqlite_master WHERE type='table'",
      [],
      async (err, tables: any[]) => {
        if (err) {
          console.error("Error getting tables:", err.message);
          reject(err);
          return;
        }

        try {
          // Process each table
          for (const table of tables) {
            // Get all columns for the current table
            const columns: any[] = await new Promise((resolve, reject) => {
              db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(columns);
                }
              });
            });

            // Update empty strings to NULL for each column
            for (const column of columns) {
              const updateQuery = `UPDATE ${table.name} SET ${column.name} = NULL WHERE ${column.name} = ''`;
              await new Promise<void>((resolve, reject) => {
                db.run(updateQuery, [], function (err: any) {
                  if (err) {
                    if (
                      err.code === "SQLITE_CONSTRAINT" &&
                      err.message.includes("NOT NULL constraint failed")
                    ) {
                      console.warn(
                        `Warning: NOT NULL constraint for ${table.name}.${column.name}: ${err.message}`
                      );
                      resolve(); // Continue with the next column
                    } else {
                      console.error(
                        `Error updating ${table.name}.${column.name}:`,
                        err.message
                      );
                      reject(err);
                    }
                  } else {
                    console.log(
                      `Updated ${this.changes} rows in ${table.name}.${column.name}`
                    );
                    resolve();
                  }
                });
              });
            }
          }

          console.log("Database cleanup completed successfully.");
          db.close();
          resolve();
        } catch (error) {
          console.error("Error during database cleanup:", error);
          db.close();
          reject(error);
        }
      }
    );
  });
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
