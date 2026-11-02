// Demo reel: rotates through slides. A slide with a <video> advances when the video ends.
// A slide without one (or whose video fails to load) shows its placeholder for data-duration seconds.
// Pauses when off screen or in a background tab. Starts paused under prefers-reduced-motion.
(() => {
  const reel = document.querySelector("[data-reel]");
  if (!reel) return;

  const slides = Array.from(reel.querySelectorAll(".reel-slide"));
  const dotsWrap = reel.querySelector(".reel-dots");
  const toggle = reel.querySelector(".reel-toggle");
  const caption = reel.querySelector(".reel-caption");
  const title = reel.querySelector(".reel-title");
  const desc = reel.querySelector(".reel-desc");
  if (!slides.length || !dotsWrap || !toggle) return;

  const DEFAULT_SECONDS = 6;
  let index = 0;
  let userPaused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let inView = true;
  let elapsed = 0;
  let last = 0;
  let frame = 0;

  const videoOf = (slide) => slide.querySelector("video");
  const durationOf = (slide) => (parseFloat(slide.dataset.duration) || DEFAULT_SECONDS) * 1000;
  const isPlaying = () => !userPaused && inView && !document.hidden;

  const dots = slides.map((slide, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "reel-dot";
    dot.setAttribute("aria-label", `Show ${slide.dataset.title || `demo ${i + 1}`}`);
    dot.innerHTML = '<span class="reel-dot-track"><span class="reel-dot-fill"></span></span>';
    dot.addEventListener("click", () => go(i));
    dotsWrap.append(dot);
    return dot;
  });

  slides.forEach((slide, i) => {
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${i + 1} of ${slides.length}`);

    const video = videoOf(slide);
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("ended", () => {
      if (slides[index] === slide) go(index + 1);
    });

    // Missing or unplayable file: drop the video so the placeholder shows.
    const fallback = () => {
      video.remove();
      if (slides[index] === slide) {
        elapsed = 0;
        sync();
      }
    };
    video.addEventListener("error", fallback);
    const sources = video.querySelectorAll("source");
    if (sources.length) sources[sources.length - 1].addEventListener("error", fallback);
  });

  function render() {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
      dot.style.removeProperty("--progress");
    });
    if (title) title.textContent = slides[index].dataset.title || "";
    if (desc) desc.textContent = slides[index].dataset.desc || "";
  }

  function go(i) {
    const previous = videoOf(slides[index]);
    if (previous) previous.pause();

    index = (i + slides.length) % slides.length;
    elapsed = 0;

    const video = videoOf(slides[index]);
    if (video) {
      try {
        video.currentTime = 0;
      } catch (_) {
        // Metadata not loaded yet; it starts at 0 anyway.
      }
    }
    render();
    sync();
  }

  function sync() {
    const playing = isPlaying();
    reel.classList.toggle("is-paused", userPaused);
    toggle.setAttribute("aria-label", userPaused ? "Play demos" : "Pause demos");
    // Announce caption changes only when the viewer is driving, not on every auto-advance.
    if (caption) caption.setAttribute("aria-live", userPaused ? "polite" : "off");

    const video = videoOf(slides[index]);
    if (video) {
      if (playing) video.play().catch(() => {});
      else video.pause();
    }

    cancelAnimationFrame(frame);
    if (playing) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    const slide = slides[index];
    const video = videoOf(slide);
    let progress;

    if (video) {
      progress = video.duration ? video.currentTime / video.duration : 0;
    } else {
      elapsed += now - last;
      last = now;
      progress = elapsed / durationOf(slide);
      if (progress >= 1) {
        go(index + 1);
        return;
      }
    }

    dots[index].style.setProperty("--progress", Math.min(progress, 1).toFixed(4));
    frame = requestAnimationFrame(tick);
  }

  toggle.addEventListener("click", () => {
    userPaused = !userPaused;
    sync();
  });

  document.addEventListener("visibilitychange", sync);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.25 }).observe(reel);
  }

  reel.classList.add("is-ready");
  go(0);
})();
