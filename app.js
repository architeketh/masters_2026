const STORAGE_KEY = "masters-2026-custom-leaderboard";
const APP_VERSION = "2026.04.09.8";
const DATA_FILES = {
  config: "./data/config.json",
  picks: "./data/picks.json",
  leaderboard: "./data/leaderboard.json"
};

const elements = {
  tournamentName: document.getElementById("tournament-name"),
  tournamentSubtitle: document.getElementById("tournament-subtitle"),
  tournamentDates: document.getElementById("tournament-dates"),
  tournamentVenue: document.getElementById("tournament-venue"),
  eventLeader: document.getElementById("event-leader"),
  poolLeader: document.getElementById("pool-leader"),
  boardUpdate: document.getElementById("board-update"),
  scoresLastUpdated: document.getElementById("scores-last-updated"),
  boardPlayerCount: document.getElementById("board-player-count"),
  boardVersion: document.getElementById("board-version"),
  mastersBoard: document.getElementById("masters-board"),
  mastersBoardMobile: document.getElementById("masters-board-mobile"),
  scoreboard: document.getElementById("scoreboard"),
  leaderboard: document.getElementById("leaderboard"),
  adminPanel: document.getElementById("admin-panel"),
  leaderboardInput: document.getElementById("leaderboard-input"),
  csvFileInput: document.getElementById("csv-file-input"),
  adminStatus: document.getElementById("admin-status"),
  toggleAdmin: document.getElementById("toggle-admin"),
  closeAdmin: document.getElementById("close-admin"),
  applyData: document.getElementById("apply-data"),
  publishData: document.getElementById("publish-data"),
  resetData: document.getElementById("reset-data"),
  emptyStateTemplate: document.getElementById("empty-state-template")
};

let repoLeaderboard = null;
let latestEntries = [];
let latestPicks = null;
let latestLeaderboard = null;
let boardSort = {
  key: "score",
  direction: "asc"
};

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

async function loadData() {
  try {
    const [config, picks, leaderboard] = await Promise.all([
      loadJson(DATA_FILES.config),
      loadJson(DATA_FILES.picks),
      loadJson(DATA_FILES.leaderboard)
    ]);

    return { config, picks, leaderboard };
  } catch (error) {
    if (window.MASTERS_CONFIG && window.MASTERS_PICKS && window.MASTERS_LEADERBOARD) {
      return {
        config: window.MASTERS_CONFIG,
        picks: window.MASTERS_PICKS,
        leaderboard: window.MASTERS_LEADERBOARD
      };
    }

    throw error;
  }
}

function parseScoreToPar(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "E") return 0;
  const parsed = Number(normalized.replace("+", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]+\)/g, "")
    .replace(/\./g, "")
    .replace(/\bcameron young\b/g, "cam young")
    .replace(/\bj j spaun\b/g, "jj spaun")
    .replace(/\s+/g, " ")
    .trim();
}

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatLastUpdated(value) {
  if (!value) return "waiting for data";
  return value;
}

function getScoreClass(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "na";
  if (value > 0) return "over";
  if (value < 0) return "under";
  return "even";
}

function hasLiveRoundData(player) {
  const thru = String(player.thru || "").trim().toUpperCase();
  const today = String(player.today || "").trim().toUpperCase();
  const status = String(player.status || "").trim().toLowerCase();

  if (typeof player.scoreToPar === "number") return true;
  if (thru && thru !== "--") return true;
  if (today && today !== "--") return true;
  return status.includes("live") || status.includes("final") || status.includes("complete") || status.includes("round");
}

function formatBonus(value) {
  return value ? `-${value}` : "0";
}

function parsePosition(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseTeeTime(value) {
  if (!value || value === "--") return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM") hours += 12;
  return (hours * 60) + minutes;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getStoredLeaderboard() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function validateLeaderboardData(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.players)) {
    throw new Error("Leaderboard JSON must include a players array.");
  }
  return normalizeLeaderboardData(payload);
}

function isCompletedTournamentStatus(player) {
  const status = String(player.status || "").toLowerCase();
  return status.includes("final") ||
    status.includes("complete") ||
    status.includes("completed") ||
    status.includes("champion") ||
    status.includes("round 4");
}

