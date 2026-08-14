#!/usr/bin/env python3
"""Fetch Tour de Pologne (men) 2026 stage data from the official timing site
tdp.infocity.pl. The site is a legacy ASP app; every ranking is a JS file
loaded from /updatefields.asp?typ=..&race=21&ced=<stageId>&kl=<class>:

  typ=ETAP kl=I   stage results   ra=[rank, rider_html, bib, team_code, bon, time, pts, kary]
  typ=GENE kl=I   GC              ra=[rank, rider_html, bib, team_code, total_time, ..]
  typ=GENE kl=P   points          ra=[rank, rider_html, bib, team_code, points]
  typ=GENE kl=G   mountains       ra=[rank, rider_html, bib, team_code, points]
  typ=GENE kl=D2  team            ra=[rank, team_name, team_code, total_time, ..]

Output (same schema as import_race_data.py / import_race_data.js):
  temp/tour-pologne-2026_s<N>_results.json
  temp/tour-pologne-2026_s<N>_data.json
"""
import json
import re
import sys

import requests

STAGE = int(sys.argv[1])
RACE_ID = 21          # men's Tour de Pologne on tdp.infocity.pl
CED = 140 + STAGE     # stage-1 -> 141, stage-2 -> 142, ...
BASE = "https://tdp.infocity.pl/updatefields.asp"
OUT = "D:/codes/velo-rank/temp"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

# common Polish flag file -> ISO nationality code
FLAG_MAP = {
    "wlochy": "IT", "francja": "FR", "gb": "GB", "kolumbia": "CO", "belgia": "BE",
    "hiszpania": "ES", "norwegia": "NO", "polska": "PL", "niemcy": "DE", "dania": "DK",
    "holandia": "NL", "australia": "AU", "portugalia": "PT", "slowenia": "SI",
    "austria": "AT", "szwajcaria": "CH", "usa": "US", "kanada": "CA", "irlandia": "IE",
    "czechy": "CZ", "slowacja": "SK", "ukraina": "UA", "litwa": "LT", "lotwa": "LV",
    "estonii": "EE", "grecja": "GR", "nowa-zelandia": "NZ", "japonia": "JP",
    "luksemburg": "LU", "wielka-brytania": "GB",
}


def fetch(typ, klas):
    url = (f"{BASE}?typ={typ}&race={RACE_ID}&test={RACE_ID}&ced={CED}&ed={CED}"
           f"&kl={klas}&refill=0&lng=en&lu=&rnd=1&official=1")
    for attempt in range(4):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200 and 'ra[0]' in r.text:
                r.encoding = "utf-8"
                return r.text
        except Exception:
            pass
        import time
        time.sleep(2 + attempt * 2)
    raise RuntimeError(f"fetch failed typ={typ} klas={klas}")


def parse_rows(js):
    rows = []
    for m in re.finditer(r"ra\[(\d+)\]\s*=\s*Array\((.*?)\);", js, re.S):
        idx = int(m.group(1))
        cells = [c.replace("\\'", "'") for c in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(2))]
        rows.append((idx, cells))
    rows.sort()
    return [c for _, c in rows]


def clean(s):
    if s is None:
        return ""
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()


def parse_rider(html):
    """Return (rider_name, nationality) from '<img .../>MILAN Jonathan'."""
    flag = re.search(r"flagi/([^./]+)\.gif", html)
    nat = FLAG_MAP.get(flag.group(1), "") if flag else ""
    name = clean(html)
    return name, nat


def parse_time(v):
    """'05h 04' 11''' -> '5:04:11'; ITT '14' 25''' -> '14:25'; '+ 01' 23''' -> '1:23'; '+ 00' 00''' -> 's.t.'"""
    v = clean(v)
    if not v or v in ("&nbsp;", "-", ".."):
        return "s.t."
    if v.startswith("+"):
        m = re.search(r"(\d+)'\s*(\d+)''", v)
        if not m:
            return "s.t."
        mm, ss = int(m.group(1)), int(m.group(2))
        if mm == 0 and ss == 0:
            return "s.t."
        return f"{mm}:{ss:02}" if ss else f"{mm}:00"
    m = re.search(r"(\d+)h\s*(\d+)'\s*(\d+)''", v)
    if m:
        h, mi, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{h}:{mi:02}:{s:02}"
    m = re.search(r"(\d+)'\s*(\d+)''", v)
    if m:
        mi, s = int(m.group(1)), int(m.group(2))
        return f"{mi}:{s:02}"
    return v


