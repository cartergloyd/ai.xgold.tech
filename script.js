/* ── Menu toggle ─────────────────────────────────────────────────── */
const menuButton = document.querySelector(".menu-button");
const siteMenu = document.querySelector("#site-menu");

menuButton.addEventListener("click", () => {
  const isOpen = siteMenu.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

siteMenu.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    siteMenu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  }
});


/* ── Carousel cards ──────────────────────────────────────────────────
   Axios articles are auto-updated by scripts/update-axios-feed.mjs.
   Own content (newsletters, deliverables, case studies) is managed
   manually in OWN_CARDS below.
   ─────────────────────────────────────────────────────────────────── */

/* axios-cards:start */
const AXIOS_CARDS = [
  {
    title: "China's new open-source model accelerates AI hacking threat",
    source: "Axios",
    href: "https://www.axios.com/2026/06/25/china-glm-52-open-source-hackers",
    img: "assets/axios-feed/01-china-glm-52-open-source-hackers.jpg",
    alt: "",
    external: true,
  },
  {
    title: "Water joins energy as top AI flashpoint",
    source: "Axios",
    href: "https://www.axios.com/2026/06/25/water-energy-ai-flashpoint",
    img: "assets/axios-feed/02-water-energy-ai-flashpoint.jpg",
    alt: "",
    external: true,
  },
  {
    title: "Exclusive: Codex agents are inching into the mainstream",
    source: "Axios",
    href: "https://www.axios.com/2026/06/25/codex-agents-growth-openai",
    img: "assets/axios-feed/03-codex-agents-growth-openai.jpg",
    alt: "",
    external: true,
  },
  {
    title: "Chamath Palihapitiya rejects the AI jobs apocalypse",
    source: "Axios",
    href: "https://www.axios.com/2026/06/24/chamath-palihapitiya-future-of-work-ai",
    img: "assets/axios-feed/04-chamath-palihapitiya-future-of-work-ai.png",
    alt: "",
    external: true,
  },
  {
    title: "Investors may be hitting pause on the AI run-up",
    source: "Axios",
    href: "https://www.axios.com/2026/06/24/ai-stocks-chips-selloff",
    img: "assets/axios-feed/05-ai-stocks-chips-selloff.png",
    alt: "",
    external: true,
  },
];
/* axios-cards:end */

/* ── Own content cards ───────────────────────────────────────────────
   Add newsletter, deliverable, and case study cards here manually.
   Use source labels: "Newsletter / Issue NN", "Deliverable / Issue NN",
   "Research / Issue NN", or "Case Study".
   ─────────────────────────────────────────────────────────────────── */
const OWN_CARDS = [
  {
    title: "One engineer's workload, zero new hires.",
    source: "Deliverable / Issue 02",
    href: "workflow-notes-02.html",
    img: "assets/enterprise-command-center.png",
    alt: "Abstract enterprise command center with infrastructure monitoring signals",
    external: false,
  },
  {
    title: "Turn AI pilots into operating capacity.",
    source: "Newsletter / Issue 01",
    href: "workflow-notes-01.html",
    img: "assets/latest-workflows.png",
    alt: "Abstract enterprise workflow architecture with gold automation paths",
    external: false,
  },
  {
    title: "The metrics that prove automation is working after launch.",
    source: "Case Study",
    href: "#",
    img: "assets/latest-roi.png",
    alt: "Executive analytics environment showing abstract AI ROI signals",
    external: false,
  },
];

/* ── Carousel ────────────────────────────────────────────────────────

   HOW THE SEAMLESS LOOP WORKS
   ────────────────────────────
   1. CAROUSEL_CARDS is rendered twice into #carousel-track (set A then
      set B), producing a flex row like: [A₁ A₂ … Aₙ | B₁ B₂ … Bₙ].

   2. The CSS keyframe `carousel-scroll` animates the track from
      translateX(0) to translateX(-50%). Because the track is
      `width: max-content` (two sets wide), -50% = exactly one set's
      pixel width.

   3. When the animation loops back to 0% the browser resets instantly —
      but set B is now in the exact same position set A began. The eye
      sees no jump; the stream appears infinite.

   4. Cards use `margin-right` instead of a flex `gap` so the spacing
      between the last card of set A and B₁ matches every other inter-
      card gap, eliminating a visible seam at the join point.

   5. Set B cards carry aria-hidden="true" and tabIndex=-1 so screen
      readers and keyboard users only encounter each card once.
   ─────────────────────────────────────────────────────────────────── */
