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
