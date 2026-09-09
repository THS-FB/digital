(() => {
  if (window.St && typeof window.St.PageFlip === "function") {
    const OriginalPageFlip = window.St.PageFlip;

    window.St.PageFlip = new Proxy(OriginalPageFlip, {
      construct(target, args, newTarget) {
        const [element, settings = {}] = args;
        const patchedSettings = {
          ...settings,
          showCover: true,
          disableHardPages: true,
          firstCoverStartLeft: false
        };

        return Reflect.construct(target, [element, patchedSettings], newTarget);
      }
    });
  }

  const book = document.getElementById("flipbook");
  const counter = document.getElementById("flipbook-page-counter");
  if (!book) return;

  const softenPages = () => {
    book.querySelectorAll(".flip-page").forEach((page) => {
      page.dataset.density = "soft";
    });
  };

  const updateClosedCoverState = () => {
    if (!counter) return;
    const text = counter.textContent.trim();
    const onFrontCover = /^1\s*\/\s*\d+$/.test(text);
    book.classList.toggle("is-front-cover", onFrontCover);
  };

  softenPages();
  updateClosedCoverState();

  const pageObserver = new MutationObserver(() => {
    softenPages();
  });

  pageObserver.observe(book, {
    childList: true,
    subtree: false
  });

  if (counter) {
    const counterObserver = new MutationObserver(updateClosedCoverState);
    counterObserver.observe(counter, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
})();