const CAROUSEL_CARDS = [...AXIOS_CARDS, ...OWN_CARDS];

function buildCarouselCard(card, isDuplicate) {
  const a = document.createElement("a");
  a.className = "carousel-card";
  a.href = card.href;
  a.setAttribute("role", "listitem");

  if (card.external) {
    a.target = "_blank";
    a.rel = "noopener";
  }

  // Duplicate set: hidden from screen readers and tab order
  if (isDuplicate) {
    a.setAttribute("aria-hidden", "true");
    a.tabIndex = -1;
  }

  a.innerHTML =
    `<div class="carousel-card-img-wrap">` +
    `<img class="carousel-card-img" src="${card.img}" alt="${card.alt}" loading="lazy" decoding="async">` +
    `</div>` +
    `<div class="carousel-card-meta">` +
    `<span class="carousel-card-title">${card.title}</span>` +
    `<span class="carousel-card-source">${card.source}</span>` +
    `</div>`;

  return a;
}

/* ── Careers form ────────────────────────────────────────────────────
   POSTs { email, resume } as multipart/form-data to /api/apply on the
   goldAI server. Set window.GOLDAI_API before script.js loads to point
   at the deployed server; falls back to http://localhost:3001.
   ─────────────────────────────────────────────────────────────────── */
(function () {
  const form = document.getElementById("careers-form");
  const confirmation = document.getElementById("careers-confirmation");
  if (!form || !confirmation) return;

  const emailInput  = form.querySelector(".careers-input");
  const fileInput   = form.querySelector(".careers-file");
  const uploadLabel = form.querySelector(".careers-upload-label");
  const submitBtn   = form.querySelector(".careers-submit");

  const API = (typeof window.GOLDAI_API === "string"
    ? window.GOLDAI_API
    : "http://localhost:3001"
  ).replace(/\/$/, "");

  // Show selected filename in the upload button
  fileInput.addEventListener("change", () => {
    uploadLabel.textContent = fileInput.files[0] ? fileInput.files[0].name : "Upload résumé";
  });

  emailInput.addEventListener("input", () => {
    emailInput.classList.remove("is-invalid");
  });

  function showConfirmation() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      form.style.display = "none";
      confirmation.style.display = "block";
      return;
    }

    // Phase 1: form fades + slides up
    form.style.transition =
      "opacity 400ms cubic-bezier(0.25, 0.1, 0.25, 1), transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1)";
    form.style.opacity = "0";
    form.style.transform = "translateY(-14px)";

    setTimeout(() => {
      form.style.display = "none";
      confirmation.style.opacity = "0";
      confirmation.style.transform = "translateY(14px)";
      confirmation.style.display = "block";

      void confirmation.offsetHeight;

      // Phase 2: confirmation fades up into place
      confirmation.style.transition =
        "opacity 500ms cubic-bezier(0.25, 0.1, 0.25, 1), transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1)";
      confirmation.style.opacity = "1";
      confirmation.style.transform = "translateY(0)";
    }, 420);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.classList.add("is-invalid");
      emailInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const fd = new FormData();
    fd.append("email", email);
    if (fileInput.files[0]) fd.append("resume", fileInput.files[0]);

    fetch(API + "/api/apply", { method: "POST", body: fd })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        showConfirmation();
      })
      .catch(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = "Apply";
      });
  });
})();

/* ── Carousel render ─────────────────────────────────────────────── */
const track = document.getElementById("carousel-track");
if (track && CAROUSEL_CARDS.length > 0) {
  // Set A — real cards, accessible
  CAROUSEL_CARDS.forEach((card) => track.appendChild(buildCarouselCard(card, false)));
  // Set B — duplicates for seamless loop, hidden from assistive tech
  CAROUSEL_CARDS.forEach((card) => track.appendChild(buildCarouselCard(card, true)));
}


/* ── Video carousel ──────────────────────────────────────────────────

   Same seamless-loop mechanic as the article carousel above.
   Playlist data is auto-updated by scripts/update-youtube-feed.mjs.
   ─────────────────────────────────────────────────────────────────── */

