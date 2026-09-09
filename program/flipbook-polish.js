(() => {
  const book = document.getElementById("flipbook");
  if (!book) return;

  const updateInternalWrapper = () => {
    const wrapper = book.querySelector(".stf__wrapper");
    if (!wrapper) return;

    const closed = book.classList.contains("is-front-cover");
    wrapper.classList.toggle("flipbook-cover-centered", closed);
  };

  const observer = new MutationObserver(updateInternalWrapper);
  observer.observe(book, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  updateInternalWrapper();
})();
