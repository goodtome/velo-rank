#!/usr/bin/env python3
"""
Fetch stage results + classifications for any PCS race via ScraperAPI.
Handles Grand Tour and smaller race layouts.

Usage:
  python3 scripts/fetch_race_data.py <race-slug> <year> <stage> [--race-code CODE]

Example:
  python3 scripts/fetch_race_data.py tour-of-austria 2026 1 --race-code tour-austria-2026
  python3 scripts/fetch_race_data.py sibiu-cycling-tour 2026 1a --race-code sibiu-tour-2026

Output: <race-code>_s<stage>_data.json and <race-code>_s<stage>_results.json
"""
import requests
import sys
import json
import re
import time as _t
from bs4 import BeautifulSoup
import cloudscraper

SCRAPERAPI_KEY = "156d1b97b6ea62da4fff324c22b66bce"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

def clean(text):
    return re.sub(r'\s+', ' ', text).strip() if text else ""

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
        nationality = next((c for c in classes if c != 'flag'), '').upper()
    href = a_tag.get('href', '')
    rider_id = href.split('/')[-1] if href else ""
    return name, nationality, rider_id

def parse_team_cell(td):
    a_tag = td.find('a', href=lambda x: x and 'team/' in x)
    if a_tag:
        return a_tag.get_text(strip=True)
    return clean(td.get_text())

def parse_value_cell(td):
    font = td.find('font')
    if font:
        return clean(font.get_text())
    return clean(td.get_text())

def parse_time_cell(td):
    # Prefer font child to avoid font+plain text duplication (e.g. '4:21:024:21:02')
    font = td.find('font')
    if font:
        val = font.get_text().replace(',,', '').replace('″', '').strip()
    else:
        val = td.get_text().replace(',,', '').replace('″', '').strip()
    if 's.t.' in val or val in ('', '..', ','):
        return 's.t.'
    return val.lstrip('+').strip()

def fetch(url):
    """Prefer direct PCS via cloudscraper (bypasses Cloudflare); fallback to ScraperAPI."""
    last = None
    for attempt in range(4):
        try:
            scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
            resp = scraper.get(url, headers=HEADERS, timeout=60)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, 'html.parser')
            last = f"HTTP {resp.status_code}"
        except Exception as e:
            last = str(e)
        _t.sleep(3 + attempt * 3)
    # Fallback: ScraperAPI
    for attempt in range(2):
        try:
            api_url = f"https://api.scraperapi.com?api_key={SCRAPERAPI_KEY}&url={url}"
            resp = requests.get(api_url, headers=HEADERS, timeout=60)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, 'html.parser')
            last = f"scraperapi HTTP {resp.status_code}"
        except Exception as e:
            last = str(e)
        _t.sleep(5)
    print(f"Fetch failed: {last}", file=sys.stderr)
    return None

def get_headers(table):
    return ' | '.join(clean(c.get_text()) for c in table.find_all('th'))

def find_rider_idx(tds):
    """Dynamically find the column index containing a rider link."""
    for i, td in enumerate(tds):
        if td.find('a', href=lambda x: x and 'rider/' in x):
            return i
    return None

def extract_stage_results(soup):
    """Table 0 = stage results (13 cols for road stages)."""
    tables = soup.find_all('table')
    if not tables:
        return []
    t0 = tables[0]
    results = []
    for tr in t0.find_all('tr'):
        tds = tr.find_all('td')
        if len(tds) < 10:
            continue
        rank = clean(tds[0].get_text())
        if not rank.isdigit():
            continue
        rider_idx = find_rider_idx(tds)
        if rider_idx is None:
            continue
        rider_name, nationality, _ = parse_rider_cell(tds[rider_idx])
        if not rider_name:
            continue
        team = parse_team_cell(tds[rider_idx + 1]) if rider_idx + 1 < len(tds) else ""
        # Time is usually the last column
        stage_time = parse_time_cell(tds[-1])
        results.append({
            'rank': int(rank),
            'rider': rider_name,
            'nationality': nationality,
            'team': team,
            'stage_time': stage_time,
        })
    return results