/* youtube-cards:start */
const VIDEO_CARDS = [
  {
    videoId: "yyvVUEPSCu0",
    title: "Introducing workspace agents in ChatGPT",
    source: "ChatGPT Workspace Agents",
  },
  {
    videoId: "-UN9sNqQ0t4",
    title: "AI Fluency: Framework & Foundations Course Trailer",
    source: "AI Fluency Course",
  },
  {
    videoId: "bk2H8WfHZZk",
    title: "Product feedback routing agent",
    source: "ChatGPT Workspace Agents",
  },
  {
    videoId: "JpGtOfSgR-c",
    title: "Lesson 1: Introduction to AI Fluency",
    source: "AI Fluency Course",
  },
  {
    videoId: "HJlME6S-LJc",
    title: "Lead outreach agent",
    source: "ChatGPT Workspace Agents",
  },
  {
    videoId: "4szRHy_CT7s",
    title: "Lesson 2A: Why do we need AI Fluency?",
    source: "AI Fluency Course",
  },
  {
    videoId: "HnSPedbA02Q",
    title: "Third-party risk management agent",
    source: "ChatGPT Workspace Agents",
  },
  {
    videoId: "W4Ua6XFfX9w",
    title: "Lesson 2B: The 4D Framework",
    source: "AI Fluency Course",
  },
  {
    videoId: "7ZVYmoqqnCg",
    title: "Software review agent",
    source: "ChatGPT Workspace Agents",
  },
  {
    videoId: "RyvXxApfHkk",
    title: "Lesson 3A: What is generative AI? (Deep Dive)",
    source: "AI Fluency Course",
  },
  {
    videoId: "H5rSp32VwV8",
    title: "Weekly metrics reporting agent",
    source: "ChatGPT Workspace Agents",
  },
  {
    videoId: "W5cga7xipRI",
    title: "Lesson 3B: Capabilities & limitations",
    source: "AI Fluency Course",
  },
  {
    videoId: "HaaKUFAOi84",
    title: "Admin and builder controls",
    source: "ChatGPT Workspace Agents",
  },
  {
    videoId: "EljzyfdYkrc",
    title: "Lesson 4: A closer look at Delegation",
    source: "AI Fluency Course",
  },
  {
    videoId: "DmgujoZ1mmk",
    title: "Lesson 6: A closer look at Description",
    source: "AI Fluency Course",
  },
  {
    videoId: "2YCaBqP8muw",
    title: "Lesson 7: Effective prompting techniques (Deep Dive)",
    source: "AI Fluency Course",
  },
  {
    videoId: "Y0KidGr9Z2Y",
    title: "Lesson 8: A closer look at Discernment",
    source: "AI Fluency Course",
  },
  {
    videoId: "QbLf2zb3oPc",
    title: "Lesson 10: A closer look at Diligence",
    source: "AI Fluency Course",
  },
  {
    videoId: "ytEN_iAk09c",
    title: "Lesson 11: Conclusion",
    source: "AI Fluency Course",
  },
];
/* youtube-cards:end */

const PLAY_ICON =
  `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
  `<circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.52)"/>` +
  `<path d="M20 15.5l15 8.5-15 8.5V15.5z" fill="white"/>` +
  `</svg>`;

function buildVideoCard(video, isDuplicate) {
  const a = document.createElement("a");
  a.className = "video-card";
  a.href = `https://www.youtube.com/watch?v=${video.videoId}`;
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("role", "listitem");

  if (isDuplicate) {
    a.setAttribute("aria-hidden", "true");
    a.tabIndex = -1;
  }

  a.innerHTML =
    `<div class="video-card-img-wrap">` +
    `<img class="video-card-img" src="https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg" alt="${video.title}" loading="eager" decoding="async">` +
    `<div class="video-card-play">${PLAY_ICON}</div>` +
    `</div>` +
    `<div class="video-card-meta">` +
    `<span class="video-card-title">${video.title}</span>` +
    `<span class="video-card-source">${video.source}</span>` +
    `</div>`;

  return a;
}

const videoTrack = document.getElementById("video-carousel-track");
if (videoTrack && VIDEO_CARDS.length > 0) {
  VIDEO_CARDS.forEach((v) => videoTrack.appendChild(buildVideoCard(v, false)));
  VIDEO_CARDS.forEach((v) => videoTrack.appendChild(buildVideoCard(v, true)));
}