function normalizeLeaderboardData(payload) {
  const players = payload.players.map((player) => ({
    ...player,
    isChampion: Boolean(player.isChampion)
  }));

  const explicitChampions = players.filter((player) => player.isChampion);
  if (explicitChampions.length === 1) {
    return { ...payload, players };
  }

  const inferredChampions = players.filter((player) => (
    parsePosition(player.position) === 1 && isCompletedTournamentStatus(player)
  ));

  if (inferredChampions.length === 1) {
    const championName = normalizeName(inferredChampions[0].name);
    return {
      ...payload,
      players: players.map((player) => ({
        ...player,
        isChampion: normalizeName(player.name) === championName
      }))
    };
  }

  return { ...payload, players };
}

function collectDraftedPlayers(picks) {
  return Array.from(
    new Set(
      picks.entries.flatMap((entry) => entry.picks.map((name) => name.trim()))
    )
  );
}

function buildLookup(players) {
  const lookup = new Map();
  players.forEach((player) => {
    lookup.set(normalizeName(player.name), { ...player, scoreToPar: parseScoreToPar(player.toPar) });
  });
  return lookup;
}

function parseCsvRow(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, "").trim());
}

function findColumnIndex(header, names) {
  return header.findIndex((cell) => names.includes(cell));
}

function parseLeaderboardCsv(rawText, currentLeaderboard, picks) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("CSV file is empty.");
  }

  const header = parseCsvRow(lines[0]).map((cell) => cell.toUpperCase());
  const playerColumnIndex = findColumnIndex(header, ["PLAYER", "NAME"]);
  const teeTimeColumnIndex = findColumnIndex(header, ["TEE TIME", "TEE_TIME", "TEETIME"]);
  const positionColumnIndex = findColumnIndex(header, ["POS", "POSITION", "PLACE"]);
  const toParColumnIndex = findColumnIndex(header, ["TO PAR", "TO_PAR", "TOPAR", "SCORE", "TOTAL"]);
  const todayColumnIndex = findColumnIndex(header, ["TODAY", "ROUND", "R1", "ROUND 1"]);
  const thruColumnIndex = findColumnIndex(header, ["THRU", "THROUGH"]);
  const statusColumnIndex = findColumnIndex(header, ["STATUS"]);

  if (playerColumnIndex === -1) {
    throw new Error("CSV must include a PLAYER column.");
  }

  if (
    teeTimeColumnIndex === -1 &&
    positionColumnIndex === -1 &&
    toParColumnIndex === -1 &&
    todayColumnIndex === -1 &&
    thruColumnIndex === -1 &&
    statusColumnIndex === -1
  ) {
    throw new Error("CSV must include tee time or score columns to import.");
  }

  const draftedPlayers = collectDraftedPlayers(picks);
  const currentLookup = buildLookup(currentLeaderboard.players);
  const draftedByName = new Map(
    draftedPlayers.map((name) => [normalizeName(name), name])
  );
  const updates = new Map();

  lines.slice(1).forEach((line) => {
    const row = parseCsvRow(line);
    const rawPlayerName = row[playerColumnIndex];
    if (!rawPlayerName) return;

    const normalized = normalizeName(rawPlayerName);
    const draftedName = draftedByName.get(normalized);
    if (!draftedName) return;

    const existing = currentLookup.get(normalized) || {
      name: draftedName,
      position: "--",
      toPar: "--",
      today: "--",
      thru: "--",
      teeTime: "--",
      status: "Updated",
      madeCut: false,
      isChampion: false,
      scoreToPar: null
    };

    const rawToday = todayColumnIndex >= 0 ? row[todayColumnIndex] : "";
    const rawToPar = toParColumnIndex >= 0 ? row[toParColumnIndex] : "";
    const fallbackToPar = rawToPar || ((existing.toPar === "--" || !existing.toPar) ? rawToday : "");
    const normalizedToPar = fallbackToPar ? fallbackToPar.toUpperCase() : existing.toPar || "--";

    updates.set(normalized, {
      ...existing,
      name: draftedName,
      position: positionColumnIndex >= 0 && row[positionColumnIndex] ? row[positionColumnIndex].toUpperCase() : existing.position || "--",
      toPar: normalizedToPar,
      today: rawToday ? rawToday.toUpperCase() : existing.today || "--",
      thru: thruColumnIndex >= 0 && row[thruColumnIndex] ? row[thruColumnIndex].toUpperCase() : existing.thru || "--",
      teeTime: teeTimeColumnIndex >= 0 && row[teeTimeColumnIndex] ? row[teeTimeColumnIndex] : existing.teeTime || "--",
      status: statusColumnIndex >= 0 && row[statusColumnIndex]
        ? row[statusColumnIndex]
        : (rawToday || (thruColumnIndex >= 0 && row[thruColumnIndex])) ? "Live" : existing.status || "Updated",
      madeCut: (statusColumnIndex >= 0 && /cut/i.test(row[statusColumnIndex])) ? false : existing.madeCut,
      isChampion: existing.isChampion || false,
      scoreToPar: parseScoreToPar(normalizedToPar)
    });
  });

  if (!updates.size) {
    throw new Error("No drafted golfers were recognized in the CSV.");
  }

  const mergedPlayers = draftedPlayers.map((name) => {
    const normalized = normalizeName(name);
    return updates.get(normalized) || currentLookup.get(normalized) || {
      name,
      position: "--",
      toPar: "--",
      today: "--",
      thru: "--",
      teeTime: "--",
      status: "Not found",
      madeCut: false,
      isChampion: false,
      scoreToPar: null
    };
  });

  return {
    lastUpdated: `Imported CSV on ${new Date().toLocaleString()}`,
    players: mergedPlayers
  };
}

