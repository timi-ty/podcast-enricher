"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getRecentPodcastEpisodes = getRecentPodcastEpisodes;
exports.downloadAndExtractDatabase = downloadAndExtractDatabase;
exports.cleanupDatabase = cleanupDatabase;
exports.isPodcastDbOldOrMissing = isPodcastDbOldOrMissing;
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("./utils");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const tar = __importStar(require("tar"));
const zlib_1 = __importDefault(require("zlib"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const util_1 = require("util");
function getRecentPodcastEpisodes(podcast, max) {
    return __awaiter(this, void 0, void 0, function* () {
        const podcastIndexRecentsUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${podcast.id}&max=${max}`;
        const unixTime = Math.floor(Date.now() / 1000);
        const authHeader = (0, utils_1.sha1)(`XXF5LPTCMAZMMSKTQYJ6JFwVNqbTbv#duL6kgX3P^RfPQqsKgfjm9HpTzRrP${unixTime}`);
        const res = yield axios_1.default.get(podcastIndexRecentsUrl, {
            headers: {
                "X-Auth-Key": "XXF5LPTCMAZMMSKTQYJ6",
                "User-Agent": "node-server",
                "X-Auth-Date": unixTime,
                Authorization: authHeader,
            },
        });
        return res.data;
    });
}
const dbDownloadUrl = "https://public.podcastindex.org/podcastindex_feeds.db.tgz";
const dbDownloadPath = path_1.default.join(__dirname, "podcastindex_feeds.db.tgz");
const dbExtractPath = path_1.default.join(__dirname, "prisma");
const dbFilePath = path_1.default.join(dbExtractPath, "podcastindex_feeds.db");
function downloadAndExtractDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        // Ensure the prisma directory exists
        if (!fs_1.default.existsSync(dbExtractPath)) {
            fs_1.default.mkdirSync(dbExtractPath, { recursive: true });
        }
        console.log("Downloading podcastindex_feeds.db...");
        yield downloadFile(dbDownloadUrl, dbDownloadPath);
        console.log("Extracting podcastindex_feeds.db...");
        yield new Promise((resolve, reject) => {
            fs_1.default.createReadStream(dbDownloadPath)
                .pipe(zlib_1.default.createGunzip())
                .pipe(tar.extract({
                cwd: dbExtractPath,
                // Override existing files
                keep: false,
            }))
                .on("finish", resolve)
                .on("error", reject);
        });
        console.log("Cleaning up podcastindex_feeds.db archive...");
        fs_1.default.unlinkSync(dbDownloadPath);
        // Verify that the .db file exists after extraction
        if (fs_1.default.existsSync(dbFilePath)) {
            console.log("Database downloaded and extracted successfully, replacing any existing file.");
        }
        else {
            throw new Error("Failed to extract the database file.");
        }
    });
}
// Promisify sqlite3 methods
const dbAll = (0, util_1.promisify)(sqlite3_1.default.Database.prototype.all);
const dbRun = (0, util_1.promisify)(sqlite3_1.default.Database.prototype.run);
const dbClose = (0, util_1.promisify)(sqlite3_1.default.Database.prototype.close);
function cleanupDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = new sqlite3_1.default.Database("podcastindex_feeds.db");
        try {
            console.log("Connected to the SQLite database. Cleaning up podcastindex_feeds.db...");
            // Get all tables in the database
            const tables = (yield dbAll.call(db, "SELECT name FROM sqlite_master WHERE type='table'"));
            for (const table of tables) {
                // Get all columns for the current table
                const columns = (yield dbAll.call(db, `PRAGMA table_info(${table.name})`));
                for (const column of columns) {
                    // Update empty strings to NULL for each column
                    const updateQuery = `UPDATE ${table.name} SET ${column.name} = NULL WHERE ${column.name} = ''`;
                    const result = yield dbRun.call(db, updateQuery);
                    console.log(`Updated ${result.changes} rows in ${table.name}.${column.name}`);
                }
            }
            console.log("Database cleanup completed.");
        }
        catch (err) {
            console.error("Error during database cleanup:", err.message);
        }
        finally {
            // Close the database connection
            try {
                yield dbClose.call(db);
                console.log("Database connection closed.");
            }
            catch (err) {
                console.error("Error closing database:", err.message);
            }
        }
    });
}
function isPodcastDbOldOrMissing() {
    const dbFilePath = path_1.default.join(process.cwd(), "prisma", "podcastindex_feeds.db");
    // Check if the file exists
    if (!fs_1.default.existsSync(dbFilePath)) {
        return true;
    }
    try {
        const stats = fs_1.default.statSync(dbFilePath);
        const lastModifiedDate = stats.mtime;
        const currentDate = new Date();
        // Calculate the difference in days
        const differenceInDays = (currentDate.getTime() - lastModifiedDate.getTime()) / (1000 * 3600 * 24);
        // Return true if the file is 7 or more days old
        return differenceInDays >= 7;
    }
    catch (error) {
        console.error("Error checking file modification time:", error);
        // If there's an error reading the file stats, return true as a precaution
        return true;
    }
}
function downloadFile(url, downloadPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            https_1.default
                .get(url, (response) => {
                var _a;
                const fileStream = fs_1.default.createWriteStream(downloadPath);
                const totalSize = parseInt((_a = response.headers["content-length"]) !== null && _a !== void 0 ? _a : "0", 10);
                let downloadedSize = 0;
                let startTime = Date.now();
                response.pipe(fileStream);
                response.on("data", (chunk) => {
                    downloadedSize += chunk.length;
                    const progress = (downloadedSize / totalSize) * 100;
                    const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
                    const speed = (downloadedSize / elapsedTime / 1024).toFixed(2); // in KB/s
                    process.stdout.write(`\rProgress: ${progress.toFixed(2)}% | Speed: ${speed} KB/s`);
                });
                fileStream.on("finish", () => {
                    fileStream.close();
                    console.log("\nDownload completed!");
                    resolve();
                });
            })
                .on("error", reject);
        });
    });
}
