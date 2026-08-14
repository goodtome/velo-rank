#!/usr/bin/env python3
"""
Fetch Tour de France 2026 stage classification data from ProCyclingStats.
Validated table-offset layout for road stages (S2-S5):
  Table 0 = stage results (13 cols)
  Table 1 = GC (13 cols)
  Table 2 = Points (green)  -> 11 cols, rider@7 team@8 points@9
  Table 5 = KOM (polka)     -> 11 cols, rider@7 team@8 points@9
  Table 10 = Youth (white)  -> 11 cols, rider@7 team@8 time@9 gap@10
Team classification comes from the /stage-N/teams subpage.

For S1 (TTT) the layout differs (30 tables); points/kom/youth are not
awarded, so those extract as empty while team is still fetched.

Output: archive/generated/2026-tdf/classifications/tdf_sN_data.json  (N = stage number)
Set TDF_DATA_DIR to override the output directory.
"""
import requests
import sys
import json
import re
import os
from pathlib import Path
from bs4 import BeautifulSoup

STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 4
RACE_PATH = os.environ.get('PCS_RACE_PATH', 'tour-de-france')
RACE_YEAR = os.environ.get('PCS_RACE_YEAR', '2026')
PCS_URL = f"https://www.procyclingstats.com/race/{RACE_PATH}/{RACE_YEAR}/stage-{STAGE}"
SCRAPERAPI_KEY = os.environ.get('SCRAPERAPI_KEY', '')
BASE = (f"https://api.scraperapi.com?api_key={SCRAPERAPI_KEY}&url={PCS_URL}"
        if SCRAPERAPI_KEY else PCS_URL)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Referer": "https://www.procyclingstats.com/",
}

def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_rider_cell(td):
    a_tag = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a_tag:
        return clean(td.get_text()), "", ""
    span_upper = a_tag.find('span', class_='uppercase')
    if span_upper:
        surname = span_upper.get_text(strip=True)
        firstname = a_tag.get_text(strip=True).replace(surname, '').strip()
        name = f"{surname} {firstname}"
    else:
        name = a_tag.get_text(strip=True)
    flag = td.find('span', class_=lambda x: x and 'flag' in (x if isinstance(x, list) else [x]))
    nationality = ""
    if flag:
        classes = flag.get('class', [])
        country_code = next((c for c in classes if c != 'flag'), '')
        nationality = country_code.upper()
    href = a_tag.get('href', '')
    rider_id = href.split('/')[-1] if href else ""
    return name, nationality, rider_id

def parse_team_cell(td):
    a_tag = td.find('a', href=lambda x: x and 'team/' in x)
    if a_tag:
        return a_tag.get_text(strip=True)
    return clean(td.get_text())

def parse_time_cell(td):
    font = td.find('font')
    if font:
        time_text = font.get_text(strip=True)
        if time_text and time_text != ',,':
            return time_text
    if ',,' in td.get_text():
        return "s.t."
    return clean(td.get_text())

def parse_value_cell(td):
    """Return the value, preferring the <font> child to avoid font+hide duplication
    (e.g. '55' rendered as '5555' by get_text)."""
    font = td.find('font')
    if font:
        return clean(font.get_text())
    return clean(td.get_text())

def fetch(url):
    last = None
    for attempt in range(4):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, 'html.parser')
            last = f"HTTP {resp.status_code}"
        except Exception as e:
            last = str(e)
        import time as _t
        _t.sleep(2 + attempt * 2)
    print(f"Fetch failed after retries {url}: {last}", file=sys.stderr)
    return None

def extract_classification_at(soup, index, kind):
    """Extract a classification table at a specific table index.
    kind: 'points' | 'kom' | 'youth' | 'gc'
    Returns list of dicts.
    """
    tables = soup.find_all('table')
    if index >= len(tables):
        return []
    table = tables[index]
    rows = table.find_all('tr')
    out = []
    for row in rows:
        tds = row.find_all('td')
        if len(tds) < 8:
            continue
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        # rider column: prefer 7 (11-col main tables), fallback 5 (9-col)
        rider_idx = 7 if len(tds) >= 11 else 5
        team_idx = rider_idx + 1
        rider_name, nationality, rider_id = parse_rider_cell(tds[rider_idx])
        if not rider_name:
            continue
        team = parse_team_cell(tds[team_idx]) if len(tds) > team_idx else ""
        entry = {
            'rank': rank, 'rider': rider_name, 'rider_id': rider_id,
            'nationality': nationality, 'team': team,
        }
        if kind in ('gc', 'youth'):
            # GC uses the wide stage-page layout: rider@7, team@8, UCI@9,
            # movement@10, cumulative time/gap@11. Youth is a narrow
            # classification layout with the time/gap immediately after team.
            tcol = 11 if kind == 'gc' and len(tds) >= 13 else rider_idx + 2
            raw = parse_value_cell(tds[tcol]) if tcol < len(tds) else ""
            if rank == '1':
                entry['total_time'] = raw
                entry['time_gap'] = "0:00"
            else:
                entry['total_time'] = ""
                if raw in ('..', 's.t.', '', ',,0:00'):
                    entry['time_gap'] = "+0:00"
                elif raw.startswith('+'):
                    entry['time_gap'] = raw
                else:
                    entry['time_gap'] = "+" + raw
            entry['points'] = ""
        else:
            # points column at rider_idx+2
            pcol = rider_idx + 2
            pval = parse_value_cell(tds[pcol]) if pcol < len(tds) else ""
            try:
                entry['points'] = str(int(pval))
            except ValueError:
                entry['points'] = pval if pval.isdigit() else "0"
            entry['time_gap'] = ""
            entry['total_time'] = ""
        out.append(entry)
    return out

