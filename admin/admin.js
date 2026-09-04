(() => {
  "use strict";

  const DATA_URL =
    "../data/schedule-2026.json?ts=" + Date.now();

  const TIMEZONE = "America/New_York";

  const ISSUE_URL =
    "https://github.com/THS-FB/digital/issues/new";

  let scheduleData = null;
  let selectedGame = null;
  let enteredScore = null;

  const loadingCard =
    document.getElementById("admin-loading");

  const gameReadyCard =
    document.getElementById("game-ready");

  const noGameCard =
    document.getElementById("no-game-ready");

  const scoreStep =
    document.getElementById("score-step");

  const notesStep =
    document.getElementById("notes-step");

  const reviewStep =
    document.getElementById("review-step");

  const successStep =
    document.getElementById("success-step");

  const errorCard =
    document.getElementById("admin-error-card");

  const scoreError =
    document.getElementById("score-error");

  const tunstallScoreInput =
    document.getElementById("tunstall-score");

  const opponentScoreInput =
    document.getElementById("opponent-score");

  const highlightsInput =
    document.getElementById("game-highlights");

  const playersInput =
    document.getElementById("player-highlights");


  function hideAllCards() {
    [
      loadingCard,
      gameReadyCard,
      noGameCard,
      scoreStep,
      notesStep,
      reviewStep,
      successStep,
      errorCard
    ].forEach((card) => {
      if (card) {
        card.hidden = true;
      }
    });
  }


  function showCard(card) {
    hideAllCards();

    if (card) {
      card.hidden = false;
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


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


  function formatLocation(location) {
    if (location === "home") {
      return "Home";
    }

    if (location === "away") {
      return "Away";
    }

    return "—";
  }


  function teamLabel(team) {
    return team === "jv"
      ? "JV"
      : "Varsity";
  }


  function getEasternNow() {
    const formatter =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone: TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        }
      );

    const parts =
      formatter.formatToParts(
        new Date()
      );

    const values = {};

    parts.forEach((part) => {
      if (part.type !== "literal") {
        values[part.type] =
          part.value;
      }
    });

    return {
      date:
        values.year +
        "-" +
        values.month +
        "-" +
        values.day,

      minutes:
        Number(values.hour) * 60 +
        Number(values.minute)
    };
  }


  function kickoffMinutes(kickoff) {
    if (!kickoff) {
      return null;
    }

    const [hours, minutes] =
      kickoff
        .split(":")
        .map(Number);

    return (
      hours * 60 +
      minutes
    );
  }


  function gameNeedsResult(game) {
    if (!game) {
      return false;
    }

    if (
      game.status === "bye" ||
      game.location === "bye"
    ) {
      return false;
    }

    if (game.result) {
      return false;
    }

    if (!game.kickoff) {
      return false;
    }

    const now =
      getEasternNow();

    if (game.date < now.date) {
      return true;
    }

    if (game.date > now.date) {
      return false;
    }

    const start =
      kickoffMinutes(
        game.kickoff
      );

    const duration =
      Number(
        scheduleData
          .estimatedGameDurationMinutes
      ) || 150;

    return (
      now.minutes >=
      start + duration
    );
  }


  function findPendingGame() {
    const pending =
      scheduleData.games
        .filter(gameNeedsResult)
        .sort(
          (a, b) =>
            b.date.localeCompare(
              a.date
            )
        );

    return pending[0] || null;
  }


  function getTestGame() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const testId =
      params.get("test");

    if (!testId) {
      return null;
    }

    return (
      scheduleData.games.find(
        (game) =>
          game.id === testId
      ) || null
    );
  }


  function populateGameReady(game) {
    document.getElementById(
      "game-ready-title"
    ).textContent =
      `Tunstall vs ${game.opponent}`;

    document.getElementById(
      "game-ready-team"
    ).textContent =
      teamLabel(game.team);

    document.getElementById(
      "game-ready-date"
    ).textContent =
      formatDate(game.date);

    document.getElementById(
      "game-ready-location"
    ).textContent =
      formatLocation(
        game.location
      );

    document.getElementById(
      "game-ready-opponent"
    ).textContent =
      game.opponent;

    document.getElementById(
      "score-game-title"
    ).textContent =
      `Tunstall vs ${game.opponent}`;

    document.getElementById(
      "opponent-score-label"
    ).textContent =
      game.opponent;
  }


  function getOutcome(
    tunstall,
    opponent
  ) {
    if (tunstall > opponent) {
      return "WIN";
    }

    if (tunstall < opponent) {
      return "LOSS";
    }

    return "TIE";
  }


  function getRecordCode(
    tunstall,
    opponent
  ) {
    if (tunstall > opponent) {
      return "W";
    }

    if (tunstall < opponent) {
      return "L";
    }

    return "T";
  }


  function calculateProjectedRecord() {
    let wins = 0;
    let losses = 0;
    let ties = 0;

    scheduleData.games
      .filter((game) => {
        if (
          game.team !==
          selectedGame.team
        ) {
          return false;
        }

        if (
          game.id ===
          selectedGame.id
        ) {
          return false;
        }

        return Boolean(
          game.result
        );
      })
      .forEach((game) => {
        const outcome =
          getRecordCode(
            game.result.tunstall,
            game.result.opponent
          );

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

    const newOutcome =
      getRecordCode(
        enteredScore.tunstall,
        enteredScore.opponent
      );

    if (newOutcome === "W") {
      wins += 1;
    }

    if (newOutcome === "L") {
      losses += 1;
    }

    if (newOutcome === "T") {
      ties += 1;
    }

    if (ties > 0) {
      return (
        wins +
        "–" +
        losses +
        "–" +
        ties
      );
    }

    return (
      wins +
      "–" +
      losses
    );
  }


  function validateScore() {
    const tunstall =
      Number(
        tunstallScoreInput.value
      );

    const opponent =
      Number(
        opponentScoreInput.value
      );

    const valid =
      Number.isInteger(tunstall) &&
      Number.isInteger(opponent) &&
      tunstall >= 0 &&
      opponent >= 0 &&
      tunstall <= 199 &&
      opponent <= 199;

    if (!valid) {
      scoreError.hidden = false;
      return null;
    }

    scoreError.hidden = true;

    return {
      tunstall,
      opponent
    };
  }


  function splitEntries(value) {
    const text =
      String(value || "")
        .trim();

    if (!text) {
      return [];
    }

    return text
      .split(/\n+/)
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean);
  }


  function buildReview() {
    const outcome =
      getOutcome(
        enteredScore.tunstall,
        enteredScore.opponent
      );

    document.getElementById(
      "review-score"
    ).textContent =
      `Tunstall ${enteredScore.tunstall} — ` +
      `${selectedGame.opponent} ${enteredScore.opponent}`;

    document.getElementById(
      "review-result"
    ).textContent =
      outcome;

    document.getElementById(
      "review-record"
    ).textContent =
      calculateProjectedRecord();

    document.getElementById(
      "review-highlights"
    ).textContent =
      highlightsInput.value.trim() ||
      "None entered";

    document.getElementById(
      "review-players"
    ).textContent =
      playersInput.value.trim() ||
      "None entered";
  }


  function buildPayload() {
    return {
      version: 1,

      gameId:
        selectedGame.id,

      team:
        selectedGame.team,

      opponent:
        selectedGame.opponent,

      date:
        selectedGame.date,

      submittedAt:
        new Date().toISOString(),

      result: {
        tunstall:
          enteredScore.tunstall,

        opponent:
          enteredScore.opponent,

        highlights:
          splitEntries(
            highlightsInput.value
          ),

        players:
          splitEntries(
            playersInput.value
          )
      }
    };
  }


  function publishResult() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const isTest =
      Boolean(
        params.get("test")
      );

    if (isTest) {
      showCard(
        successStep
      );

      const heading =
        successStep.querySelector(
          "h3"
        );

      const description =
        successStep.querySelector(
          ".admin-muted"
        );

      if (heading) {
        heading.textContent =
          "Test completed successfully.";
      }

      if (description) {
        description.textContent =
          "The wizard completed without sending a live update to GitHub.";
      }

      return;
    }

    const payload =
      buildPayload();

    const issueTitle =
      `Game Result: ${selectedGame.id}`;

    const issueBody =
`<!-- THS_POSTGAME_RESULT_V1 -->

Postgame result submitted from the THS Football admin page.

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

Do not edit the JSON block above before submitting.
`;

    const url =
      new URL(ISSUE_URL);

    url.searchParams.set(
      "title",
      issueTitle
    );

    url.searchParams.set(
      "body",
      issueBody
    );

    window.location.href =
      url.toString();
  }


  function attachEvents() {
    document.getElementById(
      "start-result"
    ).addEventListener(
      "click",
      () => {
        showCard(scoreStep);

        setTimeout(() => {
          tunstallScoreInput.focus();
        }, 150);
      }
    );


    document.getElementById(
      "score-continue"
    ).addEventListener(
      "click",
      () => {
        const score =
          validateScore();

        if (!score) {
          return;
        }

        enteredScore =
          score;

        showCard(notesStep);
      }
    );


    document.getElementById(
      "score-cancel"
    ).addEventListener(
      "click",
      () => {
        scoreError.hidden = true;
        showCard(gameReadyCard);
      }
    );


    document.getElementById(
      "notes-back"
    ).addEventListener(
      "click",
      () => {
        showCard(scoreStep);
      }
    );


    document.getElementById(
      "notes-continue"
    ).addEventListener(
      "click",
      () => {
        buildReview();
        showCard(reviewStep);
      }
    );


    document.getElementById(
      "review-back"
    ).addEventListener(
      "click",
      () => {
        showCard(notesStep);
      }
    );


    document.getElementById(
      "publish-result"
    ).addEventListener(
      "click",
      publishResult
    );
  }


  async function initializeAdmin() {
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

      scheduleData =
        await response.json();

      if (
        !scheduleData ||
        !Array.isArray(
          scheduleData.games
        )
      ) {
        throw new Error(
          "Invalid schedule data."
        );
      }

      const testGame =
        getTestGame();

      selectedGame =
        testGame ||
        findPendingGame();

      if (!selectedGame) {
        showCard(noGameCard);
        return;
      }

      populateGameReady(
        selectedGame
      );

      if (testGame) {
        document.getElementById(
          "game-ready-description"
        ).textContent =
          "TEST MODE — Use this game to test the postgame wizard. Publishing is disabled in test mode.";
      }

      showCard(gameReadyCard);
    } catch (error) {
      console.error(
        "THS admin error:",
        error
      );

      showCard(errorCard);
    }
  }


  attachEvents();
  initializeAdmin();

})();
