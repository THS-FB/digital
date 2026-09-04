import fs from "node:fs";

const DATA_FILE = "data/schedule-2026.json";
const REQUIRED_MARKER = "THS_POSTGAME_RESULT_V1";

function fail(message) {
  console.error(`POSTGAME UPDATE FAILED: ${message}`);
  process.exit(1);
}

function readIssueBody() {
  const body = process.env.ISSUE_BODY;

  if (!body) {
    fail("ISSUE_BODY was not provided.");
  }

  if (!body.includes(REQUIRED_MARKER)) {
    fail("Postgame result marker was not found.");
  }

  return body;
}

function extractPayload(issueBody) {
  const match =
    issueBody.match(
      /```json\s*([\s\S]*?)```/i
    );

  if (!match) {
    fail("No JSON result block was found.");
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    fail(
      `Submitted JSON could not be parsed: ${error.message}`
    );
  }
}

function validateScore(value, label) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 199
  ) {
    fail(
      `${label} must be a whole number from 0 through 199.`
    );
  }
}

function sanitizeList(value, label) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`);
  }

  if (value.length > 20) {
    fail(`${label} contains too many entries.`);
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      fail(`${label} entries must be text.`);
    }

    const clean =
      item.trim();

    if (clean.length > 500) {
      fail(
        `${label} contains an entry longer than 500 characters.`
      );
    }

    return clean;
  }).filter(Boolean);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    fail("Submitted payload is invalid.");
  }

  if (payload.version !== 1) {
    fail("Unsupported postgame payload version.");
  }

  if (
    typeof payload.gameId !== "string" ||
    !payload.gameId.trim()
  ) {
    fail("A valid game ID is required.");
  }

  if (
    payload.team !== "varsity" &&
    payload.team !== "jv"
  ) {
    fail("Team must be varsity or jv.");
  }

  if (
    typeof payload.opponent !== "string" ||
    !payload.opponent.trim()
  ) {
    fail("Opponent is required.");
  }

  if (
    typeof payload.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)
  ) {
    fail("Game date is invalid.");
  }

  if (
    !payload.result ||
    typeof payload.result !== "object"
  ) {
    fail("Result information is missing.");
  }

  validateScore(
    payload.result.tunstall,
    "Tunstall score"
  );

  validateScore(
    payload.result.opponent,
    "Opponent score"
  );

  return {
    ...payload,

    result: {
      tunstall:
        payload.result.tunstall,

      opponent:
        payload.result.opponent,

      highlights:
        sanitizeList(
          payload.result.highlights,
          "Highlights"
        ),

      players:
        sanitizeList(
          payload.result.players,
          "Player highlights"
        )
    }
  };
}

function loadSchedule() {
  if (!fs.existsSync(DATA_FILE)) {
    fail(
      `${DATA_FILE} could not be found.`
    );
  }

  try {
    const raw =
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      );

    const data =
      JSON.parse(raw);

    if (
      !data ||
      !Array.isArray(data.games)
    ) {
      fail(
        "Schedule data does not contain a games array."
      );
    }

    return data;
  } catch (error) {
    fail(
      `Schedule data could not be read: ${error.message}`
    );
  }
}

function findGame(schedule, payload) {
  const game =
    schedule.games.find(
      (item) =>
        item.id === payload.gameId
    );

  if (!game) {
    fail(
      `Game ${payload.gameId} was not found in the schedule.`
    );
  }

  return game;
}

function verifyGameMatches(game, payload) {
  if (game.team !== payload.team) {
    fail(
      "Submitted team does not match the scheduled game."
    );
  }

  if (game.date !== payload.date) {
    fail(
      "Submitted date does not match the scheduled game."
    );
  }

  if (game.opponent !== payload.opponent) {
    fail(
      "Submitted opponent does not match the scheduled game."
    );
  }

  if (
    game.status === "bye" ||
    game.location === "bye"
  ) {
    fail(
      "A result cannot be recorded for a bye week."
    );
  }

  if (game.result) {
    fail(
      "This game already has a final result recorded."
    );
  }
}

function applyResult(game, payload) {
  game.status = "final";

  game.result = {
    tunstall:
      payload.result.tunstall,

    opponent:
      payload.result.opponent,

    highlights:
      payload.result.highlights,

    players:
      payload.result.players
  };

  game.updatedAt =
    new Date().toISOString();

  game.updatedBy =
    "postgame-admin";
}

function saveSchedule(schedule) {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        schedule,
        null,
        2
      ) + "\n",
      "utf8"
    );
  } catch (error) {
    fail(
      `Updated schedule could not be saved: ${error.message}`
    );
  }
}

function getOutcome(result) {
  if (
    result.tunstall >
    result.opponent
  ) {
    return "W";
  }

  if (
    result.tunstall <
    result.opponent
  ) {
    return "L";
  }

  return "T";
}

function main() {
  const issueBody =
    readIssueBody();

  const rawPayload =
    extractPayload(issueBody);

  const payload =
    validatePayload(rawPayload);

  const schedule =
    loadSchedule();

  const game =
    findGame(
      schedule,
      payload
    );

  verifyGameMatches(
    game,
    payload
  );

  applyResult(
    game,
    payload
  );

  saveSchedule(
    schedule
  );

  const outcome =
    getOutcome(
      game.result
    );

  console.log(
    [
      "POSTGAME UPDATE SUCCESSFUL",
      `${game.team.toUpperCase()}: Tunstall vs ${game.opponent}`,
      `${outcome} ${game.result.tunstall}-${game.result.opponent}`,
      `${DATA_FILE} updated successfully.`
    ].join("\n")
  );
}

main();