function parseRawLeaderboardInput(rawText, currentLeaderboard, picks) {
  const draftedPlayers = collectDraftedPlayers(picks);
  const currentLookup = buildLookup(currentLeaderboard.players);
  const normalizedDrafted = draftedPlayers.map((name) => ({
    name,
    normalized: normalizeName(name)
  }));

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matched = new Map();

  lines.forEach((line) => {
    const normalizedLine = normalizeName(line);
    const drafted = normalizedDrafted.find((player) => normalizedLine.includes(player.normalized));
    if (!drafted) return;

    const positionMatch = line.match(/\b(T?\d+|CUT|WD|DQ)\b/i);
    const scoreMatch = line.match(/(^|\s)(E|[+-]\d+)(?=\s|$)/i);
    const thruMatch = line.match(/\b(F|WD|DQ|CUT|[1-9]|1[0-8])\b/i);

    const afterName = line.split(new RegExp(escapeRegExp(drafted.name), "i"))[1] || "";
    const trailingScoreMatches = Array.from(afterName.matchAll(/\b(E|[+-]\d+)\b/gi)).map((match) => match[1]);
    const todayValue = trailingScoreMatches.length > 1 ? trailingScoreMatches[1] : trailingScoreMatches[0] || "--";

    const existing = currentLookup.get(drafted.normalized) || { name: drafted.name };

    matched.set(drafted.normalized, {
      ...existing,
      name: drafted.name,
      position: positionMatch ? positionMatch[1].toUpperCase() : existing.position || "--",
      toPar: scoreMatch ? scoreMatch[2].toUpperCase() : existing.toPar || "--",
      today: todayValue,
      thru: thruMatch ? thruMatch[1].toUpperCase() : existing.thru || "--",
      teeTime: existing.teeTime || "--",
      status: /cut/i.test(line) ? "Cut" : /wd/i.test(line) ? "WD" : existing.status || "Updated",
      scoreToPar: parseScoreToPar(scoreMatch ? scoreMatch[2] : existing.toPar),
      madeCut: /cut/i.test(line) ? false : existing.madeCut,
      isChampion: existing.isChampion || false
    });
  });

  if (!matched.size) {
    throw new Error("No drafted golfers were recognized. Paste rows that include player names.");
  }

  const mergedPlayers = draftedPlayers.map((name) => {
    const normalized = normalizeName(name);
    return matched.get(normalized) || currentLookup.get(normalized) || {
      name,
      position: "--",
      toPar: "--",
      today: "--",
      thru: "--",
      teeTime: "--",
      status: "Not found",
      madeCut: false,
      isChampion: false
    };
  });

  return {
    lastUpdated: `Imported on ${new Date().toLocaleString()}`,
    players: mergedPlayers
  };
}

