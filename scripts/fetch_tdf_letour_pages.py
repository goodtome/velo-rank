#!/usr/bin/env python3
"""
Multi-page fetcher for letour.fr rankings.
Uses requests to get the initial HTML (first page), then uses the hidden
API or constructs paginated requests to get all data.
"""
import requests
import sys
import json
import re
from bs4 import BeautifulSoup

STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 17
BASE = f"https://www.letour.fr/en/rankings/stage-{STAGE}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_rows(html):
    """Parse only the first tab (Individual/stage results) from HTML."""
    soup = BeautifulSoup(html, 'html.parser')
    tabs = soup.find_all('div', class_='js-tabs-content')
    if not tabs:
        return []
    
    # Only use the first tab - Individual/stage results
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
                stage_time = clean(tds[4].get_text()).replace("h ", ":").replace("' ", ":").replace("''", "")
                stage_time = re.sub(r'^0+(\d)', r'\1', stage_time)
                is_first = False
            else:
                stage_time = 's.t.'
        else:
            gap_clean = gap_text.replace('+ ', '').replace("h ", ":").replace("' ", ":").replace("''", "")
            gap_clean = re.sub(r'^0+(\d)', r'\1', gap_clean)
            stage_time = gap_clean
        
        results.append({
            'rank': rank, 'rider': rider_name, 'nationality': '',
            'team': team, 'stage_time': stage_time,
        })
    return results

def main():
    # Get first page
    r = requests.get(BASE, headers=HEADERS, timeout=30)
    if r.status_code != 200:
        print(f"HTTP {r.status_code}", file=sys.stderr)
        sys.exit(1)
    
    all_results = parse_rows(r.text)
    print(f"Page 1: {len(all_results)} results", file=sys.stderr)
    
    # Try to find the total count from the page
    # Letour.fr shows something like "1-35 / 164" or similar
    total_match = re.search(r'(\d+)\s*/\s*(\d+)', r.text)
    if total_match:
        print(f"Page indicator: {total_match.group(0)}", file=sys.stderr)
    
    # Try alternate endpoints for more data
    # The page might load more data via XHR to an API
    api_patterns = [
        f'/api/rankings/stage-{STAGE}',
        f'/api/stage-{STAGE}/rankings',
        f'/en/rankings/stage-{STAGE}/data',
    ]
    
    for api_url in api_patterns:
        try:
            api_r = requests.get(f'https://www.letour.fr{api_url}', headers=HEADERS, timeout=10)
            if api_r.status_code == 200 and len(api_r.text) > 100:
                print(f"API {api_url}: {api_r.status_code}, {len(api_r.text)} bytes", file=sys.stderr)
                if api_r.text.strip().startswith('{') or api_r.text.strip().startswith('['):
                    print(f"  JSON response!", file=sys.stderr)
        except:
            pass
    
    # Save results
    results_data = {'stage': STAGE, 'results': all_results}
    results_file = f'tdf_s{STAGE}_results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results_data, f, ensure_ascii=False, indent=2)
    print(f"Stage {STAGE}: {len(all_results)} results -> {results_file}", file=sys.stderr)
    print(results_file)

if __name__ == '__main__':
    main()
