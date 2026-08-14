#!/usr/bin/env python3
"""
Fetch TDF 2026 classification data via ScraperAPI (PCS direct is 403).
Same table-offset logic as fetch_tdf_full.py but routed through ScraperAPI.
Output: tdf_sN_data.json
"""
import requests
import sys
import json
import re
import time as _t
from bs4 import BeautifulSoup

STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 15
SCRAPERAPI_KEY = "156d1b97b6ea62da4fff324c22b66bce"
PCS_URL = f"https://www.procyclingstats.com/race/tour-de-france/2026/stage-{STAGE}"
API_URL = f"https://api.scraperapi.com?api_key={SCRAPERAPI_KEY}&url={PCS_URL}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
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

def parse_value_cell(td):
    font = td.find('font')
    if font:
        return clean(font.get_text())
    return clean(td.get_text())

def fetch(url):
    last = None
    for attempt in range(4):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=60)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, 'html.parser')
            last = f"HTTP {resp.status_code}"
        except Exception as e:
            last = str(e)
        _t.sleep(3 + attempt * 3)
    print(f"Fetch failed after retries: {last}", file=sys.stderr)
    return None

def extract_classification_at(soup, index, kind):
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
            # GC time is in the second-to-last column (before 'Time won/lost')
            # Works for both 13-col (S2-S20) and 14-col (S21 with Pnt) layouts
            tcol = len(tds) - 2 if kind == 'gc' else rider_idx + 2
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
            # Points/KOM cumulative value is in the second-to-last column
            # (before 'Today'). Works for 11-col (S2-S20) and 13-col (S21) layouts.
            pcol = len(tds) - 2
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
    soup = fetch(API_URL)
    if not soup:
        sys.exit(1)
    youth_idx = find_youth_index(soup)
    data = {
        'stage': STAGE,
        'gc': extract_classification_at(soup, 1, 'gc'),
        'points': extract_classification_at(soup, 2, 'points'),
        'kom': extract_classification_at(soup, 5, 'kom'),
        'youth': (extract_classification_at(soup, youth_idx, 'youth')
                  if youth_idx is not None else []),
        'team': extract_team_classification(soup),
    }
    out_file = f'tdf_s{STAGE}_data.json'
    with open(out_file, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    print(f"Stage {STAGE}: gc={len(data['gc'])} points={len(data['points'])} kom={len(data['kom'])} "
          f"youth={len(data['youth'])} team={len(data['team'])}", file=sys.stderr)
    print(out_file)

if __name__ == '__main__':
    main()
