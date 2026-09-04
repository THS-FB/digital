(() => {
  "use strict";

  const DATA_URL =
    "../data/schedule-2026.json?ts=" + Date.now();

  function formatDate(dateString) {
    const [year, month, day] =
      dateString.split("-");

    return (
      Number(month) +
      "/" +
      Number(day) +
      "/" +
      year.slice(-2)
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getOutcome(result) {
    if (!result) {
      return null;
    }

    if (result.tunstall > result.opponent) {
      return "W";
    }

    if (result.tunstall < result.opponent) {
      return "L";
    }

    return "T";
  }

  function calculateRecord(games, team, districtOnly = false) {
    const completedGames =
      games.filter((game) => {
        if (game.team !== team) {
          return false;
        }

        if (!game.result) {
          return false;
        }

        if (districtOnly && !game.district) {
          return false;
        }

        return true;
      });

    let wins = 0;
    let losses = 0;
    let ties = 0;

    completedGames.forEach((game) => {
      const outcome =
        getOutcome(game.result);

      if (outcome === "W") {
        wins += 1;
      }

      if (outcome === "L") {
        losses += 1;
      }

      if (outcome === "T") {
        ties += 1;
      }
    });

    return {
      wins,
      losses,
      ties
    };
  }

  function formatRecord(record) {
    if (record.ties > 0) {
      return (
        record.wins +
        "–" +
        record.losses +
        "–" +
        record.ties
      );
    }

    return (
      record.wins +
      "–" +
      record.losses
    );
  }

  function updateRecordSummary(games, team) {
    const summary =
      document.querySelector(
        `[data-schedule-summary="${team}"]`
      );

    if (!summary) {
      return;
    }

    const recordValues =
      summary.querySelectorAll(
        ".season-record-item strong"
      );

    if (recordValues.length < 2) {
      return;
    }

    const overall =
      calculateRecord(
        games,
        team,
        false
      );

    const district =
      calculateRecord(
        games,
        team,
        true
      );

    recordValues[0].textContent =
      formatRecord(overall);

    recordValues[1].textContent =
      formatRecord(district);
  }

  function createResultMarkup(game) {
    if (!game.result) {
      return "";
    }

    const outcome =
      getOutcome(game.result);

    const className =
      outcome === "W"
        ? "schedule-result-win"
        : outcome === "L"
          ? "schedule-result-loss"
          : "schedule-result-tie";

    return `
      <span class="schedule-result ${className}">
        ${outcome}
        ${game.result.tunstall}–${game.result.opponent}
      </span>
    `;
  }

  function createGameRow(game) {
    const isBye =
      game.status === "bye" ||
      game.location === "bye";

    const rowClass =
      isBye
        ? "schedule-row bye-row"
        : "schedule-row";

    const locationClass =
      isBye
        ? "bye"
        : game.location;

    const locationLabel =
      isBye
        ? "Bye"
        : game.location === "home"
          ? "Home"
          : "Away";

    const resultMarkup =
      createResultMarkup(game);

    return `
      <div
        class="${rowClass}"
        data-game-id="${escapeHtml(game.id)}"
      >
        <div class="schedule-date">
          ${formatDate(game.date)}
        </div>

        <div class="schedule-opponent">
          ${escapeHtml(game.opponent)}
          ${resultMarkup}
        </div>

        <div
          class="schedule-location ${locationClass}"
        >
          ${locationLabel}
        </div>
      </div>
    `;
  }

  function renderSchedule(games, team) {
    const panel =
      document.querySelector(
        `[data-schedule-panel="${team}"]`
      );

    if (!panel) {
      return;
    }

    const teamGames =
      games
        .filter(
          (game) =>
            game.team === team
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date)
        );

    panel.innerHTML =
      teamGames
        .map(createGameRow)
        .join("");
  }

  async function loadSchedule() {
    try {
      const response =
        await fetch(
          DATA_URL,
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          "Unable to load schedule data."
        );
      }

      const data =
        await response.json();

      if (
        !data ||
        !Array.isArray(data.games)
      ) {
        throw new Error(
          "Schedule data is invalid."
        );
      }

      updateRecordSummary(
        data.games,
        "varsity"
      );

      updateRecordSummary(
        data.games,
        "jv"
      );

      renderSchedule(
        data.games,
        "varsity"
      );

      renderSchedule(
        data.games,
        "jv"
      );

      document.documentElement
        .setAttribute(
          "data-schedule-loaded",
          "true"
        );
    } catch (error) {
      console.error(
        "THS schedule data error:",
        error
      );

      /*
        Important:
        If the JSON ever fails to load,
        the existing hard-coded schedule
        remains visible as a fallback.
      */
    }
  }

  loadSchedule();
})();