def extract_team_classification(soup):
    """Team classification lives on the MAIN stage page (not the /teams subpage,
    which just re-serves stage results). It appears as a table with a team link
    in col 1 or 3, a division token (WT/Pro/Cont), and a time column.
    PCS shows the cumulative time for the leader but the GAP for other rows in
    the same 'Time' column, so we store that value directly in total_time
    (matching the existing DB convention) and leave time_gap null.
    """
    best = None
    best_rows = 0
    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        if len(rows) < 5:
            continue
        first = rows[1].find_all('td')
        team_idx = -1
        for ci in (1, 3):
            if ci < len(first) and first[ci].find('a', href=lambda x: x and 'team/' in x):
                team_idx = ci
                break
        if team_idx < 0:
            continue
        time_col = team_idx + 2
        if time_col >= len(first):
            continue
        tc = parse_value_cell(first[time_col])
        if not re.match(r'^\+?\d{1,2}:\d{2}', tc) and tc not in ('s.t.', '..', ''):
            continue
        if len(rows) > best_rows:
            best = (table, team_idx)
            best_rows = len(rows)
    if not best:
        return []
    table, team_idx = best
    time_col = team_idx + 2
    out = []
    for row in table.find_all('tr'):
        tds = row.find_all('td')
        if len(tds) <= team_idx:
            continue
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        team = parse_team_cell(tds[team_idx])
        if not team:
            continue
        total_time = parse_value_cell(tds[time_col]) if time_col < len(tds) else ""
        out.append({
            'rank': rank, 'team': team,
            'total_time': total_time, 'time_gap': None,
        })
    return out

def find_youth_index(soup):
    """Youth (white jersey) cumulative classification. PCS inserts extra
    stage-breakdown tables that shift the table index between stages, so we
    locate it by content instead of hardcoding.

    Signature of the real youth table: it is a RIDER classification (has a
    rider link), has a 'Time' column, but NO 'UCI' (GC has UCI) and NO 'Pnt'
    (points/KOM have Pnt). Among all tables matching that signature we pick
    the one with the MOST rows — the cumulative youth standings (≈40 U25
    riders) is larger than any daily-breakdown variant (which also lacks
    UCI/Pnt but is much shorter). Note: do NOT require a 'Prev' column; on
    some stages the genuine youth table has no Prev while a smaller look-alike
    does, which would otherwise be mis-picked.
    """
    best = None
    best_rows = 0
    for i, table in enumerate(soup.find_all('table')):
        th = ' | '.join(clean(c.get_text()) for c in table.find_all('th'))
        if 'Time' not in th or 'UCI' in th or 'Pnt' in th:
            continue
        if not table.find('a', href=lambda x: x and 'rider/' in x):
            continue
        rows = table.find_all('tr')
        if len(rows) > best_rows:
            best = i
            best_rows = len(rows)
    return best

def main():
    soup = fetch(BASE)
    if not soup:
        sys.exit(1)
    data = {
        'stage': STAGE,
        'gc': extract_classification_at(soup, 1, 'gc'),
        'points': extract_classification_at(soup, 2, 'points'),
        'kom': extract_classification_at(soup, 5, 'kom'),
        'youth': (extract_classification_at(soup, find_youth_index(soup), 'youth')
                  if find_youth_index(soup) is not None else []),
        'team': extract_team_classification(soup),
    }
    output_dir = Path(os.environ.get(
        'TDF_DATA_DIR',
        Path(__file__).resolve().parents[1] / 'archive' / 'generated' / '2026-tdf' / 'classifications'
    ))
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / f'tdf_s{STAGE}_data.json'
    with open(out_file, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    print(f"Stage {STAGE}: points={len(data['points'])} kom={len(data['kom'])} "
          f"youth={len(data['youth'])} team={len(data['team'])}", file=sys.stderr)
    print(out_file)

if __name__ == '__main__':
    main()
