#!/usr/bin/env python3
"""
Fetch Tour de France 2026 stage RESULTS (table 0) from ProCyclingStats.
Robust rider-name parsing (handles 'van'/'Van' particle names correctly).
Outputs archive/generated/2026-tdf/results/tdf_sN_results.json.
Set TDF_RESULTS_DIR to override the output directory.
"""
import requests, sys, json, re, os
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

def parse_time_cell(td):
    raw = td.get_text()
    val = raw.replace(',,', '').replace('″', '').strip()
    if 's.t.' in val or val in ('', '..', ','):
        return 's.t.'
    return val.lstrip('+').strip()

def fetch(url):
    last = None
    for attempt in range(4):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 200:
                return resp
            last = f"HTTP {resp.status_code}"
        except Exception as e:
            last = str(e)
        import time as _t
        _t.sleep(2 + attempt * 2)
    print(f"Fetch failed after retries {url}: {last}", file=sys.stderr)
    sys.exit(1)

def main():
    resp = fetch(BASE)
    soup = BeautifulSoup(resp.text, 'html.parser')
    tables = soup.find_all('table')
    if not tables:
        print("no tables", file=sys.stderr); sys.exit(1)
    t0 = tables[0]
    results = []
    for tr in t0.find_all('tr'):
        tds = tr.find_all('td')
        if len(tds) < 13:
            continue
        rank = clean(tds[0].get_text())
        if not rank.isdigit():
            continue
        rider_name, nationality, _ = parse_rider_cell(tds[7])
        if not rider_name:
            continue
        team = parse_team_cell(tds[8])
        stage_time = parse_time_cell(tds[12])
        results.append({
            'rank': int(rank),
            'rider': rider_name,
            'nationality': nationality,
            'team': team,
            'stage_time': stage_time,
        })
    out = {'stage': STAGE, 'results': results}
    output_dir = Path(os.environ.get(
        'TDF_RESULTS_DIR',
        Path(__file__).resolve().parents[1] / 'archive' / 'generated' / '2026-tdf' / 'results'
    ))
    output_dir.mkdir(parents=True, exist_ok=True)
    fn = output_dir / f'tdf_s{STAGE}_results.json'
    with open(fn, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print(f"Stage {STAGE}: {len(results)} results -> {fn}", file=sys.stderr)

if __name__ == '__main__':
    main()
