#!/usr/bin/env python3
"""Probe PCS stage page layout for a given race slug.
Prints: HTTP status, and for each <table> its index, preceding heading,
row count, and first data-row snippet — to map GC/Points/KOM/Youth/Team.
Also probes known subpage patterns (-gc/-points/-kom/-youth/-teams).
"""
import sys, requests, re
from bs4 import BeautifulSoup

SLUG = sys.argv[1]
YEAR = sys.argv[2] if len(sys.argv) > 2 else '2026'
STAGE = sys.argv[3] if len(sys.argv) > 3 else '1'
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.5",
}

def heading_before(table):
    for tag in ('h3', 'h2', 'h4'):
        h = table.find_previous(tag)
        if h:
            return h.get_text(strip=True)
    return ''

def first_row(table):
    for tr in table.find_all('tr'):
        tds = tr.find_all('td')
        if tds:
            return ' | '.join(re.sub(r'\s+',' ',td.get_text()).strip()[:22] for td in tds[:6])
    return '(no data rows)'

def probe(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=25)
    except Exception as e:
        return None, f'ERR {e}'
    return r, f'HTTP {r.status_code}'

def dump_tables(soup, label):
    tables = soup.find_all('table')
    print(f"  tables ({label}): {len(tables)}")
    for i, t in enumerate(tables):
        h = heading_before(t)
        print(f"   [{i}] h='{h}' rows={len(t.find_all('tr'))}  {first_row(t)[:80]}")

def main():
    if len(sys.argv) > 4:
        # dump a specific subpage
        sub = sys.argv[4]
        url = f"https://www.procyclingstats.com/race/{SLUG}/{YEAR}/stage-{STAGE}-{sub}"
        print(f"\n##### SLUG={SLUG} sub=-{sub} #####")
        r, info = probe(url)
        print(f"  {info}  {url}")
        if r and r.status_code == 200:
            dump_tables(BeautifulSoup(r.text, 'html.parser'), sub)
        return

    base = f"https://www.procyclingstats.com/race/{SLUG}/{YEAR}/stage-{STAGE}"
    print(f"\n##### SLUG={SLUG} YEAR={YEAR} STAGE={STAGE} #####")
    r, info = probe(base)
    print(f"  main: {info}  {base}")
    if not r or r.status_code != 200:
        print("  -> main page not reachable, skipping table dump")
        return
    soup = BeautifulSoup(r.text, 'html.parser')
    tables = soup.find_all('table')
    print(f"  tables on main page: {len(tables)}")
    for i, t in enumerate(tables):
        h = heading_before(t)
        print(f"   [{i}] h='{h}' rows={len(t.find_all('tr'))}  {first_row(t)[:80]}")

    # subpage probes
    for suf in ('gc', 'points', 'kom', 'mountains', 'youth', 'teams', 'team'):
        url = f"https://www.procyclingstats.com/race/{SLUG}/{YEAR}/stage-{STAGE}-{suf}"
        rr, ii = probe(url)
        print(f"  sub -{suf}: {ii}")

if __name__ == '__main__':
    main()
