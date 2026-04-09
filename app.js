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
  entryCount: document.getElementById("entry-count"),
  golferCount: document.getElementById("golfer-count"),
  scoringFormat: document.getElementById("scoring-format"),
  lastUpdated: document.getElementById("last-updated"),
  scoreboard: document.getElementById("scoreboard"),
  leaderboard: document.getElementById("leaderboard"),
  teamGrid: document.getElementById("team-grid"),
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

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
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
      <td><strong>${escapeHtml(entry.name)}</strong><br><span class="muted">${entry.counted.length} counted golfers</span></td>
      <td><span class="score-pill ${index === 0 ? "leading" : ""}">${formatScore(entry.adjustedScore)}</span></td>
      <td>${formatScore(entry.rawScore)}</td>
      <td>${formatBonus(entry.bonus)}</td>
      <td>${entry.counted.map((pick) => escapeHtml(pick.name)).join(", ") || "--"}</td>
    </tr>
  `).join("");

  elements.scoreboard.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Entry</th>
          <th>Adjusted</th>
          <th>Raw</th>
          <th>Bonus</th>
          <th>Counted Picks</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderLeaderboard(players) {
  if (!players.length) return renderEmptyState(elements.leaderboard);

  const rows = players
    .slice()
    .sort((a, b) => (parseScoreToPar(a.toPar) ?? 999) - (parseScoreToPar(b.toPar) ?? 999))
    .slice(0, 12)
    .map((player) => `
      <tr>
        <td>${escapeHtml(player.position || "--")}</td>
        <td>${escapeHtml(player.name)}</td>
        <td>${escapeHtml(player.thru || "--")}</td>
        <td>${formatScore(parseScoreToPar(player.toPar))}</td>
        <td>${escapeHtml(player.today || "--")}</td>
        <td>${escapeHtml(player.status || "Active")}</td>
      </tr>
    `).join("");

  elements.leaderboard.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Pos</th>
          <th>Player</th>
          <th>Thru</th>
          <th>To Par</th>
          <th>Today</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTeamCards(entries) {
  if (!entries.length) return renderEmptyState(elements.teamGrid);

  elements.teamGrid.innerHTML = entries.map((entry, index) => {
    const picks = entry.picks.map((pick) => {
      const badges = [];
      if (pick.counted) badges.push('<span class="badge counted">Counted</span>');
      if (pick.isChampion) badges.push('<span class="badge">Champion</span>');
      if (pick.madeCut) badges.push('<span class="badge cut">Made cut</span>');
      if (pick.found && (parsePosition(pick.position) ?? 999) <= 10) badges.push('<span class="badge">Top 10</span>');

      return `
        <div class="pick-row ${pick.counted ? "counted" : ""} ${pick.found ? "" : "missing"}">
          <div>
            <div class="pick-player">${escapeHtml(pick.name)}</div>
            <div class="pick-meta">
              <span class="pick-status">Pos ${escapeHtml(pick.position || "--")}</span>
              <span class="pick-status">${escapeHtml(pick.thru || "--")}</span>
              <span class="pick-status">${escapeHtml(pick.status || "Active")}</span>
            </div>
          </div>
          <div>
            <strong>${formatScore(pick.scoreToPar)}</strong>
            <div class="pick-meta">${badges.join("")}</div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <article class="team-card">
        <div class="team-head">
          <div>
            <p class="section-label">#${index + 1} in pool</p>
            <h3>${escapeHtml(entry.name)}</h3>
          </div>
          <span class="rank-pill">${entry.counted.length}/${entry.picks.length} active</span>
        </div>
        <div class="team-score-row">
          <div>
            <div class="team-note">Adjusted score</div>
            <div class="team-score">${formatScore(entry.adjustedScore)}</div>
          </div>
          <div>
            <div class="team-note">Raw ${formatScore(entry.rawScore)}</div>
            <div class="team-note">Bonus ${formatBonus(entry.bonus)}</div>
          </div>
        </div>
        <div class="bonus-grid">
          <div class="bonus-row"><span>Champion bonus</span><strong>${entry.championCount} x</strong></div>
          <div class="bonus-row"><span>Top 10 bonus</span><strong>${entry.topTenCount} x</strong></div>
          <div class="bonus-row"><span>Made cut bonus</span><strong>${entry.madeCutCount} x</strong></div>
        </div>
        <div class="pick-list">${picks}</div>
      </article>
    `;
  }).join("");
}

function updateHeader(config, entries, leaderboard) {
  elements.tournamentName.textContent = config.tournament.name;
  elements.tournamentSubtitle.textContent = config.tournament.subtitle;
  elements.tournamentDates.textContent = config.tournament.dates;
  elements.tournamentVenue.textContent = config.tournament.venue;
  elements.entryCount.textContent = String(entries.length);
  elements.golferCount.textContent = String(leaderboard.players.length);
  elements.scoringFormat.textContent = `Best ${config.scoring.countBest} of ${config.scoring.teamSize}`;
  elements.lastUpdated.textContent = leaderboard.lastUpdated || "Waiting for data";

  const eventLeader = leaderboard.players
    .slice()
    .sort((a, b) => (parseScoreToPar(a.toPar) ?? 999) - (parseScoreToPar(b.toPar) ?? 999))
    .slice(0, 3)
    .map((player) => `${player.name} (${formatScore(parseScoreToPar(player.toPar))})`)
    .join(" / ");

  elements.eventLeader.textContent = eventLeader || "No leaderboard data";
  elements.poolLeader.textContent = entries[0] ? `${entries[0].name} (${formatScore(entries[0].adjustedScore)})` : "No pool entries";
}

function seedAdminEditor(leaderboard) {
  elements.leaderboardInput.value = JSON.stringify(leaderboard, null, 2);
}

function renderApp(config, picks, leaderboard) {
  const lookup = buildLookup(leaderboard.players);
  const entries = picks.entries.map((entry) => computeEntry(entry, lookup, config.scoring)).sort(compareEntries);
  updateHeader(config, entries, leaderboard);
  renderScoreboard(entries);
  renderLeaderboard(leaderboard.players);
  renderTeamCards(entries);
  seedAdminEditor(leaderboard);
}

function setAdminOpen(isOpen) {
  elements.adminPanel.classList.toggle("hidden", !isOpen);
  elements.adminPanel.setAttribute("aria-hidden", String(!isOpen));
}

async function init() {
  try {
    const [config, picks, leaderboardFromRepo] = await Promise.all([
      loadJson(DATA_FILES.config),
      loadJson(DATA_FILES.picks),
      loadJson(DATA_FILES.leaderboard)
    ]);

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
    [elements.scoreboard, elements.leaderboard, elements.teamGrid].forEach(renderEmptyState);
    elements.poolLeader.textContent = "Unable to load";
    elements.eventLeader.textContent = "Unable to load";
    elements.lastUpdated.textContent = "Load error";
  }
}

init();
