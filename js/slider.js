// Sliding hero. The active slide's video plays; when it ends, the track slides to the next
// slide and loops after the last. A slide whose video is missing or fails shows the monogram
// for data-duration seconds instead. Swipe, the dots, or a click on a neighbour moves it by hand.
// Pauses when off screen or in a background tab. Starts paused under prefers-reduced-motion.
(() => {
  const slider = document.querySelector("[data-slider]");
  if (!slider) return;

  const track = slider.querySelector(".slider-track");
  const viewport = slider.querySelector(".slider-viewport");
  const slides = Array.from(slider.querySelectorAll(".slide"));
  const dotsWrap = slider.querySelector(".slider-dots");
  const toggle = slider.querySelector(".slider-toggle");
  const caption = slider.querySelector(".slider-caption");
  const title = slider.querySelector(".slider-title");
  const desc = slider.querySelector(".slider-desc");
  if (!track || !slides.length || !dotsWrap || !toggle) return;

  const DEFAULT_SECONDS = 6;
  let index = 0;
  let userPaused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let inView = true;
  let elapsed = 0;
  let last = 0;
  let frame = 0;
  let swiped = false;

  const videoOf = (slide) => slide.querySelector("video");
  const durationOf = (slide) => (parseFloat(slide.dataset.duration) || DEFAULT_SECONDS) * 1000;
  const isPlaying = () => !userPaused && inView && !document.hidden;

  if (slides.length < 2) dotsWrap.hidden = true;

  const dots = slides.map((slide, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "slider-dot";
    dot.setAttribute("aria-label", `Show ${slide.dataset.title || `demo ${i + 1}`}`);
    dot.innerHTML = '<span class="slider-dot-track"><span class="slider-dot-fill"></span></span>';
    dot.addEventListener("click", () => go(i));
    dotsWrap.append(dot);
    return dot;
  });

  slides.forEach((slide, i) => {
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${i + 1} of ${slides.length}`);
    slide.addEventListener("click", () => {
      if (swiped) {
        swiped = false;
        return;
      }
      if (i !== index) go(i);
    });

    const video = videoOf(slide);
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("ended", () => {
      if (slides[index] === slide) go(index + 1);
    });

    // Missing or unplayable file: drop the video so the placeholder shows and the timer runs.
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
    track.style.setProperty("--index", index);
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
    slider.classList.toggle("is-paused", userPaused);
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

  // Swipe left or right to move one slide.
  let startX = null;
  viewport.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
  });
  viewport.addEventListener("pointerup", (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 48) {
      // The click that follows a swipe must not move the slider back.
      swiped = true;
      setTimeout(() => {
        swiped = false;
      }, 0);
      go(index + (dx < 0 ? 1 : -1));
    }
  });
  viewport.addEventListener("pointercancel", () => {
    startX = null;
  });

  document.addEventListener("visibilitychange", sync);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.25 }).observe(viewport);
  }

  slider.classList.add("is-ready");
  go(0);
})();
