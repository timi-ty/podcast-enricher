import { extractSpotifyReview, fetchHydratedHtmlContent } from "./utils";
import { describe } from "@jest/globals";

describe("extractSpotifyRating", () => {
  test("extracts content from valid span", () => {
    const html =
      '<span dir="auto" data-encore-id="type" class="Type__TypeElement-sc-goli3j-0 dDZCoe">4.8</span>';
    expect(extractSpotifyReview(html)[1]).toBe("4.8");
  });

  test("returns null for no match", () => {
    const html = "<span>Some other content</span>";
    expect(extractSpotifyReview(html)[1]).toBeNull();
  });

  test("extracts content from span within larger HTML", async () => {
    const html = await fetchHydratedHtmlContent(
      "https://open.spotify.com/show/2BAjN7DBH8Kr90QRrUv8tM"
    );
    // Confirm the actual rating of this show by following the link above.
    expect(extractSpotifyReview(html)[1]).toBe("4.8");
  }, 30000);

  test("returns first match when multiple matches exist", () => {
    const html = `
      <span dir="auto" data-encore-id="type" class="Type__TypeElement-sc-goli3j-0 dDZCoe">4.8</span>
      <span dir="auto" data-encore-id="type" class="Type__TypeElement-sc-goli3j-0 dDZCoe">3.9</span>
    `;
    expect(extractSpotifyReview(html)[1]).toBe("4.8");
  });
});
