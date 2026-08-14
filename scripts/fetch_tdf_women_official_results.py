#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

STAGE = int(sys.argv[1])
URL = f"https://www.letourfemmes.fr/en/rankings/stage-{STAGE}"
OUT_DIR = Path(__file__).resolve().parents[1] / "archive" / "generated" / "2026-tdf-women" / "results"


def seconds(value):
    match = re.search(r"(\d{2})h\s*(\d{2})'\s*(\d{2})''", value)
    if not match:
        return None
    hours, minutes, secs = map(int, match.groups())
    return hours * 3600 + minutes * 60 + secs


def gap_text(delta):
    if delta == 0:
        return "s.t."
    hours, rem = divmod(delta, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{hours}:{minutes:02}:{secs:02}" if hours else f"{minutes}:{secs:02}"


response = requests.get(URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
response.raise_for_status()
soup = BeautifulSoup(response.text, "html.parser")
rows = soup.select("table.rankingTable tr")
results = []
leader_seconds = None
for row in rows:
    cells = row.find_all("td")
    if len(cells) < 6:
        continue
    rank = cells[0].get_text(" ", strip=True)
    if not rank.isdigit():
        continue
    rider = row.select_one("a.rankingTables__row__profile--name")
    rider_img = row.select_one("img.rankingTables__row__profile--picture")
    team = row.select_one("td.team a")
    time_cell = row.select_one("td.time")
    if not rider or not team or not time_cell:
        continue
    rider_name = rider_img.get("alt", "").strip() if rider_img else ""
    rider_name = rider_name or rider.get_text(" ", strip=True)
    total = seconds(time_cell.get_text(" ", strip=True))
    if total is None:
        continue
    if leader_seconds is None:
        leader_seconds = total
    results.append({
        "rank": int(rank),
        "rider": rider_name,
        "nationality": "UNK",
        "team": team.get_text(" ", strip=True),
        "stage_time": gap_text(total - leader_seconds),
    })

OUT_DIR.mkdir(parents=True, exist_ok=True)
out = OUT_DIR / f"tdf_s{STAGE}_results.json"
out.write_text(json.dumps({"stage": STAGE, "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Stage {STAGE}: {len(results)} official results -> {out}")