def extract_gc(soup):
    """Table 1 = GC. Has 'Time won/lost' column."""
    tables = soup.find_all('table')
    if len(tables) < 2:
        return []
    table = tables[1]
    out = []
    for row in table.find_all('tr'):
        tds = row.find_all('td')
        if len(tds) < 6:
            continue
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        rider_idx = find_rider_idx(tds)
        if rider_idx is None:
            continue
        rider_name, nationality, _ = parse_rider_cell(tds[rider_idx])
        if not rider_name:
            continue
        team = parse_team_cell(tds[rider_idx + 1]) if rider_idx + 1 < len(tds) else ""
        # Time/gap: last column
        tcol = len(tds) - 1
        raw = parse_value_cell(tds[tcol])
        if rank == '1':
            entry_time = raw
            entry_gap = "0:00"
        else:
            entry_time = ""
            if raw in ('..', 's.t.', '', ',,0:00'):
                entry_gap = "+0:00"
            elif raw.startswith('+'):
                entry_gap = raw
            else:
                entry_gap = "+" + raw
        out.append({
            'rank': rank, 'rider': rider_name, 'nationality': nationality,
            'team': team, 'total_time': entry_time, 'time_gap': entry_gap,
        })
    return out

def find_classification_table(soup, kind):
    """Find classification table by header signature.
    kind: 'points' | 'kom' | 'youth' | 'team'
    """
    tables = soup.find_all('table')
    # Skip table 0 (stage results) and 1 (GC)
    candidates = []
    for i, table in enumerate(tables):
        if i < 2:
            continue
        th = get_headers(table)
        rows = table.find_all('tr')
        if len(rows) < 2:
            continue
        has_rider = table.find('a', href=lambda x: x and 'rider/' in x)
        has_team_link = table.find('a', href=lambda x: x and 'team/' in x)

        if kind == 'points':
            # Points: has 'Pnt', has rider links, NOT a bonus table
            if 'Pnt' in th and has_rider and 'Bonis' not in th and 'Time' not in th:
                candidates.append((i, len(rows)))
        elif kind == 'kom':
            # KOM: has 'Pnt', has rider links, usually after points
            if 'Pnt' in th and has_rider and 'Bonis' not in th and 'Time' not in th:
                candidates.append((i, len(rows)))
        elif kind == 'youth':
            # Youth: has 'Time', has rider links, NO 'UCI', NO 'Pnt'
            if 'Time' in th and 'UCI' not in th and 'Pnt' not in th and has_rider:
                candidates.append((i, len(rows)))
        elif kind == 'team':
            # Team: has 'Team' header, has team links
            if 'Team' in th and has_team_link and not has_rider:
                candidates.append((i, len(rows)))

    if not candidates:
        return None
    # For points/kom, pick by position (points first, kom second)
    if kind in ('points', 'kom'):
        # Sort by index, points = first match, kom = second match
        candidates.sort(key=lambda x: x[0])
        if kind == 'points':
            return candidates[0][0] if candidates else None
        else:
            return candidates[1][0] if len(candidates) > 1 else (candidates[0][0] if candidates else None)
    # For youth/team, pick the one with most rows
    candidates.sort(key=lambda x: -x[1])
    return candidates[0][0]

def extract_points_or_kom(soup, table_idx):
    """Extract points or KOM classification from a table."""
    if table_idx is None:
        return []
    tables = soup.find_all('table')
    if table_idx >= len(tables):
        return []
    table = tables[table_idx]
    out = []
    for row in table.find_all('tr'):
        tds = row.find_all('td')
        if len(tds) < 4:
            continue
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        rider_idx = find_rider_idx(tds)
        if rider_idx is None:
            continue
        rider_name, nationality, _ = parse_rider_cell(tds[rider_idx])
        if not rider_name:
            continue
        team = parse_team_cell(tds[rider_idx + 1]) if rider_idx + 1 < len(tds) else ""
        # Points column: usually after team
        pcol = rider_idx + 2
        pval = parse_value_cell(tds[pcol]) if pcol < len(tds) else "0"
        try:
            pts = str(int(pval))
        except ValueError:
            pts = pval if pval.isdigit() else "0"
        out.append({
            'rank': rank, 'rider': rider_name, 'nationality': nationality,
            'team': team, 'points': pts,
        })
    return out