def parse_gap(v):
    """GC gap: '+ 01' 23''' -> '+1:23'; '+ 00' 00''' -> '+0:00'"""
    v = clean(v)
    if v.startswith("+"):
        m = re.search(r"(\d+)'\s*(\d+)''", v)
        if m:
            mm, ss = int(m.group(1)), int(m.group(2))
            return f"+{mm}:{ss:02}"
        return "+0:00"
    return "+0:00"


def secs_of(v):
    """'8:09:28' -> seconds; '1:23' -> 83"""
    parts = v.split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return 0


def gap_from(secs):
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"+{h}:{m:02}:{s:02}"
    return f"+{m}:{s:02}"


def pick_time_cell(cells):
    """Road stages: [rank,rider,bib,team,bon,time,pts,kary]; ITT: [rank,rider,bib,team,time,kary,inter]. Find the time cell."""
    for i in (4, 5, 3):
        if i < len(cells):
            v = clean(cells[i])
            if re.search(r"(\d+)h\s*(\d+)'\s*(\d+)''", v) or re.search(r"(\d+)'\s*(\d+)''", v) or v.startswith("+"):
                return i
    return 5


def main():
    team_rows = parse_rows(fetch("GENE", "D2"))
    code_map = {}
    for cells in team_rows:
        if len(cells) >= 3 and clean(cells[1]):
            code_map[clean(cells[2])] = clean(cells[1])

    def team_name(code):
        return code_map.get(code, code)

    # ---- stage results (ETAP) ----
    results = []
    for cells in parse_rows(fetch("ETAP", "I")):
        if len(cells) < 5 or not cells[0].strip().isdigit():
            continue
        rider, nat = parse_rider(cells[1])
        if not rider:
            continue
        results.append({
            "rank": int(cells[0]),
            "rider": rider,
            "nationality": nat,
            "team": team_name(cells[3]),
            "stage_time": parse_time(cells[pick_time_cell(cells)]),
        })

    # ---- GC (every row carries its own absolute cumulative time) ----
    gc_raw = []
    for cells in parse_rows(fetch("GENE", "I")):
        if len(cells) < 5 or not cells[0].strip().isdigit():
            continue
        rider, nat = parse_rider(cells[1])
        if not rider:
            continue
        gc_raw.append({
            "rank": int(cells[0]), "rider": rider, "nationality": nat,
            "team": team_name(cells[3]),
            "total_time": parse_time(cells[4]) if not clean(cells[4]).startswith("+") else "",
        })
    leader_secs = None
    gc = []
    for g in gc_raw:
        if g["total_time"]:
            secs = secs_of(g["total_time"])
            if leader_secs is None:
                leader_secs = secs
                g["time_gap"] = "+0:00"
            else:
                g["time_gap"] = gap_from(secs - leader_secs)
        else:
            g["time_gap"] = parse_gap("+ 00' 00''")
        gc.append(g)

    def points_list(klas):
        out = []
        for cells in parse_rows(fetch("GENE", klas)):
            if len(cells) < 5 or not cells[0].strip().isdigit():
                continue
            rider, nat = parse_rider(cells[1])
            if not rider:
                continue
            out.append({
                "rank": int(cells[0]), "rider": rider, "nationality": nat,
                "team": team_name(cells[3]), "points": clean(cells[4]) or "0",
            })
        return out

    team = [
        {"rank": int(c[0]), "team": clean(c[1]), "total_time": parse_time(c[3]) if len(c) > 3 else None, "time_gap": None}
        for c in team_rows if len(c) >= 4 and clean(c[1])
    ]

    results_file = f"{OUT}/tour-pologne-2026_s{STAGE}_results.json"
    data_file = f"{OUT}/tour-pologne-2026_s{STAGE}_data.json"
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump({"stage": STAGE, "results": results}, f, ensure_ascii=False, indent=2)
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump({
            "stage": STAGE,
            "gc": gc,
            "points": points_list("P"),
            "kom": points_list("G"),
            "youth": [],
            "team": team,
        }, f, ensure_ascii=False, indent=2)
    print(f"S{STAGE}: results={len(results)} gc={len(gc)} points={len(gc) and len(points_list('P'))} "
          f"kom={len(points_list('G'))} team={len(team)} code_map={len(code_map)}")


if __name__ == "__main__":
    main()