function computeEntry(entry, lookup, scoring) {
  const picks = entry.picks.map((name) => {
    const player = lookup.get(normalizeName(name));
    if (!player) {
      return { name, found: false, counted: false, scoreToPar: null, position: "--", status: "Not found" };
    }
    return { ...player, name, found: true, counted: false };
  });

  const sortable = picks
    .filter((pick) => pick.found && typeof pick.scoreToPar === "number")
    .sort((a, b) => a.scoreToPar - b.scoreToPar);

  sortable.slice(0, scoring.countBest).forEach((pick) => {
    pick.counted = true;
  });

  const counted = picks.filter((pick) => pick.counted);
  const rawScore = counted.reduce((sum, pick) => sum + pick.scoreToPar, 0);
  const championCount = picks.filter((pick) => pick.found && pick.isChampion).length;
  const topTenCount = picks.filter((pick) => pick.found && (parsePosition(pick.position) ?? 999) <= 10).length;
  const madeCutCount = picks.filter((pick) => pick.found && pick.madeCut).length;
  const bonus =
    championCount * scoring.bonuses.champion +
    topTenCount * scoring.bonuses.top10 +
    madeCutCount * scoring.bonuses.madeCut;

  return {
    name: entry.name,
    rawScore,
    bonus,
    adjustedScore: counted.length ? rawScore - bonus : null,
    counted,
    picks,
    championCount,
    topTenCount,
    madeCutCount,
    hasChampion: championCount > 0
  };
}

function compareEntries(a, b) {
  if (a.hasChampion && !b.hasChampion) return -1;
  if (!a.hasChampion && b.hasChampion) return 1;
  if (a.adjustedScore === null) return 1;
  if (b.adjustedScore === null) return -1;
  if (a.adjustedScore !== b.adjustedScore) return a.adjustedScore - b.adjustedScore;
  if (a.rawScore !== b.rawScore) return a.rawScore - b.rawScore;
  return a.name.localeCompare(b.name);
}

function renderEmptyState(target) {
  target.innerHTML = elements.emptyStateTemplate.innerHTML;
}

function downloadTextFile(filename, contents, mimeType = "application/json;charset=utf-8") {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildLeaderboardFileContents() {
  if (!latestLeaderboard) {
    throw new Error("No leaderboard data is loaded yet.");
  }

  const jsonText = `${JSON.stringify(latestLeaderboard, null, 2)}\n`;
  const jsText = `window.MASTERS_LEADERBOARD = ${JSON.stringify(latestLeaderboard, null, 2)};\n`;
  return { jsonText, jsText };
}

async function saveFileWithPicker(suggestedName, contents, mimeType, extension) {
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: `${extension.toUpperCase()} files`,
        accept: {
          [mimeType]: [extension]
        }
      }
    ]
  });

  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function publishLeaderboardFiles() {
  const { jsonText, jsText } = buildLeaderboardFileContents();

  if (window.showSaveFilePicker) {
    await saveFileWithPicker("leaderboard.json", jsonText, "application/json", ".json");
    await saveFileWithPicker("leaderboard.js", jsText, "text/javascript", ".js");
    return "Saved leaderboard.json and leaderboard.js. Commit and push both files so mobile devices get the update.";
  }

  downloadTextFile("leaderboard.json", jsonText, "application/json;charset=utf-8");
  downloadTextFile("leaderboard.js", jsText, "text/javascript;charset=utf-8");
  return "Downloaded leaderboard.json and leaderboard.js. Replace both repo files, then commit and push.";
}

function applyResponsiveBoardMode() {
  const useCompactTable = window.matchMedia("(max-width: 920px)").matches;
  elements.mastersBoard.style.display = "";
  elements.mastersBoardMobile.style.display = useCompactTable ? "none" : "";

  const boardTableWrap = elements.mastersBoard;
  if (useCompactTable) {
    boardTableWrap.style.display = "block";
    boardTableWrap.style.overflowX = "auto";
  } else {
    boardTableWrap.style.display = "";
    boardTableWrap.style.overflowX = "";
  }
}

