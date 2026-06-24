import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const feedUrl = "https://api.axios.com/feed/";
const articleCount = 5;
const indexPath = path.join(rootDir, "index.html");
const assetDir = path.join(rootDir, "assets", "axios-feed");
const metadataPath = path.join(assetDir, "metadata.json");
const fallbackImages = [
  "assets/axios-ai-cost-human-workers.jpeg",
  "assets/axios-israel-ai-influence.jpeg",
  "assets/axios-colorado-ai-law.jpg",
  "assets/axios-google-anthropic.gif",
  "assets/axios-ai-productivity-inflation.gif"
];

const positivePatterns = [
  /\bAI\b/i,
  /\bartificial intelligence\b/i,
  /\bautomation\b/i,
  /\bautomated\b/i,
  /\bagentic\b/i,
  /\bOpenAI\b/i,
  /\bChatGPT\b/i,
  /\bAnthropic\b/i,
  /\bClaude\b/i,
  /\bGoogle\b/i,
  /\bGemini\b/i,
  /\bMicrosoft\b/i,
  /\bCopilot\b/i,
  /\bNvidia\b/i,
  /\bxAI\b/i,
  /\brobotics?\b/i,
  /\bproductivity\b/i,
  /\btech\b/i
];

const negativePatterns = [
  /\bIran\b/i,
  /\bUkraine\b/i,
  /\bRussia\b/i,
  /\bIsrael\b/i,
  /\bTrump\b/i,
  /\boil\b/i,
  /\bwar\b/i,
  /\belection\b/i
];

function decodeEntities(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function stripHtml(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTag(item, tagName) {
  const match = item.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function getImageUrl(item) {
  const mediaContent = item.match(/<media:content\b[^>]*\burl="([^"]+)"/i);
  const mediaThumbnail = item.match(/<media:thumbnail\b[^>]*\burl="([^"]+)"/i);
  return decodeEntities(mediaContent?.[1] || mediaThumbnail?.[1] || "");
}

function parseItems(xml) {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map(([, item]) => {
    const description = getTag(item, "description");
    const content = getTag(item, "content:encoded");
    const categories = Array.from(item.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi))
      .map(([, value]) => stripHtml(value));

    return {
      title: stripHtml(getTag(item, "title")),
      link: stripHtml(getTag(item, "link")),
      description: stripHtml(description),
      content: stripHtml(content),
      categories,
      pubDate: stripHtml(getTag(item, "pubDate")),
      imageUrl: getImageUrl(item)
    };
  });
}

function scoreStory(story) {
  const title = story.title;
  const body = `${story.description} ${story.content} ${story.categories.join(" ")}`;
  const link = story.link;
  let score = 0;

  for (const pattern of positivePatterns) {
    if (pattern.test(title)) score += 5;
    if (pattern.test(body)) score += 2;
    if (pattern.test(link)) score += 2;
  }

  for (const pattern of negativePatterns) {
    if (pattern.test(title)) score -= 4;
    if (pattern.test(body)) score -= 1;
  }

  if (/\/technology\//i.test(body) || /\/technology\//i.test(link)) score += 3;
  if (/\/ai\b|\/artificial-intelligence\b/i.test(link)) score += 4;

  return score;
}

function selectStories(items) {
  return items
    .filter((story) => /^https:\/\/www\.axios\.com\/\d{4}\/\d{2}\/\d{2}\//.test(story.link))
    .map((story) => ({
      ...story,
      score: scoreStory(story),
      dateValue: Date.parse(story.pubDate) || 0
    }))
    .filter((story) => story.score >= 5)
    .sort((a, b) => b.dateValue - a.dateValue || b.score - a.score)
    .slice(0, articleCount);
}

function slugFromUrl(url, index) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) || `story-${index + 1}`;
  return slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

function imageExtension(contentType, url) {
  if (/png/i.test(contentType)) return ".png";
  if (/gif/i.test(contentType)) return ".gif";
  if (/webp/i.test(contentType)) return ".webp";
  if (/jpe?g/i.test(contentType)) return ".jpg";
  const pathname = new URL(url).pathname;
  return path.extname(pathname).match(/^\.(png|gif|webp|jpe?g)$/i)?.[0] || ".jpg";
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "gold-ai-website-feed-updater/1.0" },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function downloadImage(story, index) {
  if (!story.imageUrl) {
    return fallbackImages[index % fallbackImages.length];
  }

  const response = await fetch(story.imageUrl, {
    headers: { "user-agent": "gold-ai-website-feed-updater/1.0" },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    return fallbackImages[index % fallbackImages.length];
  }

  const contentType = response.headers.get("content-type") || "";
  const extension = imageExtension(contentType, story.imageUrl);
  const fileName = `${String(index + 1).padStart(2, "0")}-${slugFromUrl(story.link, index)}${extension}`;
  const relativePath = path.posix.join("assets", "axios-feed", fileName);
  const filePath = path.join(rootDir, relativePath);
  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(filePath, buffer);
  return relativePath;
}

function renderCards(stories) {
  return stories.map((story) => `              <a class="latest-card" href="${escapeHtml(story.link)}" target="_blank" rel="noopener">
                <img class="card-image" src="${escapeHtml(story.image)}" alt="">
                <div class="card-body">
                  <img class="source-logo" src="assets/axios-logo.svg" alt="Axios">
                  <h3>${escapeHtml(story.title)}</h3>
                </div>
              </a>`).join("\n");
}

async function updateIndex(stories) {
  const indexHtml = await readFile(indexPath, "utf8");
  const startMarker = "              <!-- axios-feed:start -->";
  const endMarker = "              <!-- axios-feed:end -->";
  const start = indexHtml.indexOf(startMarker);
  const end = indexHtml.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not find axios-feed markers in index.html");
  }

  const nextHtml = `${indexHtml.slice(0, start + startMarker.length)}\n${renderCards(stories)}\n${indexHtml.slice(end)}`;
  await writeFile(indexPath, nextHtml);
}

async function main() {
  const xml = await fetchText(feedUrl);
  const selectedStories = selectStories(parseItems(xml));

  if (selectedStories.length < articleCount) {
    throw new Error(`Expected ${articleCount} Axios AI stories, found ${selectedStories.length}`);
  }

  await rm(assetDir, { recursive: true, force: true });
  await mkdir(assetDir, { recursive: true });

  const stories = [];
  for (const [index, story] of selectedStories.entries()) {
    stories.push({
      title: story.title,
      link: story.link,
      pubDate: story.pubDate,
      sourceImage: story.imageUrl,
      image: await downloadImage(story, index)
    });
  }

  await updateIndex(stories);
  await writeFile(`${metadataPath}`, `${JSON.stringify({
    feedUrl,
    stories
  }, null, 2)}\n`);

  console.log(`Updated ${stories.length} Axios articles.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
