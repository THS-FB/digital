(() => {
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
