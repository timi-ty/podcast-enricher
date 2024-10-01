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
exports.getRecentPodcastEpisodes = getRecentPodcastEpisodes;
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("./utils");
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
