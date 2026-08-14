#!/usr/bin/env python3
"""
Fetch Tour de France 2026 stage data from letour.fr (official site).
PCS is behind Cloudflare; this is the fallback data source.
Outputs: tdf_sN_results.json and tdf_sN_data.json
"""
import requests
import sys
import json
import re
from bs4 import BeautifulSoup

STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 15
BASE = f"https://www.letour.fr/en/rankings/stage-{STAGE}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def fetch_html(url):
    resp = requests.get(url, headers=HEADERS, timeout=30)
    if resp.status_code != 200:
        print(f"HTTP {resp.status_code} for {url}", file=sys.stderr)
        return None
    return resp.text

def norm_time(t):
    """Convert letour.fr time like '04h 23' 09''' to '4:23:09'"""
    t = t.replace("h ", ":").replace("' ", ":").replace("''", "")
    return re.sub(r'^0+(\d)', r'\1', t)

def norm_gap(g):
    """Convert letour.fr gap like '+ 00h 00' 06''' to '0:06'"""
    g = g.replace('+ ', '').replace("h ", ":").replace("' ", ":").replace("''", "")
    return re.sub(r'^0+(\d)', r'\1', g)

def parse_stage_results(html):
    """Parse stage results table from letour.fr HTML."""
    soup = BeautifulSoup(html, 'html.parser')
    tabs = soup.find_all('div', class_='js-tabs-content')
    if not tabs:
        return []
    tbody = tabs[0].find('tbody')
    if not tbody:
        return []
    
    results = []
    is_first = True
    for tr in tbody.find_all('tr'):
        tds = tr.find_all('td')
        if len(tds) < 6:
            continue
        rank_text = clean(tds[0].get_text())
        if not rank_text.isdigit():
            continue
        
        rank = int(rank_text)
        rider_name = clean(tds[1].get_text())
        team = clean(tds[3].get_text())
        gap_text = clean(tds[5].get_text()) if len(tds) > 5 else ""
        
        if gap_text in ('-', ''):
            if is_first:
                stage_time = norm_time(clean(tds[4].get_text()))
                is_first = False
            else:
                stage_time = 's.t.'
        else:
            gap_clean = norm_gap(gap_text)
            if gap_clean.startswith('0:0') and gap_clean != '0:0':
                # small gap like 0:06 -> just "0:06"
                stage_time = gap_clean
            else:
                stage_time = gap_clean
        
        results.append({
            'rank': rank,
            'rider': rider_name,
            'nationality': '',
            'team': team,
            'stage_time': stage_time,
        })
    return results

def main():
    html = fetch_html(BASE)
    if not html:
        sys.exit(1)
    
    results = parse_stage_results(html)
    results_data = {'stage': STAGE, 'results': results}
    results_file = f'tdf_s{STAGE}_results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results_data, f, ensure_ascii=False, indent=2)
    print(f"Stage {STAGE}: {len(results)} results -> {results_file}", file=sys.stderr)
    
    # Classifications not available from letour.fr in static HTML
    data = {'stage': STAGE, 'gc': [], 'points': [], 'kom': [], 'youth': [], 'team': []}
    data_file = f'tdf_s{STAGE}_data.json'
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Stage {STAGE}: classifications not available from letour.fr -> {data_file}", file=sys.stderr)
    print(data_file)

if __name__ == '__main__':
    main()
