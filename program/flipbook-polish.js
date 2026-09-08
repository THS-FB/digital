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
  if (!book) return;

  const softenPages = () => {
    book.querySelectorAll(".flip-page").forEach((page) => {
      page.dataset.density = "soft";
    });
  };

  softenPages();

  const observer = new MutationObserver(() => {
    softenPages();
  });

  observer.observe(book, {
    childList: true,
    subtree: false
  });
})();