function renderScoreboard(entries) {
  if (!entries.length) return renderEmptyState(elements.scoreboard);

  const rows = entries.map((entry, index) => `
    <tr>
      <td><span class="rank-pill">${index + 1}</span></td>
      <td><strong>${escapeHtml(entry.name)}</strong></td>
      <td><span class="score-pill ${index === 0 ? "leading" : ""} ${entry.hasChampion ? "" : getScoreClass(entry.rawScore)}">${entry.hasChampion ? "Winner drafted" : formatScore(entry.rawScore)}</span></td>
    </tr>
  `).join("");

  elements.scoreboard.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Entry</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderLeaderboard(players) {
  const poolLeader = latestEntries[0];
  if (!poolLeader) {
    renderEmptyState(elements.leaderboard);
    return;
  }

  const topFive = poolLeader.picks
    .filter((pick) => pick.found && hasLiveRoundData(pick))
    .slice()
    .sort((a, b) => {
      const aScore = a.scoreToPar ?? 999;
      const bScore = b.scoreToPar ?? 999;
      if (aScore !== bScore) return aScore - bScore;
      const aThru = a.thru === "F" ? 99 : (Number(a.thru) || 0);
      const bThru = b.thru === "F" ? 99 : (Number(b.thru) || 0);
      if (aThru !== bThru) return bThru - aThru;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  if (!topFive.length) {
    elements.leaderboard.innerHTML = `
      <div class="empty-state">
        <p>Current pool leader golfers will show here once live round data starts coming in.</p>
      </div>
    `;
    return;
  }

  const rows = topFive.map((player, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(player.name)}</strong></td>
      <td>${escapeHtml(player.position || "--")}</td>
      <td><span class="mini-score ${getScoreClass(player.scoreToPar)}">${formatScore(player.scoreToPar)}</span></td>
      <td>${escapeHtml(player.thru || "--")}</td>
    </tr>
  `).join("");

  elements.leaderboard.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Pos</th>
          <th>Score</th>
          <th>Thru</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMastersBoard(entries) {
  const draftedPlayers = new Map();

  entries.forEach((entry) => {
    entry.picks.forEach((pick) => {
      const key = normalizeName(pick.name);
      if (!draftedPlayers.has(key)) {
        draftedPlayers.set(key, {
          ...pick,
          owners: [entry.name]
        });
      } else {
        draftedPlayers.get(key).owners.push(entry.name);
      }
    });
  });

  const boardPlayers = Array.from(draftedPlayers.values())
    .sort(compareBoardPlayers);

  if (!boardPlayers.length) {
    renderEmptyState(elements.mastersBoard);
    renderEmptyState(elements.mastersBoardMobile);
    return;
  }

  elements.boardPlayerCount.textContent = `${boardPlayers.length} drafted golfers`;

  const rows = boardPlayers.map((player) => {
      const totalClass = getScoreClass(player.scoreToPar);
      return `
      <tr>
        <td class="board-owner">${player.owners.map((owner) => `<span class="owner-chip">${escapeHtml(owner)}</span>`).join("")}</td>
        <td>${escapeHtml(player.position || "--")}</td>
        <td class="board-player">${escapeHtml(player.name)}</td>
        <td class="board-total"><span class="board-score-pill ${totalClass}">${formatScore(player.scoreToPar)}</span></td>
        <td>${escapeHtml(player.teeTime || "--")}</td>
        <td>${escapeHtml(player.thru || "--")}</td>
        <td>${escapeHtml(player.today || "--")}</td>
        <td>${escapeHtml(player.status || (player.found ? "Active" : "Not found"))}</td>
      </tr>
      `;
    }).join("");

  const mobileCards = boardPlayers.map((player) => {
    const totalClass = getScoreClass(player.scoreToPar);
    return `
      <article class="mobile-board-card">
        <div class="mobile-board-top">
          <div class="mobile-board-owners">${player.owners.map((owner) => `<span class="owner-chip">${escapeHtml(owner)}</span>`).join("")}</div>
          <div class="mobile-board-pos">${escapeHtml(player.position || "--")}</div>
        </div>
        <div class="mobile-board-player">${escapeHtml(player.name)}</div>
        <div class="mobile-board-tee"><strong>Tee Time</strong> ${escapeHtml(player.teeTime || "--")}</div>
        <div class="mobile-board-total ${totalClass}">${formatScore(player.scoreToPar)}</div>
        <div class="mobile-board-meta">
          <span><strong>Thru</strong> ${escapeHtml(player.thru || "--")}</span>
          <span><strong>Today</strong> ${escapeHtml(player.today || "--")}</span>
          <span><strong>Status</strong> ${escapeHtml(player.status || (player.found ? "Active" : "Not found"))}</span>
        </div>
      </article>
    `;
  }).join("");

  elements.mastersBoard.innerHTML = `
    <table class="masters-board">
      <thead>
        <tr>
          <th class="picked-by"><button class="sort-button active" type="button" data-sort-key="owners">Picked By${renderSortLabel("owners")}</button></th>
          <th><button class="sort-button" type="button" data-sort-key="position">Pos${renderSortLabel("position")}</button></th>
          <th><button class="sort-button" type="button" data-sort-key="player">Player${renderSortLabel("player")}</button></th>
          <th><button class="sort-button" type="button" data-sort-key="score">Total${renderSortLabel("score")}</button></th>
          <th><button class="sort-button" type="button" data-sort-key="teeTime">Tee Time${renderSortLabel("teeTime")}</button></th>
          <th>Thru</th>
          <th>Today</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  elements.mastersBoardMobile.innerHTML = mobileCards;
  applyResponsiveBoardMode();

  elements.mastersBoard.querySelectorAll("[data-sort-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-sort-key");
      if (boardSort.key === key) {
        boardSort.direction = boardSort.direction === "asc" ? "desc" : "asc";
      } else {
        boardSort.key = key;
        boardSort.direction = key === "owners" || key === "player" ? "asc" : "asc";
      }
      renderMastersBoard(latestEntries);
    });
  });
}

