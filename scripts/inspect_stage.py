#!/usr/bin/env python3
"""Deep-inspect a PCS stage page: for each table, print index, <th> headers,
and first 2 data rows with ALL cell texts. Used to map classification tables."""
import sys, requests, re, time
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SLUG, YEAR, STAGE = sys.argv[1], sys.argv[2], sys.argv[3]
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"}

def make_session():
    s = requests.Session()
    retry = Retry(total=5, backoff_factor=1.5, status_forcelist=[429, 500, 502, 503, 504],
                  allowed_methods=["GET"])
    s.mount('https://', HTTPAdapter(max_retries=retry))
    s.headers.update(HEADERS)
    return s

def cells(row):
    return [re.sub(r'\s+', ' ', c.get_text()).strip() for c in row.find_all(['td', 'th'])]

s = make_session()
r = None
for attempt in range(4):
    try:
        r = s.get(f"https://www.procyclingstats.com/race/{SLUG}/{YEAR}/stage-{STAGE}", timeout=30)
        if r.status_code == 200:
            break
    except Exception as e:
        print(f"retry {attempt}: {e}", file=sys.stderr)
    time.sleep(2)
if not r or r.status_code != 200:
    print(f"FAILED to fetch {SLUG} s{STAGE} (status={r.status_code if r else 'none'})")
    sys.exit(1)
print(f"HTTP {r.status_code} for {SLUG} {YEAR} s{STAGE}")
soup = BeautifulSoup(r.text, 'html.parser')
for i, t in enumerate(soup.find_all('table')):
    ths = t.find_all('th')
    thtxt = ' | '.join(re.sub(r'\s+', ' ', th.get_text()).strip() for th in ths)
    rows = t.find_all('tr')
    d = [rows[k] for k in range(1, min(3, len(rows)))]
    print(f"\n--- table [{i}] rows={len(rows)} ---")
    print(f"  TH: {thtxt[:120]}")
    for k, dr in enumerate(d, 1):
        print(f"  row{k}: {cells(dr)[:12]}")
