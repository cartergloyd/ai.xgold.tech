import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const newslettersDir = path.join(rootDir, "newsletters");
const archivePath = path.join(rootDir, "newsletters.html");
const indexPath = path.join(rootDir, "index.html");
const MAX_HOMEPAGE_CARDS = 3;

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter (expected --- block at top of file)");

  const meta = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value;
  }

  return { meta, body: match[2] };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderBlock(block) {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Fenced code block
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    const last = lines[lines.length - 1].trim();
    const inner = lines.slice(1, last === "```" ? -1 : undefined);
    return `          <pre><code>${inner.map((l) => escapeHtml(l)).join("\n")}</code></pre>`;
  }

  const lines = trimmed.split("\n").map((l) => l.trim());

  // List block
  if (lines.every((l) => /^[-*]\s/.test(l))) {
    const items = lines.map((l) => l.replace(/^[-*]\s+/, ""));
    return `          <ul>\n${items.map((item) => `            <li>${renderInline(item)}</li>`).join("\n")}\n          </ul>`;
  }

  // Blockquote
  if (lines.every((l) => l.startsWith(">"))) {
    const content = lines.map((l) => l.replace(/^>\s?/, "")).join(" ");
    return `          <blockquote><p>${renderInline(content)}</p></blockquote>`;
  }

  // Table (at least 2 rows, all containing |)
  const isSeparator = (l) => /^\|?[\s\-:|]+\|/.test(l);
  if (lines.length >= 2 && lines.every((l) => l.includes("|"))) {
    const parseCells = (row) =>
      row.split("|")
        .map((c) => c.trim())
        .filter((_, i, arr) => i > 0 || arr[0] !== "")
        .filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== "");
    const dataRows = lines.filter((l) => !isSeparator(l));
    const [header, ...body] = dataRows;
    const thead = `<thead><tr>${parseCells(header).map((c) => `<th>${renderInline(c)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${body.map((row) => `<tr>${parseCells(row).map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    return `          <table>\n            ${thead}\n            ${tbody}\n          </table>`;
  }

  return `          <p>${renderInline(lines.join(" "))}</p>`;
}

function renderSectionBody(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map(renderBlock)
    .filter(Boolean)
    .join("\n");
}

function parseSections(body) {
  const headerPattern = /^## (.+)$/m;
  const parts = body.split(/^## .+$/m);
  const headers = [...body.matchAll(/^## (.+)$/gm)];

  return headers.map((match, i) => {
    const header = match[1];
    const content = (parts[i + 1] || "").trim();
    const colonIdx = header.indexOf(":");
    const label = colonIdx !== -1 ? header.slice(0, colonIdx).trim() : "";
    const heading = colonIdx !== -1 ? header.slice(colonIdx + 1).trim() : header.trim();
    const isCallout = label.toLowerCase() === "executive question";
    return { label, heading, content, isCallout };
  });
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function issueNumber(issue) {
  return String(issue).padStart(2, "0");
}

function renderIssuePage(meta, sections) {
  const imageHtml = meta.image
    ? `\n        <img class="issue-visual" src="${escapeHtml(meta.image)}" alt="${escapeHtml(meta.imageAlt || "")}">`
    : "";

  const sectionHtml = sections
    .map(({ label, heading, content, isCallout }) => {
      const cls = isCallout ? "issue-section callout" : "issue-section";
      return `
        <section class="${cls}">
          ${label ? `<span>${escapeHtml(label)}</span>` : ""}
          <h2>${escapeHtml(heading)}</h2>
${renderSectionBody(content)}
        </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(meta.title)} | goldAI Newsletter</title>
    <meta name="description" content="${escapeHtml(meta.description || meta.title)}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:opsz,wght@9..144,700;9..144,800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="newsletter.css">
    <link rel="stylesheet" href="footer.css">
  </head>
  <body>
    <main class="newsletter-page issue-page">
      <nav class="newsletter-ribbon" aria-label="Primary navigation">
        <a class="wordmark" href="index.html">goldAI</a>
        <div class="ribbon-links">
          <a href="index.html">Home</a>
          <a href="newsletters.html">Newsletters</a>
          <a class="contact-button" href="contact.html">Contact Us</a>
        </div>
      </nav>

      <article class="newsletter-article">
        <header class="issue-header">
          <span>Workflow Notes / Issue ${issueNumber(meta.issue)}</span>
          <h1>${escapeHtml(meta.title)}</h1>
          ${meta.date ? `<time datetime="${escapeHtml(meta.date)}">${formatDate(meta.date)}</time>` : ""}
        </header>${imageHtml}
${sectionHtml}

        <form class="subscribe-widget" action="mailto:hello@goldai.com" method="post" enctype="text/plain">
          <div>
            <span>Subscribe</span>
            <h2>Get the GoldAI Dispatch.</h2>
            <p>Short operating notes for leaders turning AI from pilots into workflow infrastructure.</p>
          </div>
          <label>
            Email
            <span class="subscribe-row">
              <input type="email" name="email" autocomplete="email" placeholder="you@company.com" required>
              <button type="submit">Subscribe</button>
            </span>
          </label>
        </form>

        <section class="issue-actions" aria-label="Newsletter actions">
          <a href="newsletters.html">View archive</a>
          <a href="contact.html">Discuss a workflow</a>
        </section>
      </article>
    </main>

    <footer class="site-footer">
      <div class="footer-inner">
        <section class="footer-column">
          <h2>What we do</h2>
          <a href="approach.html">Our approach</a>
          <a href="industries.html">Industries</a>
          <a href="contact.html">Contact</a>
        </section>
        <section class="footer-column">
          <h2>Our thinking</h2>
          <a href="approach.html">Workflow architecture</a>
          <a href="newsletters.html">Newsletters</a>
          <a href="index.html#latest-title">Articles</a>
          <a href="index.html#latest-title">Insights</a>
        </section>
        <section class="footer-column">
          <h2>Careers</h2>
          <a href="team.html">The team</a>
          <a href="apply.html">Apply now</a>
        </section>
      </div>
      <div class="footer-bottom">
        <span>goldAI</span>
        <span>Intelligence. Embedded. Guaranteed.</span>
      </div>
    </footer>
  </body>
</html>
`;
}

function renderFeaturedCard(issue) {
  const img = issue.meta.image
    ? `\n          <img src="${escapeHtml(issue.meta.image)}" alt="${escapeHtml(issue.meta.imageAlt || "")}">`
    : "";
  return `        <a class="issue-card featured" href="${escapeHtml(issue.outputFile)}">${img}
          <div>
            <span>Issue ${issueNumber(issue.meta.issue)} &mdash; ${escapeHtml(formatDate(issue.meta.date || ""))}</span>
            <h2>${escapeHtml(issue.meta.title)}</h2>
            <p>${escapeHtml(issue.meta.description || "")}</p>
          </div>
        </a>`;
}

function renderArchiveCard(issue) {
  return `          <a class="issue-card" href="${escapeHtml(issue.outputFile)}">
            <div>
              <span>Issue ${issueNumber(issue.meta.issue)} &mdash; ${escapeHtml(formatDate(issue.meta.date || ""))}</span>
              <h2>${escapeHtml(issue.meta.title)}</h2>
              <p>${escapeHtml(issue.meta.description || "")}</p>
            </div>
          </a>`;
}

async function updateArchive(issues) {
  const archiveHtml = await readFile(archivePath, "utf8");

  const featuredStart = "        <!-- newsletters:featured:start -->";
  const featuredEnd = "        <!-- newsletters:featured:end -->";
  const archiveStart = "          <!-- newsletters:archive:start -->";
  const archiveEnd = "          <!-- newsletters:archive:end -->";

  const [mostRecent, ...older] = issues;

  let updated = archiveHtml;

  if (updated.includes(featuredStart) && updated.includes(featuredEnd)) {
    const s = updated.indexOf(featuredStart);
    const e = updated.indexOf(featuredEnd);
    updated = `${updated.slice(0, s + featuredStart.length)}\n${renderFeaturedCard(mostRecent)}\n${updated.slice(e)}`;
  }

  if (updated.includes(archiveStart) && updated.includes(archiveEnd)) {
    const s = updated.indexOf(archiveStart);
    const e = updated.indexOf(archiveEnd);
    const cards = older.length > 0
      ? older.map(renderArchiveCard).join("\n")
      : "          <p class=\"muted\">More issues coming soon.</p>";
    updated = `${updated.slice(0, s + archiveStart.length)}\n${cards}\n${updated.slice(e)}`;
  }

  await writeFile(archivePath, updated);
}

function renderHomepageCard(issue) {
  const img = issue.meta.image
    ? `\n                <img class="card-image" src="${escapeHtml(issue.meta.image)}" alt="${escapeHtml(issue.meta.imageAlt || "")}">`
    : "";
  return `              <a class="latest-card" href="${escapeHtml(issue.outputFile)}">${img}
                <div class="card-body">
                  <span>Newsletter / Issue ${issueNumber(issue.meta.issue)}</span>
                  <h3>${escapeHtml(issue.meta.title)}</h3>
                </div>
              </a>`;
}

function injectBetweenMarkers(html, startMarker, endMarker, content) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker);
  if (s === -1 || e === -1 || e <= s) return html;
  return `${html.slice(0, s + startMarker.length)}\n${content}\n${html.slice(e)}`;
}

async function updateHomepage(issues) {
  let html = await readFile(indexPath, "utf8");

  const mostRecent = issues[0];
  const homepageIssues = issues.slice(0, MAX_HOMEPAGE_CARDS);

  // Update the newsletter cards in the Insights column
  html = injectBetweenMarkers(
    html,
    "              <!-- newsletters:homepage:start -->",
    "              <!-- newsletters:homepage:end -->",
    homepageIssues.map(renderHomepageCard).join("\n")
  );

  // Update the nav link to point to the latest issue
  html = html.replace(
    /<!-- newsletters:nav:start -->.*?<!-- newsletters:nav:end -->/s,
    `<!-- newsletters:nav:start --><a href="${escapeHtml(mostRecent.outputFile)}">Latest Newsletter</a><!-- newsletters:nav:end -->`
  );

  // Update the footer link to point to the latest issue
  html = html.replace(
    /<!-- newsletters:footer:start -->.*?<!-- newsletters:footer:end -->/s,
    `<!-- newsletters:footer:start --><a href="${escapeHtml(mostRecent.outputFile)}">Latest newsletter</a><!-- newsletters:footer:end -->`
  );

  await writeFile(indexPath, html);
}

async function main() {
  const files = (await readdir(newslettersDir))
    .filter((f) => f.endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.log("No markdown files found in newsletters/");
    return;
  }

  const issues = [];

  for (const file of files) {
    const source = await readFile(path.join(newslettersDir, file), "utf8");
    const { meta, body } = parseFrontmatter(source);

    if (!meta.issue || !meta.title) {
      throw new Error(`${file}: frontmatter must include 'issue' and 'title'`);
    }

    const slug = meta.slug || `newsletter-${issueNumber(meta.issue)}`;
    const outputFile = `${slug}.html`;
    const sections = parseSections(body);
    const html = renderIssuePage(meta, sections);

    await writeFile(path.join(rootDir, outputFile), html);
    console.log(`  Built ${outputFile}`);

    issues.push({ meta, outputFile });
  }

  // Sort newest first (by issue number descending)
  issues.sort((a, b) => Number(b.meta.issue) - Number(a.meta.issue));

  await updateArchive(issues);
  console.log(`  Updated newsletters.html archive (${issues.length} issue${issues.length === 1 ? "" : "s"})`);

  await updateHomepage(issues);
  console.log(`  Updated index.html homepage (${Math.min(issues.length, MAX_HOMEPAGE_CARDS)} card${Math.min(issues.length, MAX_HOMEPAGE_CARDS) === 1 ? "" : "s"})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