function updateHeader(config, entries, leaderboard) {
  elements.tournamentName.textContent = config.tournament.name;
  elements.tournamentSubtitle.textContent = config.tournament.subtitle;
  elements.tournamentDates.textContent = config.tournament.dates;
  elements.tournamentVenue.textContent = config.tournament.venue;
  const lastUpdatedText = `Scores last updated: ${formatLastUpdated(leaderboard.lastUpdated)}`;
  elements.boardUpdate.textContent = lastUpdatedText;
  elements.scoresLastUpdated.textContent = lastUpdatedText;
  elements.boardVersion.textContent = `Build ${APP_VERSION}`;

  const eventLeader = leaderboard.players
    .slice()
    .sort((a, b) => (parseScoreToPar(a.toPar) ?? 999) - (parseScoreToPar(b.toPar) ?? 999))
    .slice(0, 3)
    .map((player) => `${player.name} (${formatScore(parseScoreToPar(player.toPar))})`)
    .join(" / ");

  elements.eventLeader.textContent = eventLeader || "No leaderboard data";
  elements.poolLeader.textContent = entries[0]
    ? `${entries[0].name} (${entries[0].hasChampion ? "winner drafted" : formatScore(entries[0].rawScore)})`
    : "No pool entries";
}

function seedAdminEditor(leaderboard) {
  elements.leaderboardInput.value = "";
  elements.leaderboardInput.placeholder = "Paste JSON, leaderboard rows, or CSV here.";
}

function renderApp(config, picks, leaderboard) {
  const normalizedLeaderboard = normalizeLeaderboardData(leaderboard);
  const lookup = buildLookup(normalizedLeaderboard.players);
  const entries = picks.entries.map((entry) => computeEntry(entry, lookup, config.scoring)).sort(compareEntries);
  latestEntries = entries;
  latestPicks = picks;
  latestLeaderboard = normalizedLeaderboard;
  updateHeader(config, entries, normalizedLeaderboard);
  renderMastersBoard(entries);
  renderScoreboard(entries);
  renderLeaderboard(normalizedLeaderboard.players);
  seedAdminEditor(normalizedLeaderboard);
}

function setAdminOpen(isOpen) {
  elements.adminPanel.classList.toggle("hidden", !isOpen);
  elements.adminPanel.setAttribute("aria-hidden", String(!isOpen));
}

