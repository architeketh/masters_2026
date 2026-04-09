$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $repoRoot "data"
$jsonPath = Join-Path $dataDir "leaderboard.json"
$jsPath = Join-Path $dataDir "leaderboard.js"

if (-not (Test-Path $jsonPath)) {
  throw "Missing file: $jsonPath"
}

if (-not (Test-Path $jsPath)) {
  throw "Missing file: $jsPath"
}

$gitDir = Join-Path $repoRoot ".git"
if (-not (Test-Path $gitDir)) {
  throw "This folder is not a Git repository yet. Initialize or clone your GitHub repo into: $repoRoot"
}

$branch = git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch -or $LASTEXITCODE -ne 0) {
  throw "Unable to determine the current Git branch."
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Update Masters leaderboard data ($timestamp)"

Write-Host "Staging leaderboard files..."
git -C $repoRoot add -- "data/leaderboard.json" "data/leaderboard.js"

$status = git -C $repoRoot diff --cached --name-only
if (-not $status) {
  Write-Host "No staged changes found in leaderboard files. Nothing to publish."
  exit 0
}

Write-Host "Creating commit: $commitMessage"
git -C $repoRoot commit -m $commitMessage

Write-Host "Pushing to origin/$branch ..."
git -C $repoRoot push origin $branch

Write-Host ""
Write-Host "Publish complete."
Write-Host "GitHub Pages should update after the push finishes processing."
