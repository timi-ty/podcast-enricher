import crypto from "crypto";
import * as cheerio from "cheerio";
import * as puppeteer from "puppeteer";
import fs from "fs/promises";
import { EnrichmentState } from "./model";

export function sha1(str: string) {
  return crypto.createHash("sha1").update(str).digest("hex");
}

export function extractSpotifyReview(html: string): (string | null)[] {
  const $ = cheerio.load(html);
  const spanCount = $(
    ".Type__TypeElement-sc-goli3j-0.dOtTDl.ret7iHkCxcJvsZU14oPY"
  ).first();
  const spanScore = $(
    '.Type__TypeElement-sc-goli3j-0.dDZCoe[dir="auto"]'
  ).first();

  return [
    spanCount.length ? spanCount.text() : null,
    spanScore.length ? spanScore.text() : null,
  ];
}

export function extractAppleReview(html: string): (string | null)[] {
  const $ = cheerio.load(html);

  const reviewInfo = $("li.svelte-11a0tog").first().text().trim();

  return [reviewInfo.length ? reviewInfo : null];
}

export function extractStringFromParantheses(input: string): string | null {
  const match = input.match(/\((\d+)\)/);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

let browser: puppeteer.Browser | null = null;

export async function fetchHydratedHtmlContent(url: string): Promise<string> {
  if (!browser) {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  const page = await browser.newPage();
  await page.goto(url, { timeout: 120000, waitUntil: "networkidle2" });
  const html = await page.content();
  await page.close();
  return html;
}

export async function closeBrowser() {
  await browser?.close();
  browser = null;
}

export async function saveEnrichmentState(
  state: EnrichmentState,
  saveFileName: string
): Promise<void> {
  try {
    const jsonString = JSON.stringify(state, null, 2);
    await fs.writeFile(saveFileName, jsonString, "utf-8");
    console.log(`EnrichmentState saved to ${saveFileName}`);
  } catch (error) {
    console.error("Error saving EnrichmentState:", error);
    throw error;
  }
}

export async function loadEnrichmentState(
  saveFileName: string
): Promise<EnrichmentState> {
  try {
    // Try to read the file
    const jsonString = await fs.readFile(saveFileName, "utf-8");
    const state: EnrichmentState = JSON.parse(jsonString);
    console.log(`EnrichmentState loaded from ${saveFileName}`);
    return state;
  } catch (error) {
    // If the file doesn't exist or there's an error reading it
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(`File ${saveFileName} not found. Creating default state.`);
      const defaultState: EnrichmentState = {
        page: 0,
        limit: 20,
        seenCount: 0,
        totalCount: 0,
      };
      // Save the default state to the file
      await saveEnrichmentState(defaultState, saveFileName);
      return defaultState;
    } else {
      console.error("Error loading EnrichmentState:", error);
      throw error;
    }
  }
}
