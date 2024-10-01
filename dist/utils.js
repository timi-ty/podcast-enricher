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
exports.sha1 = sha1;
exports.extractSpotifyReview = extractSpotifyReview;
exports.extractAppleReview = extractAppleReview;
exports.extractStringFromParantheses = extractStringFromParantheses;
exports.fetchHydratedHtmlContent = fetchHydratedHtmlContent;
exports.closeBrowser = closeBrowser;
exports.saveEnrichmentState = saveEnrichmentState;
exports.loadEnrichmentState = loadEnrichmentState;
const crypto_1 = __importDefault(require("crypto"));
const cheerio = __importStar(require("cheerio"));
const puppeteer = __importStar(require("puppeteer"));
const promises_1 = __importDefault(require("fs/promises"));
function sha1(str) {
    return crypto_1.default.createHash("sha1").update(str).digest("hex");
}
function extractSpotifyReview(html) {
    const $ = cheerio.load(html);
    const spanCount = $(".Type__TypeElement-sc-goli3j-0.dOtTDl.ret7iHkCxcJvsZU14oPY").first();
    const spanScore = $('.Type__TypeElement-sc-goli3j-0.dDZCoe[dir="auto"]').first();
    return [
        spanCount.length ? spanCount.text() : null,
        spanScore.length ? spanScore.text() : null,
    ];
}
function extractAppleReview(html) {
    const $ = cheerio.load(html);
    const reviewInfo = $("li.svelte-11a0tog").first().text().trim();
    return [reviewInfo.length ? reviewInfo : null];
}
function extractStringFromParantheses(input) {
    const match = input.match(/\((\d+)\)/);
    if (match && match[1]) {
        return match[1];
    }
    return null;
}
let browser = null;
function fetchHydratedHtmlContent(url) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!browser) {
            browser = yield puppeteer.launch({
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
        }
        const page = yield browser.newPage();
        yield page.goto(url, { timeout: 120000, waitUntil: "networkidle2" });
        const html = yield page.content();
        return html;
    });
}
function closeBrowser() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (browser === null || browser === void 0 ? void 0 : browser.close());
        browser = null;
    });
}
function saveEnrichmentState(state, saveFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const jsonString = JSON.stringify(state, null, 2);
            yield promises_1.default.writeFile(saveFileName, jsonString, "utf-8");
            console.log(`EnrichmentState saved to ${saveFileName}`);
        }
        catch (error) {
            console.error("Error saving EnrichmentState:", error);
            throw error;
        }
    });
}
function loadEnrichmentState(saveFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Try to read the file
            const jsonString = yield promises_1.default.readFile(saveFileName, "utf-8");
            const state = JSON.parse(jsonString);
            console.log(`EnrichmentState loaded from ${saveFileName}`);
            return state;
        }
        catch (error) {
            // If the file doesn't exist or there's an error reading it
            if (error.code === "ENOENT") {
                console.log(`File ${saveFileName} not found. Creating default state.`);
                const defaultState = {
                    page: 0,
                    limit: 20,
                    seenCount: 0,
                    totalCount: 0,
                };
                // Save the default state to the file
                yield saveEnrichmentState(defaultState, saveFileName);
                return defaultState;
            }
            else {
                console.error("Error loading EnrichmentState:", error);
                throw error;
            }
        }
    });
}
