(() => {
  "use strict";

  const DATA_URL =
    "../data/schedule-2026.json?ts=" + Date.now();

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    return `${Number(month)}/${Number(day)}/${year.slice(-2)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installScheduleResultAlignment() {
    if (document.getElementById("ths-schedule-result-alignment")) return;

    const style = document.createElement("style");
    style.id = "ths-schedule-result-alignment";
    style.textContent = `
      .schedule-row {
        grid-template-columns: 120px minmax(0, 1fr) auto 100px;
      }

      .schedule-opponent {
        min-width: 0;
      }

      .schedule-result {
        margin-left: 0 !important;
        white-space: nowrap;
        justify-self: start;
      }

      @media (max-width: 760px) {
        .schedule-row {
          grid-template-columns: 88px minmax(0, 1fr) 94px;
          gap: 8px 14px;
        }

        .schedule-opponent {
          grid-column: 2;
          white-space: nowrap;
        }

        .schedule-result {
          grid-column: 3;
          width: 94px;
          text-align: left;
          align-self: center;
        }

        .schedule-location {
          grid-column: 2;
          justify-self: start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getOutcome(result) {
    if (!result) return null;
    if (result.tunstall > result.opponent) return "W";
    if (result.tunstall < result.opponent) return "L";
    return "T";
  }

  function calculateRecord(games, team, districtOnly = false) {
    let wins = 0;
    let losses = 0;
    let ties = 0;

    games.forEach((game) => {
      if (game.team !== team || !game.result) return;
      if (districtOnly && !game.district) return;

      const outcome = getOutcome(game.result);
      if (outcome === "W") wins += 1;
      if (outcome === "L") losses += 1;
      if (outcome === "T") ties += 1;
    });

    return { wins, losses, ties };
  }

  function formatRecord(record) {
    return record.ties > 0
      ? `${record.wins}–${record.losses}–${record.ties}`
      : `${record.wins}–${record.losses}`;
  }

  function updateRecordSummary(games, team) {
    const summary = document.querySelector(
      `[data-schedule-summary="${team}"]`
    );

    if (!summary) return;

    const values = summary.querySelectorAll(
      ".season-record-item strong"
    );

    if (values.length < 2) return;

    values[0].textContent = formatRecord(
      calculateRecord(games, team, false)
    );

    values[1].textContent = formatRecord(
      calculateRecord(games, team, true)
    );
  }

  function createResultMarkup(game) {
    if (!game.result) return "";

    const outcome = getOutcome(game.result);
    const className =
      outcome === "W"
        ? "schedule-result-win"
        : outcome === "L"
          ? "schedule-result-loss"
          : "schedule-result-tie";

    return `
      <span class="schedule-result ${className}">
        ${outcome} ${game.result.tunstall}–${game.result.opponent}
      </span>
    `;
  }

  function createGameRow(game) {
    const isBye = game.status === "bye" || game.location === "bye";
    const locationClass = isBye ? "bye" : game.location;
    const locationLabel = isBye
      ? "Bye"
      : game.location === "home"
        ? "Home"
        : "Away";

    return `
      <div class="schedule-row${isBye ? " bye-row" : ""}" data-game-id="${escapeHtml(game.id)}">
        <div class="schedule-date">${formatDate(game.date)}</div>
        <div class="schedule-opponent">${escapeHtml(game.opponent)}</div>
        ${createResultMarkup(game)}
        <div class="schedule-location ${locationClass}">${locationLabel}</div>
      </div>
    `;
  }

  function renderSchedule(games, team) {
    const panel = document.querySelector(
      `[data-schedule-panel="${team}"]`
    );

    if (!panel) return;

    panel.innerHTML = games
      .filter((game) => game.team === team)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(createGameRow)
      .join("");
  }

  async function loadSchedule() {
    try {
      installScheduleResultAlignment();

      const response = await fetch(DATA_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Unable to load schedule data.");
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.games)) {
        throw new Error("Schedule data is invalid.");
      }

      updateRecordSummary(data.games, "varsity");
      updateRecordSummary(data.games, "jv");
      renderSchedule(data.games, "varsity");
      renderSchedule(data.games, "jv");

      document.documentElement.setAttribute(
        "data-schedule-loaded",
        "true"
      );
    } catch (error) {
      console.error("THS schedule data error:", error);
    }
  }

  loadSchedule();
})();
