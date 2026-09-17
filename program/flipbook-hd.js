(() => {
  const BUILD_ID = "2026-09-17-hdzoom2";
  const PDF_URL = "../assets/program/current-program.pdf";
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

  const book = document.getElementById("flipbook");
  const counter = document.getElementById("flipbook-page-counter");
  if (!book || !counter) return;

  const renderTasks = new Map();
  let pdfPromise = null;
  let debounceTimer = 0;

  const loadPdf = async () => {
    if (!pdfPromise) {
      pdfPromise = (async () => {
        const pdfjsLib = await import(`${PDFJS_URL}?v=${encodeURIComponent(BUILD_ID)}`);
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjsLib.getDocument({
          url: PDF_URL,
          rangeChunkSize: 131072
        }).promise;
      })();
    }
    return pdfPromise;
  };

  const currentPageNumber = () => {
    const match = String(counter.textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
    return match ? Math.max(1, Number(match[1])) : 1;
  };

  const basePixelRatio = () => {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(3.25, Math.max(2.5, dpr));
  };

  const zoomPixelRatio = () => {
    const dpr = window.devicePixelRatio || 1;
    const viewportScale = window.visualViewport ? window.visualViewport.scale || 1 : 1;
    return Math.min(4.25, Math.max(basePixelRatio(), dpr * viewportScale));
  };

  const renderHdPage = async (pageNumber, requestedRatio) => {
    const pageElement = book.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageElement || !pageElement.classList.contains("is-rendered")) return;

    const liveCanvas = pageElement.querySelector("canvas");
    if (!liveCanvas || !liveCanvas.width || !liveCanvas.height) return;

    const currentRatio = Number(liveCanvas.dataset.hdPixelRatio || 0);
    if (currentRatio >= requestedRatio * 0.94) return;

    const priorTask = renderTasks.get(pageNumber);
    if (priorTask) return;

    const pdf = await loadPdf();
    const pdfPage = await pdf.getPage(pageNumber);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const cssWidth = Math.max(pageElement.offsetWidth, 1);
    const cssScale = cssWidth / baseViewport.width;
    const viewport = pdfPage.getViewport({ scale: cssScale });
    const pixelRatio = Math.min(4.25, Math.max(1, requestedRatio));

    // Render into an offscreen canvas first. This is intentionally different
    // from the original HD pass: resizing the live canvas before rendering
    // clears the visible page on iPhone and can leave a blank sheet if a PDF
    // render is interrupted. The live page is not touched until the HD image
    // is fully finished and ready to swap in synchronously.
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
    offscreen.height = Math.max(1, Math.floor(viewport.height * pixelRatio));

    const offscreenContext = offscreen.getContext("2d", { alpha: false });
    if (!offscreenContext) return;

    const renderTask = pdfPage.render({
      canvasContext: offscreenContext,
      viewport,
      transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
    });

    renderTasks.set(pageNumber, renderTask);

    try {
      await renderTask.promise;

      // If StPageFlip replaced this page while the HD render was running,
      // abandon the swap instead of drawing into a stale canvas.
      const currentCanvas = pageElement.querySelector("canvas");
      if (currentCanvas !== liveCanvas || !pageElement.classList.contains("is-rendered")) return;

      liveCanvas.width = offscreen.width;
      liveCanvas.height = offscreen.height;
      liveCanvas.style.width = "100%";
      liveCanvas.style.height = "100%";

      const liveContext = liveCanvas.getContext("2d", { alpha: false });
      if (!liveContext) return;

      liveContext.drawImage(offscreen, 0, 0);
      liveCanvas.dataset.hdPixelRatio = pixelRatio.toFixed(3);
    } catch (error) {
      if (!error || error.name !== "RenderingCancelledException") {
        console.warn(`HD re-render failed for page ${pageNumber}`, error);
      }
    } finally {
      if (renderTasks.get(pageNumber) === renderTask) {
        renderTasks.delete(pageNumber);
      }
    }
  };

  const sharpenCurrentView = async (useZoomRatio = false) => {
    const current = currentPageNumber();
    const ratio = useZoomRatio ? zoomPixelRatio() : basePixelRatio();
    const allPages = Array.from(
      book.querySelectorAll("[data-page-number]"),
      (node) => Number(node.dataset.pageNumber || 0)
    ).filter(Boolean);

    if (!allPages.length) return;
    const maxPage = Math.max(...allPages);

    // Keep memory use conservative on iPhone. Sharpen the visible page first,
    // then the adjacent page so a normal swipe remains crisp.
    await renderHdPage(current, ratio);

    const adjacent = current < maxPage ? current + 1 : current - 1;
    if (adjacent >= 1) {
      await renderHdPage(adjacent, basePixelRatio());
    }
  };

  const scheduleSharpen = (useZoomRatio = false, delay = 180) => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void sharpenCurrentView(useZoomRatio);
    }, delay);
  };

  const counterObserver = new MutationObserver(() => scheduleSharpen(false, 220));
  counterObserver.observe(counter, {
    childList: true,
    characterData: true,
    subtree: true
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => scheduleSharpen(true, 260), { passive: true });
  }

  window.addEventListener("resize", () => scheduleSharpen(true, 260), { passive: true });
  window.addEventListener("orientationchange", () => scheduleSharpen(true, 300), { passive: true });

  document.addEventListener("fullscreenchange", () => scheduleSharpen(true, 260));
  document.addEventListener("webkitfullscreenchange", () => scheduleSharpen(true, 260));

  // Allow the standard flipbook renderer to finish completely before the HD
  // pass begins. The normal rendered page always remains visible underneath.
  window.setTimeout(() => scheduleSharpen(false, 0), 1200);
  window.setTimeout(() => scheduleSharpen(false, 0), 2400);
})();
