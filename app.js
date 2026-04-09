const STORAGE_KEY = "masters-2026-custom-leaderboard";
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
  boardPlayerCount: document.getElementById("board-player-count"),
  mastersBoard: document.getElementById("masters-board"),
  mastersBoardMobile: document.getElementById("masters-board-mobile"),
  scoreboard: document.getElementById("scoreboard"),
  leaderboard: document.getElementById("leaderboard"),
  adminPanel: document.getElementById("admin-panel"),
  leaderboardInput: document.getElementById("leaderboard-input"),
  adminStatus: document.getElementById("admin-status"),
  toggleAdmin: document.getElementById("toggle-admin"),
  closeAdmin: document.getElementById("close-admin"),
  applyData: document.getElementById("apply-data"),
  resetData: document.getElementById("reset-data"),
  emptyStateTemplate: document.getElementById("empty-state-template")
};

let repoLeaderboard = null;
let latestEntries = [];
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
  if (window.MASTERS_CONFIG && window.MASTERS_PICKS && window.MASTERS_LEADERBOARD) {
    return {
      config: window.MASTERS_CONFIG,
      picks: window.MASTERS_PICKS,
      leaderboard: window.MASTERS_LEADERBOARD
    };
  }

  const [config, picks, leaderboard] = await Promise.all([
    loadJson(DATA_FILES.config),
    loadJson(DATA_FILES.picks),
    loadJson(DATA_FILES.leaderboard)
  ]);

  return { config, picks, leaderboard };
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
  return String(value || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatBonus(value) {
  return value ? `-${value}` : "0";
}

function parsePosition(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  return payload;
}

function buildLookup(players) {
  const lookup = new Map();
  players.forEach((player) => {
    lookup.set(normalizeName(player.name), { ...player, scoreToPar: parseScoreToPar(player.toPar) });
  });
  return lookup;
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
    madeCutCount
  };
}

function compareEntries(a, b) {
  if (a.adjustedScore === null) return 1;
  if (b.adjustedScore === null) return -1;
  if (a.adjustedScore !== b.adjustedScore) return a.adjustedScore - b.adjustedScore;
  if (a.rawScore !== b.rawScore) return a.rawScore - b.rawScore;
  return a.name.localeCompare(b.name);
}

function renderEmptyState(target) {
  target.innerHTML = elements.emptyStateTemplate.innerHTML;
}

function renderScoreboard(entries) {
  if (!entries.length) return renderEmptyState(elements.scoreboard);

  const rows = entries.map((entry, index) => `
    <tr>
      <td><span class="rank-pill">${index + 1}</span></td>
      <td><strong>${escapeHtml(entry.name)}</strong></td>
      <td><span class="score-pill ${index === 0 ? "leading" : ""}">${formatScore(entry.rawScore)}</span></td>
    </tr>
  `).join("");

  elements.scoreboard.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Entry</th>
          <th>Best 4 Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderLeaderboard(players) {
  elements.leaderboard.innerHTML = `
    <div class="empty-state">
      <p>Data comes from <code>data/picks.js</code> and <code>data/leaderboard.js</code> right now.</p>
      <p>We can swap this to a live golf feed later and keep the same board layout.</p>
    </div>
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
      const totalClass = player.scoreToPar > 0 ? "over" : "under";
      return `
      <tr>
        <td class="board-owner">${player.owners.map((owner) => `<span class="owner-chip">${escapeHtml(owner)}</span>`).join("")}</td>
        <td>${escapeHtml(player.position || "--")}</td>
        <td class="board-player">${escapeHtml(player.name)}</td>
        <td class="board-total ${totalClass}">${formatScore(player.scoreToPar)}</td>
        <td>${escapeHtml(player.thru || "--")}</td>
        <td>${escapeHtml(player.today || "--")}</td>
        <td>${escapeHtml(player.status || (player.found ? "Active" : "Not found"))}</td>
      </tr>
      `;
    }).join("");

  const mobileCards = boardPlayers.map((player) => {
    const totalClass = player.scoreToPar > 0 ? "over" : "under";
    return `
      <article class="mobile-board-card">
        <div class="mobile-board-top">
          <div class="mobile-board-owners">${player.owners.map((owner) => `<span class="owner-chip">${escapeHtml(owner)}</span>`).join("")}</div>
          <div class="mobile-board-pos">${escapeHtml(player.position || "--")}</div>
        </div>
        <div class="mobile-board-player">${escapeHtml(player.name)}</div>
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
          <th>Thru</th>
          <th>Today</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  elements.mastersBoardMobile.innerHTML = mobileCards;

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
  elements.boardUpdate.textContent = leaderboard.lastUpdated || "Waiting for data";

  const eventLeader = leaderboard.players
    .slice()
    .sort((a, b) => (parseScoreToPar(a.toPar) ?? 999) - (parseScoreToPar(b.toPar) ?? 999))
    .slice(0, 3)
    .map((player) => `${player.name} (${formatScore(parseScoreToPar(player.toPar))})`)
    .join(" / ");

  elements.eventLeader.textContent = eventLeader || "No leaderboard data";
  elements.poolLeader.textContent = entries[0] ? `${entries[0].name} (${formatScore(entries[0].rawScore)})` : "No pool entries";
}

function seedAdminEditor(leaderboard) {
  elements.leaderboardInput.value = JSON.stringify(leaderboard, null, 2);
}

function renderApp(config, picks, leaderboard) {
  const lookup = buildLookup(leaderboard.players);
  const entries = picks.entries.map((entry) => computeEntry(entry, lookup, config.scoring)).sort(compareEntries);
  latestEntries = entries;
  updateHeader(config, entries, leaderboard);
  renderMastersBoard(entries);
  renderScoreboard(entries);
  renderLeaderboard(leaderboard.players);
  seedAdminEditor(leaderboard);
}

function setAdminOpen(isOpen) {
  elements.adminPanel.classList.toggle("hidden", !isOpen);
  elements.adminPanel.setAttribute("aria-hidden", String(!isOpen));
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

    elements.applyData.addEventListener("click", () => {
      try {
        const parsed = validateLeaderboardData(JSON.parse(elements.leaderboardInput.value));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        renderApp(config, picks, parsed);
        elements.adminStatus.textContent = "Custom leaderboard applied in this browser.";
      } catch (error) {
        elements.adminStatus.textContent = error.message;
      }
    });

    elements.resetData.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      renderApp(config, picks, repoLeaderboard);
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

function renderSortArrow(key) {
  if (boardSort.key !== key) return "";
  return boardSort.direction === "asc" ? " ▲" : " ▼";
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
