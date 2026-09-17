(() => {
  const BUILD_ID = "2026-09-17-hdzoom1";
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
    return Math.min(5, Math.max(basePixelRatio(), dpr * viewportScale));
  };

  const renderHdPage = async (pageNumber, requestedRatio) => {
    const pageElement = book.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageElement || !pageElement.classList.contains("is-rendered")) return;

    const canvas = pageElement.querySelector("canvas");
    if (!canvas) return;

    const currentRatio = Number(canvas.dataset.hdPixelRatio || 0);
    if (currentRatio >= requestedRatio * 0.94) return;

    const priorTask = renderTasks.get(pageNumber);
    if (priorTask) {
      try {
        priorTask.cancel();
      } catch (error) {
        // No-op: an already completed render cannot be cancelled.
      }
      renderTasks.delete(pageNumber);
    }

    const pdf = await loadPdf();
    const pdfPage = await pdf.getPage(pageNumber);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const cssWidth = Math.max(pageElement.offsetWidth, 1);
    const cssScale = cssWidth / baseViewport.width;
    const viewport = pdfPage.getViewport({ scale: cssScale });
    const pixelRatio = Math.min(5, Math.max(1, requestedRatio));

    canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const renderTask = pdfPage.render({
      canvasContext: context,
      viewport,
      transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
    });

    renderTasks.set(pageNumber, renderTask);

    try {
      await renderTask.promise;
      canvas.dataset.hdPixelRatio = pixelRatio.toFixed(3);
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
    const maxPage = Math.max(
      ...Array.from(book.querySelectorAll("[data-page-number]"), (node) => Number(node.dataset.pageNumber || 0))
    );

    const pageNumbers = new Set([current]);
    if (current > 1) pageNumbers.add(current - 1);
    if (current < maxPage) pageNumbers.add(current + 1);

    for (const pageNumber of pageNumbers) {
      await renderHdPage(pageNumber, ratio);
    }
  };

  const scheduleSharpen = (useZoomRatio = false) => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void sharpenCurrentView(useZoomRatio);
    }, 120);
  };

  const counterObserver = new MutationObserver(() => scheduleSharpen(false));
  counterObserver.observe(counter, {
    childList: true,
    characterData: true,
    subtree: true
  });

  const bookObserver = new MutationObserver(() => scheduleSharpen(false));
  bookObserver.observe(book, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => scheduleSharpen(true), { passive: true });
  }

  window.addEventListener("resize", () => scheduleSharpen(true), { passive: true });
  window.addEventListener("orientationchange", () => scheduleSharpen(true), { passive: true });

  document.addEventListener("fullscreenchange", () => scheduleSharpen(true));
  document.addEventListener("webkitfullscreenchange", () => scheduleSharpen(true));

  // Upgrade the initial visible pages once the standard flipbook render settles.
  window.setTimeout(() => scheduleSharpen(false), 500);
  window.setTimeout(() => scheduleSharpen(false), 1400);
})();