function parseAdminInput(rawInput, currentLeaderboard, picks) {
  if (rawInput.startsWith("{")) {
    return validateLeaderboardData(JSON.parse(rawInput));
  }

  if (/PLAYER|NAME/i.test(rawInput) && /(TEE\s*TIME|POS|POSITION|TO\s*PAR|THRU|TODAY|STATUS)/i.test(rawInput)) {
    return parseLeaderboardCsv(rawInput, currentLeaderboard, picks);
  }

  return parseRawLeaderboardInput(rawInput, currentLeaderboard, picks);
}

async function init() {
  try {
    const { config, picks, leaderboard: leaderboardFromRepo } = await loadData();

    repoLeaderboard = leaderboardFromRepo;
    const stored = getStoredLeaderboard();
    const activeLeaderboard = stored ? validateLeaderboardData(stored) : leaderboardFromRepo;
    renderApp(config, picks, activeLeaderboard);

    elements.toggleAdmin.addEventListener("click", () => setAdminOpen(true));
    elements.closeAdmin.addEventListener("click", () => setAdminOpen(false));
    window.addEventListener("resize", applyResponsiveBoardMode);

    elements.applyData.addEventListener("click", () => {
      try {
        const rawInput = elements.leaderboardInput.value.trim();
        const parsed = parseAdminInput(rawInput, latestLeaderboard || repoLeaderboard, latestPicks || picks);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        renderApp(config, picks, parsed);
        elements.adminStatus.textContent = "Leaderboard update applied in this browser.";
      } catch (error) {
        elements.adminStatus.textContent = error.message;
      }
    });

    elements.publishData.addEventListener("click", async () => {
      try {
        const message = await publishLeaderboardFiles();
        elements.adminStatus.textContent = message;
      } catch (error) {
        elements.adminStatus.textContent = error.message;
      }
    });

    elements.csvFileInput.addEventListener("change", async (event) => {
      try {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const csvText = await file.text();
        elements.leaderboardInput.value = csvText;
        const parsed = parseLeaderboardCsv(csvText, latestLeaderboard || repoLeaderboard, latestPicks || picks);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        renderApp(config, picks, parsed);
        elements.adminStatus.textContent = `Imported CSV update from ${file.name}.`;
        event.target.value = "";
      } catch (error) {
        elements.adminStatus.textContent = error.message;
      }
    });

    elements.resetData.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      renderApp(config, picks, repoLeaderboard);
      elements.csvFileInput.value = "";
      elements.adminStatus.textContent = "Reset to the leaderboard stored in the repository.";
    });
  } catch (error) {
    console.error(error);
    [elements.mastersBoard, elements.mastersBoardMobile, elements.scoreboard, elements.leaderboard].forEach(renderEmptyState);
    elements.poolLeader.textContent = "Unable to load";
    elements.eventLeader.textContent = "Unable to load";
    elements.boardUpdate.textContent = "Load error";
  }
}

function compareText(a, b) {
  return a.localeCompare(b);
}

function renderSortLabel(key) {
  if (boardSort.key !== key) return "";
  return boardSort.direction === "asc" ? " +" : " -";
}

function compareBoardPlayers(a, b) {
  let result = 0;

  if (boardSort.key === "owners") {
    result = compareText(a.owners.join(", "), b.owners.join(", "));
  } else if (boardSort.key === "position") {
    result = (parsePosition(a.position) ?? 999) - (parsePosition(b.position) ?? 999);
    if (result === 0) result = (a.scoreToPar ?? 999) - (b.scoreToPar ?? 999);
  } else if (boardSort.key === "teeTime") {
    result = (parseTeeTime(a.teeTime) ?? 9999) - (parseTeeTime(b.teeTime) ?? 9999);
    if (result === 0) result = compareText(a.name, b.name);
  } else if (boardSort.key === "player") {
    result = compareText(a.name, b.name);
  } else {
    result = (a.scoreToPar ?? 999) - (b.scoreToPar ?? 999);
    if (result === 0) result = (parsePosition(a.position) ?? 999) - (parsePosition(b.position) ?? 999);
  }

  if (result === 0) result = compareText(a.name, b.name);
  return boardSort.direction === "asc" ? result : -result;
}

init();
