(() => {
  const BUILD_ID = "2026-09-10-perf1";
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

  let pageFlip = null;
  let totalPages = 0;
  let dimensions = null;
  const renderedPages = new Set();
  const renderingPages = new Map();

  const showStatus = (message) => {
    if (statusText) statusText.textContent = message;
    if (status) status.hidden = false;
  };

  const hideStatus = () => {
    if (status) status.hidden = true;
  };

  const hideCoverPreview = () => {
    if (!coverPreview) return;
    coverPreview.classList.add("is-hidden");
    window.setTimeout(() => {
      coverPreview.hidden = true;
    }, 220);
  };

  const showError = (message) => {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.classList.add("is-visible");
    }
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
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);

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
        await new Promise((resolve) => window.setTimeout(resolve, 0));
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
      flippingTime: 700
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
    hideCoverPreview();
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
