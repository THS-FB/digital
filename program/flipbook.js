(() => {
  const BUILD_ID = "2026-09-08d";
  const PDF_URL = "../assets/program/current-program.pdf";
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  const PAGEFLIP_URL = "https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js";

  const shell = document.querySelector(".flipbook-shell");
  const stage = document.getElementById("flipbook-stage");
  const book = document.getElementById("flipbook");
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

  const showStatus = (message) => {
    if (statusText) statusText.textContent = message;
    if (status) status.hidden = false;
  };

  const hideStatus = () => {
    if (status) status.hidden = true;
  };

  const showError = (message) => {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.classList.add("is-visible");
    }
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
    if (!counter || !prevButton || !nextButton) return;

    if (!totalPages) {
      counter.textContent = "0 / 0";
      return;
    }

    const pageNumber = Math.min(pageIndex + 1, totalPages);
    counter.textContent = `${pageNumber} / ${totalPages}`;
    prevButton.disabled = pageIndex <= 0;
    nextButton.disabled = pageIndex >= totalPages - 1;
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

  const renderPdfPages = async (pdfjsLib) => {
    showStatus("Loading digital program...");

    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

    const loadingTask = pdfjsLib.getDocument(PDF_URL);
    loadingTask.onProgress = ({ loaded, total }) => {
      if (total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        showStatus(`Loading digital program... ${percent}%`);
      }
    };

    const pdf = await loadingTask.promise;
    totalPages = pdf.numPages;

    const firstPage = await pdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1 });
    const dimensions = getBookDimensions(firstViewport);

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      showStatus(`Preparing page ${pageNumber} of ${totalPages}...`);

      const pdfPage = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const scale = dimensions.pageWidth / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);

      const page = document.createElement("div");
      page.className = "flip-page";
      page.dataset.density = (pageNumber === 1 || pageNumber === totalPages) ? "hard" : "soft";
      page.style.width = `${dimensions.pageWidth}px`;
      page.style.height = `${dimensions.pageHeight}px`;

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error(`Canvas context unavailable for page ${pageNumber}`);

      const linkLayer = document.createElement("div");
      linkLayer.className = "pdf-link-layer";

      page.append(canvas, linkLayer);
      book.appendChild(page);

      const renderContext = { canvasContext: context, viewport };
      if (outputScale !== 1) {
        renderContext.transform = [outputScale, 0, 0, outputScale, 0, 0];
      }

      await pdfPage.render(renderContext).promise;
      await renderLinkLayer(pdfPage, viewport, linkLayer);
    }

    return dimensions;
  };

  const initializePageFlip = async (dimensions) => {
    showStatus("Starting flipbook...");

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
  };

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
      const pdfjsLib = await import(`${PDFJS_URL}?v=${encodeURIComponent(BUILD_ID)}`);
      const dimensions = await renderPdfPages(pdfjsLib);
      await initializePageFlip(dimensions);
    } catch (error) {
      console.error(error);
      const detail = error && error.message ? error.message : String(error);
      showError(`Flipbook build ${BUILD_ID} error: ${detail}`);
    }
  })();
})();
