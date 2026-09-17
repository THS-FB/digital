(() => {
  const BUILD_ID = "2026-09-17-touchpan2";
  const PDF_URL = "../assets/program/current-program.pdf";
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  const PAGEFLIP_URL = "https://cdn.jsdelivr.net/gh/SAILgaosai/StPageFlip@d4ed7d4/dist/js/page-flip.browser.js";

  const shell = document.querySelector(".flipbook-shell");
  const stage = document.getElementById("flipbook-stage");
  const book = document.getElementById("flipbook");
  const coverPreview = document.getElementById("flipbook-cover-preview");
  const status = document.getElementById("flipbook-status");
  const statusText = document.getElementById("flipbook-status-text");
  const errorBox = document.getElementById("flipbook-error");
  const prevButton = document.getElementById("flipbook-prev");
  const nextButton = document.getElementById("flipbook-next");
  const counter = document.getElementById("flipbook-page-counter");
  const fullscreenButton = document.getElementById("flipbook-fullscreen");
  const downloadLink = document.getElementById("flipbook-download");

  if (!shell || !stage || !book) return;

  const touchDrivenMobile = window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
  const viewportScale = () => (window.visualViewport ? window.visualViewport.scale || 1 : 1);
  const nativeFullscreenElement = () =>
    document.fullscreenElement || document.webkitFullscreenElement || null;
  const viewerIsFullscreen = () =>
    shell.classList.contains("is-faux-fullscreen") || nativeFullscreenElement() === shell;

  let pageFlip = null;
  let totalPages = 0;
  let dimensions = null;
  const renderedPages = new Set();
  const renderingPages = new Map();

  /*
    Mobile touch model:
      - one finger at normal zoom: horizontal swipe turns the page
      - two fingers: native iOS pinch zoom
      - one finger after zooming: drag/pan the PDF inside fullscreen

    StPageFlip's built-in touch handling stays disabled on touch devices so a
    second finger cannot accidentally finish a page turn during a pinch.
  */
  let touchMode = "idle";
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let panX = 0;
  let panY = 0;
  let panStartX = 0;
  let panStartY = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const panLimits = () => {
    const zoom = Math.max(1, viewportScale());
    const extra = Math.max(0, zoom - 1);
    return {
      x: Math.max(0, stage.clientWidth * extra * 0.72),
      y: Math.max(0, stage.clientHeight * extra * 0.72)
    };
  };

  const applyPanTransform = () => {
    if (!viewerIsFullscreen() || viewportScale() <= 1.02) {
      book.style.removeProperty("transform");
      return;
    }

    book.style.transform =
      `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0) ` +
      "scale(var(--flipbook-fullscreen-scale, 1))";
  };

  const resetPan = () => {
    panX = 0;
    panY = 0;
    panStartX = 0;
    panStartY = 0;
    book.style.removeProperty("transition");
    book.style.removeProperty("transform");
  };

  const resetTouchGesture = () => {
    touchMode = "idle";
    touchStartX = 0;
    touchStartY = 0;
    touchStartTime = 0;
    book.style.removeProperty("transition");
  };

  const beginPan = (touch) => {
    touchMode = "pan";
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    panStartX = panX;
    panStartY = panY;
    book.style.transition = "none";
  };

  const startTouchGesture = (event) => {
    if (!touchDrivenMobile) return;

    if (event.touches && event.touches.length >= 2) {
      touchMode = "pinch";
      book.style.removeProperty("transition");
      return;
    }

    if (!event.touches || event.touches.length !== 1) return;

    const touch = event.touches[0];

    if (viewerIsFullscreen() && viewportScale() > 1.02) {
      beginPan(touch);
      return;
    }

    touchMode = "swipe";
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
  };

  const moveTouchGesture = (event) => {
    if (!touchDrivenMobile) return;

    if (event.touches && event.touches.length >= 2) {
      touchMode = "pinch";
      book.style.removeProperty("transition");
      return;
    }

    if (!event.touches || event.touches.length !== 1) return;

    const touch = event.touches[0];

    // If the browser reports that the viewport has become zoomed while a
    // one-finger gesture is still active, switch immediately into pan mode.
    if (viewerIsFullscreen() && viewportScale() > 1.02 && touchMode !== "pan") {
      beginPan(touch);
      return;
    }

    if (touchMode !== "pan") return;

    // Native one-finger panning does not move a fixed faux-fullscreen element
    // consistently on iPhone, so we pan the book itself after pinch zoom.
    event.preventDefault();

    const limits = panLimits();
    panX = clamp(panStartX + (touch.clientX - touchStartX), -limits.x, limits.x);
    panY = clamp(panStartY + (touch.clientY - touchStartY), -limits.y, limits.y);
    applyPanTransform();
  };

  const finishTouchGesture = (event) => {
    if (!touchDrivenMobile) return;

    // iOS sends touchend once per finger. When one finger remains after a
    // pinch, immediately hand that remaining finger off to pan mode so the
    // user does not have to lift both fingers and touch the screen again.
    if (touchMode === "pinch" && event.touches && event.touches.length === 1) {
      if (viewerIsFullscreen() && viewportScale() > 1.02) {
        beginPan(event.touches[0]);
      }
      return;
    }

    if (event.touches && event.touches.length > 0) return;

    if (touchMode === "pan") {
      resetTouchGesture();
      return;
    }

    if (touchMode !== "swipe" || viewportScale() > 1.02 || !pageFlip) {
      resetTouchGesture();
      return;
    }

    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) {
      resetTouchGesture();
      return;
    }

    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    const isIntentionalSwipe =
      horizontalDistance >= 52 &&
      horizontalDistance > verticalDistance * 1.35 &&
      elapsed <= 900;

    if (isIntentionalSwipe) {
      if (deltaX < 0) pageFlip.flipNext();
      else pageFlip.flipPrev();
    }

    resetTouchGesture();
  };

  const cancelTouchGesture = () => resetTouchGesture();
  const markNativePinch = () => {
    touchMode = "pinch";
    book.style.removeProperty("transition");
  };

  if (touchDrivenMobile) {
    stage.style.touchAction = "pan-x pan-y pinch-zoom";
    book.style.touchAction = "pan-x pan-y pinch-zoom";

    stage.addEventListener("touchstart", startTouchGesture, { passive: true });
    stage.addEventListener("touchmove", moveTouchGesture, { passive: false });
    stage.addEventListener("touchend", finishTouchGesture, { passive: true });
    stage.addEventListener("touchcancel", cancelTouchGesture, { passive: true });

    stage.addEventListener("gesturestart", markNativePinch, { passive: true });
    stage.addEventListener("gesturechange", markNativePinch, { passive: true });
    stage.addEventListener("gestureend", () => {
      if (viewportScale() <= 1.02) resetPan();
    }, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        if (viewportScale() <= 1.02) {
          resetPan();
        } else if (viewerIsFullscreen()) {
          const limits = panLimits();
          panX = clamp(panX, -limits.x, limits.x);
          panY = clamp(panY, -limits.y, limits.y);
          applyPanTransform();
        }
      }, { passive: true });
    }

    document.addEventListener("fullscreenchange", () => {
      if (!viewerIsFullscreen()) resetPan();
    });
    document.addEventListener("webkitfullscreenchange", () => {
      if (!viewerIsFullscreen()) resetPan();
    });

    const shellClassObserver = new MutationObserver(() => {
      if (!viewerIsFullscreen()) resetPan();
    });
    shellClassObserver.observe(shell, { attributes: true, attributeFilter: ["class"] });
  }

  book.classList.add("is-initializing");

  const nextFrame = () => new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  const settleInitialLayout = async () => {
    await nextFrame();
    await nextFrame();
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  };

  const showStatus = (message) => {
    if (statusText) statusText.textContent = message;
    if (status) status.hidden = false;
  };

  const hideStatus = () => {
    if (status) status.hidden = true;
  };

  const revealInteractiveBook = async () => {
    await settleInitialLayout();

    const wrapper = book.querySelector(".stf__wrapper");
    const parent = book.querySelector(".stf__parent");

    if (wrapper && book.classList.contains("is-front-cover")) {
      wrapper.classList.add("flipbook-cover-centered");
    }

    if (touchDrivenMobile) {
      if (wrapper) wrapper.style.touchAction = "pan-x pan-y pinch-zoom";
      if (parent) parent.style.touchAction = "pan-x pan-y pinch-zoom";
    }

    await settleInitialLayout();
    book.classList.remove("is-initializing");
    if (coverPreview) coverPreview.hidden = true;
  };

  const showError = (message) => {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.classList.add("is-visible");
    }
    book.classList.remove("is-initializing");
    if (coverPreview) coverPreview.hidden = true;
    hideStatus();
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${src}?v=${encodeURIComponent(BUILD_ID)}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Unable to load StPageFlip from ${src}`));
    document.head.appendChild(script);
  });

  const updateCounter = (pageIndex = 0) => {
    if (!totalPages) {
      if (counter) counter.textContent = "0 / 0";
      book.classList.remove("is-front-cover");
      return;
    }

    const pageNumber = Math.min(pageIndex + 1, totalPages);

    if (counter) counter.textContent = `${pageNumber} / ${totalPages}`;
    if (prevButton) prevButton.disabled = pageIndex <= 0;
    if (nextButton) nextButton.disabled = pageIndex >= totalPages - 1;

    book.classList.toggle("is-front-cover", pageIndex === 0);
  };

  const getBookDimensions = (firstViewport) => {
    const maxStageWidth = Math.max(stage.clientWidth - 16, 280);
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const spreadWidth = mobile ? maxStageWidth : maxStageWidth / 2;
    const ratio = firstViewport.height / firstViewport.width;
    const pageWidth = Math.floor(Math.min(spreadWidth, 560));
    const pageHeight = Math.floor(pageWidth * ratio);

    return {
      pageWidth: Math.max(pageWidth, 240),
      pageHeight: Math.max(pageHeight, 320)
    };
  };

  const renderLinkLayer = async (pdfPage, viewport, layer) => {
    const annotations = await pdfPage.getAnnotations({ intent: "display" });

    annotations.forEach((annotation) => {
      if (annotation.subtype !== "Link" || !annotation.rect) return;

      const rect = viewport.convertToViewportRectangle(annotation.rect);
      const left = Math.min(rect[0], rect[2]);
      const top = Math.min(rect[1], rect[3]);
      const width = Math.abs(rect[2] - rect[0]);
      const height = Math.abs(rect[3] - rect[1]);

      const link = document.createElement("a");
      link.className = "pdf-link";
      link.style.left = `${(left / viewport.width) * 100}%`;
      link.style.top = `${(top / viewport.height) * 100}%`;
      link.style.width = `${(width / viewport.width) * 100}%`;
      link.style.height = `${(height / viewport.height) * 100}%`;
      link.setAttribute("aria-label", annotation.title || "Open link");

      if (annotation.url) {
        link.href = annotation.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else if (annotation.dest) {
        link.href = "#";
        link.addEventListener("click", (event) => event.preventDefault());
      } else {
        return;
      }

      layer.appendChild(link);
    });
  };

  const createPageShells = () => {
    const fragment = document.createDocumentFragment();

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = document.createElement("div");
      page.className = "flip-page";
      page.dataset.density = "soft";
      page.dataset.pageNumber = String(pageNumber);
      page.style.width = `${dimensions.pageWidth}px`;
      page.style.height = `${dimensions.pageHeight}px`;
      page.setAttribute("aria-label", `Program page ${pageNumber}`);

      const canvas = document.createElement("canvas");
      canvas.className = "flip-page-canvas";
      canvas.setAttribute("aria-hidden", "true");

      const linkLayer = document.createElement("div");
      linkLayer.className = "pdf-link-layer";

      page.append(canvas, linkLayer);
      fragment.appendChild(page);
    }

    book.replaceChildren(fragment);
  };

  const renderPage = (pdf, pageNumber) => {
    if (renderedPages.has(pageNumber)) return Promise.resolve();
    if (renderingPages.has(pageNumber)) return renderingPages.get(pageNumber);

    const task = (async () => {
      const pdfPage = await pdf.getPage(pageNumber);
      const page = book.querySelector(`[data-page-number="${pageNumber}"]`);
      if (!page) throw new Error(`Page shell unavailable for page ${pageNumber}`);

      const canvas = page.querySelector("canvas");
      const linkLayer = page.querySelector(".pdf-link-layer");
      if (!canvas || !linkLayer) throw new Error(`Page elements unavailable for page ${pageNumber}`);

      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const scale = dimensions.pageWidth / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 3);

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error(`Canvas context unavailable for page ${pageNumber}`);

      const renderContext = { canvasContext: context, viewport };
      if (outputScale !== 1) {
        renderContext.transform = [outputScale, 0, 0, outputScale, 0, 0];
      }

      await pdfPage.render(renderContext).promise;
      linkLayer.replaceChildren();
      await renderLinkLayer(pdfPage, viewport, linkLayer);
      page.classList.add("is-rendered");
      renderedPages.add(pageNumber);
    })().finally(() => {
      renderingPages.delete(pageNumber);
    });

    renderingPages.set(pageNumber, task);
    return task;
  };

  const renderRemainingPages = async (pdf) => {
    for (let pageNumber = 4; pageNumber <= totalPages; pageNumber += 1) {
      try {
        await renderPage(pdf, pageNumber);
        await nextFrame();
      } catch (error) {
        console.error(`Background render failed for page ${pageNumber}`, error);
      }
    }
  };

  const preparePdf = async (pdfjsLib) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

    const loadingTask = pdfjsLib.getDocument({
      url: PDF_URL,
      rangeChunkSize: 131072
    });

    const pdf = await loadingTask.promise;
    totalPages = pdf.numPages;

    const firstPage = await pdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1 });
    dimensions = getBookDimensions(firstViewport);
    createPageShells();

    await renderPage(pdf, 1);

    const firstSpread = [];
    if (totalPages >= 2) firstSpread.push(renderPage(pdf, 2));
    if (totalPages >= 3) firstSpread.push(renderPage(pdf, 3));
    await Promise.all(firstSpread);

    return pdf;
  };

  const initializePageFlip = async () => {
    if (!window.St || !window.St.PageFlip) {
      await loadScript(PAGEFLIP_URL);
    }

    if (!window.St || typeof window.St.PageFlip !== "function") {
      throw new Error("StPageFlip browser bundle loaded, but St.PageFlip is unavailable");
    }

    pageFlip = new window.St.PageFlip(book, {
      width: dimensions.pageWidth,
      height: dimensions.pageHeight,
      size: "stretch",
      minWidth: 240,
      maxWidth: dimensions.pageWidth,
      minHeight: 320,
      maxHeight: dimensions.pageHeight,
      maxShadowOpacity: 0.55,
      showCover: true,
      disableHardPages: true,
      firstCoverStartLeft: false,
      mobileScrollSupport: true,
      usePortrait: true,
      autoSize: true,
      drawShadow: true,
      flippingTime: 700,
      useMouseEvents: !touchDrivenMobile
    });

    const htmlLoader =
      (typeof pageFlip.loadFromHTML === "function" && pageFlip.loadFromHTML) ||
      (typeof pageFlip.loadFromHtml === "function" && pageFlip.loadFromHtml);

    if (!htmlLoader) {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(pageFlip)).sort().join(", ");
      throw new Error(`No HTML page loader found on StPageFlip. Available methods: ${methods}`);
    }

    htmlLoader.call(pageFlip, document.querySelectorAll(".flip-page"));
    pageFlip.on("flip", (event) => updateCounter(event.data));
    updateCounter(0);

    if (prevButton) prevButton.addEventListener("click", () => pageFlip.flipPrev());
    if (nextButton) nextButton.addEventListener("click", () => pageFlip.flipNext());

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") pageFlip.flipPrev();
      if (event.key === "ArrowRight") pageFlip.flipNext();
    });

    hideStatus();
    await revealInteractiveBook();
  };

  if (coverPreview) {
    coverPreview.addEventListener("error", () => {
      coverPreview.hidden = true;
      showStatus("Preparing digital program...");
    }, { once: true });
  }

  if (fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await shell.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  document.addEventListener("fullscreenchange", () => {
    if (fullscreenButton) {
      fullscreenButton.setAttribute(
        "aria-pressed",
        document.fullscreenElement ? "true" : "false"
      );
    }
  });

  if (downloadLink) {
    downloadLink.href = PDF_URL;
    downloadLink.download = "Tunstall-2026-Digital-Program.pdf";
  }

  (async () => {
    try {
      hideStatus();
      const pdfjsLib = await import(`${PDFJS_URL}?v=${encodeURIComponent(BUILD_ID)}`);
      const pdf = await preparePdf(pdfjsLib);
      await initializePageFlip();
      void renderRemainingPages(pdf);
    } catch (error) {
      console.error(error);
      const detail = error && error.message ? error.message : String(error);
      showError(`Flipbook build ${BUILD_ID} error: ${detail}`);
    }
  })();
})();
