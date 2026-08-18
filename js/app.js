const menuToggle = document.getElementById("menu-toggle");
const siteMenu = document.getElementById("site-menu");

if (menuToggle && siteMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteMenu.classList.toggle("is-open");

    menuToggle.setAttribute(
      "aria-expanded",
      isOpen ? "true" : "false"
    );
  });

  siteMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteMenu.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (event) => {
    if (
      siteMenu.classList.contains("is-open") &&
      !siteMenu.contains(event.target) &&
      !menuToggle.contains(event.target)
    ) {
      siteMenu.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const shareScheduleButton = document.getElementById("share-schedule");

if (shareScheduleButton) {
  shareScheduleButton.addEventListener("click", async () => {
    const scheduleUrl = new URL(
      "../assets/images/tunstall-2026-football-schedule-web.jpg",
      window.location.href
    ).href;

    try {
      const response = await fetch(scheduleUrl);
      const blob = await response.blob();

      const scheduleFile = new File(
        [blob],
        "tunstall-football-2026-schedule.jpg",
        { type: "image/jpeg" }
      );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [scheduleFile] })
      ) {
        await navigator.share({
          title: "2026 Tunstall Trojan Football Schedule",
          text: "2026 Tunstall Trojan Football Schedule",
          files: [scheduleFile]
        });

        return;
      }

      const downloadLink = document.createElement("a");
      downloadLink.href = scheduleUrl;
      downloadLink.download = "tunstall-football-2026-schedule.jpg";

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (error) {
      if (error.name !== "AbortError") {
        window.open(scheduleUrl, "_blank");
      }
    }
  });
}
