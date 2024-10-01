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
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const globals_1 = require("@jest/globals");
(0, globals_1.describe)("extractSpotifyRating", () => {
    test("extracts content from valid span", () => {
        const html = '<span dir="auto" data-encore-id="type" class="Type__TypeElement-sc-goli3j-0 dDZCoe">4.8</span>';
        expect((0, utils_1.extractSpotifyReview)(html)[1]).toBe("4.8");
    });
    test("returns null for no match", () => {
        const html = "<span>Some other content</span>";
        expect((0, utils_1.extractSpotifyReview)(html)[1]).toBeNull();
    });
    test("extracts content from span within larger HTML", () => __awaiter(void 0, void 0, void 0, function* () {
        const html = yield (0, utils_1.fetchHydratedHtmlContent)("https://open.spotify.com/show/2BAjN7DBH8Kr90QRrUv8tM");
        // Confirm the actual rating of this show by following the link above.
        expect((0, utils_1.extractSpotifyReview)(html)[1]).toBe("4.8");
    }), 30000);
    test("returns first match when multiple matches exist", () => {
        const html = `
      <span dir="auto" data-encore-id="type" class="Type__TypeElement-sc-goli3j-0 dDZCoe">4.8</span>
      <span dir="auto" data-encore-id="type" class="Type__TypeElement-sc-goli3j-0 dDZCoe">3.9</span>
    `;
        expect((0, utils_1.extractSpotifyReview)(html)[1]).toBe("4.8");
    });
});
