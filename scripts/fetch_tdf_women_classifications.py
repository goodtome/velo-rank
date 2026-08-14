#!/usr/bin/env python3
"""Fetch official Tour de France Femmes classification tables (AJAX).

The official ranking pages embed per-stage AJAX URLs (data-ajax-stack /
data-tabs-ajax). Each returns a full HTML fragment with one rankingTable:
  itg general | ipg points | img mountains | ijg youth | etg team

Output (one JSON per stage):
  archive/generated/2026-tdf-women/classifications/tdf_sN_data.json
with keys gc/points/kom/youth/team, entries shaped like the PCS fetcher so
import_classifications.js can consume them unchanged.
"""
import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

STAGE = int(sys.argv[1])
HOST = "https://www.letourfemmes.fr"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
OUT_DIR = Path(__file__).resolve().parents[1] / "archive" / "generated" / "2026-tdf-women" / "classifications"

TYPE_MAP = {"itg": "gc", "ipg": "points", "img": "kom", "ijg": "youth", "etg": "team"}


def clean(text):
    return re.sub(r"\s+", " ", text).strip() if text else ""


def time_to_secs(value):
    match = re.search(r"(\d{2})h\s*(\d{2})'\s*(\d{2})''", value)
    if not match:
        return None
    return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3))


def gap_str(delta):
    if delta == 0:
        return "+0:00"
    hours, rem = divmod(delta, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"+{hours}:{minutes:02}:{secs:02}"
    return f"+{minutes}:{secs:02}"


def fetch(url):
    for attempt in range(4):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=40)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, "html.parser")
        except Exception:
            pass
        import time
        time.sleep(2 + attempt * 2)
    raise RuntimeError(f"fetch failed: {url}")


def parse_rider_rows(soup):
    rows = []
    for tr in soup.select("table.rankingTable tr"):
        # Full table is served with extra rows hidden (is-hidden) until the
        # "Next rankings" button un-hides them client-side.
        tr["class"] = [c for c in (tr.get("class") or []) if c != "is-hidden"]
        rank_cell = tr.select_one("td")
        if not rank_cell or not rank_cell.get_text(strip=True).isdigit():
            continue
        tds = tr.select("td")
        img = tr.select_one("img.rankingTables__row__profile--picture")
        name_el = tr.select_one("a.rankingTables__row__profile--name")
        rider = (img.get("alt", "").strip() if img else "") or (clean(name_el.get_text()) if name_el else "")
        team_el = tr.select_one("td.team a") or tr.select_one("td.team")
        team = clean(team_el.get_text()) if team_el else ""
        if not rider or not team:
            continue
        rank = int(rank_cell.get_text(strip=True))
        # Rider tables: [rank, rider, no, bib, team, value1, value2, ...]
        values = [clean(td.get_text()) for td in tds]
        rows.append({"rank": rank, "rider": rider, "team": team, "values": values})
    return rows


def parse_team_rows(soup):
    rows = []
    for tr in soup.select("table.rankingTable tr"):
        tr["class"] = [c for c in (tr.get("class") or []) if c != "is-hidden"]
        rank_cell = tr.select_one("td")
        if not rank_cell or not rank_cell.get_text(strip=True).isdigit():
            continue
        tds = tr.select("td")
        # Team tables: [rank, team, times, gap, ...]
        if len(tds) < 3:
            continue
        team_el = tds[1].select_one("a") or tds[1]
        team = clean(team_el.get_text())
        if not team:
            continue
        rows.append({"rank": int(rank_cell.get_text(strip=True)), "team": team, "values": [clean(td.get_text()) for td in tds]})
    return rows


def extract_entries(kind, rows):
    out = []
    leader_secs = None
    for r in rows:
        values = r["values"]
        entry = {"rank": r["rank"], "rider": r["rider"], "rider_id": "", "nationality": "", "team": r["team"]}
        if kind == "gc":
            # Rider tables: [..., team, times, gap, B, P]
            total = time_to_secs(values[-4] if len(values) >= 5 else "")
            if total is not None:
                if leader_secs is None:
                    leader_secs = total
                    entry["total_time"] = values[-4]
                    entry["time_gap"] = "0:00"
                else:
                    entry["total_time"] = ""
                    entry["time_gap"] = gap_str(total - leader_secs)
            else:
                entry["total_time"] = ""
                entry["time_gap"] = "+0:00"
            entry["points"] = ""
        elif kind == "youth":
            # Youth shares the GC column layout (times/gap).
            total = time_to_secs(values[-4] if len(values) >= 5 else "")
            if total is not None:
                if leader_secs is None:
                    leader_secs = total
                    entry["total_time"] = values[-4]
                    entry["time_gap"] = "0:00"
                else:
                    entry["total_time"] = ""
                    entry["time_gap"] = gap_str(total - leader_secs)
            else:
                entry["total_time"] = ""
                entry["time_gap"] = "+0:00"
            entry["points"] = ""
        else:  # points / kom: value ends with 'PTS'
            pts = re.sub(r"\D", "", values[-2] if len(values) >= 3 else "0")
            entry["points"] = pts or "0"
            entry["time_gap"] = ""
            entry["total_time"] = ""
        out.append(entry)
    return out


def extract_team(rows):
    out = []
    for r in rows:
        values = r["values"]
        # [rank, team, times, gap, ...] -> total_time = times column
        out.append({"rank": r["rank"], "team": r["team"], "total_time": values[2] if len(values) > 2 else None, "time_gap": None})
    return out


def main():
    page = fetch(f"{HOST}/en/rankings/stage-{STAGE}")
    stack = None
    for el in page.select("span[data-ajax-stack]"):
        try:
            parsed = json.loads(el.get("data-ajax-stack"))
        except Exception:
            continue
        if "itg" in parsed:
            stack = parsed
            break
    if not stack:
        raise RuntimeError(f"stage {STAGE}: no general-ranking ajax stack found")

    data = {"stage": STAGE, "gc": [], "points": [], "kom": [], "youth": [], "team": []}
    for typ, kind in TYPE_MAP.items():
        if typ not in stack:
            continue
        soup = fetch(HOST + stack[typ])
        if kind == "team":
            data["team"] = extract_team(parse_team_rows(soup))
        else:
            data[kind] = extract_entries(kind, parse_rider_rows(soup))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUT_DIR / f"tdf_s{STAGE}_data.json"
    out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Stage {STAGE}: gc={len(data['gc'])} points={len(data['points'])} kom={len(data['kom'])} "
          f"youth={len(data['youth'])} team={len(data['team'])} -> {out_file}")


if __name__ == "__main__":
    main()