def extract_youth(soup, table_idx):
    """Extract youth classification."""
    if table_idx is None:
        return []
    tables = soup.find_all('table')
    if table_idx >= len(tables):
        return []
    table = tables[table_idx]
    out = []
    for row in table.find_all('tr'):
        tds = row.find_all('td')
        if len(tds) < 4:
            continue
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        rider_idx = find_rider_idx(tds)
        if rider_idx is None:
            continue
        rider_name, nationality, _ = parse_rider_cell(tds[rider_idx])
        if not rider_name:
            continue
        team = parse_team_cell(tds[rider_idx + 1]) if rider_idx + 1 < len(tds) else ""
        # Time/gap: last column
        raw = parse_value_cell(tds[-1])
        if rank == '1':
            total_time = raw
            time_gap = "0:00"
        else:
            total_time = ""
            if raw in ('..', 's.t.', '', ',,0:00'):
                time_gap = "+0:00"
            elif raw.startswith('+'):
                time_gap = raw
            else:
                time_gap = "+" + raw
        out.append({
            'rank': rank, 'rider': rider_name, 'nationality': nationality,
            'team': team, 'total_time': total_time, 'time_gap': time_gap,
        })
    return out

def extract_team(soup, table_idx):
    """Extract team classification."""
    if table_idx is None:
        return []
    tables = soup.find_all('table')
    if table_idx >= len(tables):
        return []
    table = tables[table_idx]
    out = []
    for row in table.find_all('tr'):
        tds = row.find_all('td')
        if len(tds) < 3:
            continue
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        # Find team link
        team = ""
        for td in tds[1:]:
            a = td.find('a', href=lambda x: x and 'team/' in x)
            if a:
                team = a.get_text(strip=True)
                break
        if not team:
            continue
        # Time: last column
        total_time = parse_value_cell(tds[-1])
        out.append({
            'rank': rank, 'team': team, 'total_time': total_time,
        })
    return out

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('race_slug', help='PCS race slug, e.g. tour-of-austria')
    parser.add_argument('year', type=int)
    parser.add_argument('stage', help='Stage number or slug, e.g. 1, 1a')
    parser.add_argument('--race-code', default=None, help='DB race_code')
    args = parser.parse_args()

    race_code = args.race_code or f"{args.race_slug}-{args.year}"
    pcs_url = f"https://www.procyclingstats.com/race/{args.race_slug}/{args.year}/stage-{args.stage}"

    soup = fetch(pcs_url)
    if not soup:
        sys.exit(1)

    # Stage results
    results = extract_stage_results(soup)
    results_data = {'stage': args.stage, 'results': results}
    results_file = f"{race_code}_s{args.stage}_results.json"
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results_data, f, ensure_ascii=False, indent=2)

    # Classifications
    gc = extract_gc(soup)
    pts_idx = find_classification_table(soup, 'points')
    kom_idx = find_classification_table(soup, 'kom')
    youth_idx = find_classification_table(soup, 'youth')
    team_idx = find_classification_table(soup, 'team')

    points = extract_points_or_kom(soup, pts_idx)
    kom = extract_points_or_kom(soup, kom_idx)
    youth = extract_youth(soup, youth_idx)
    team = extract_team(soup, team_idx)

    data = {
        'stage': args.stage,
        'gc': gc, 'points': points, 'kom': kom,
        'youth': youth, 'team': team,
    }
    data_file = f"{race_code}_s{args.stage}_data.json"
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Stage {args.stage}: results={len(results)} gc={len(gc)} pts={len(points)} "
          f"kom={len(kom)} youth={len(youth)} team={len(team)}", file=sys.stderr)
    print(f"  -> {results_file}, {data_file}")

if __name__ == '__main__':
    main()
