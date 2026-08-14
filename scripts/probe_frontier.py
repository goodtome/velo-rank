#!/usr/bin/env python3
"""Probe PCS for TDF 2026 stages 5..N and report which have finished results."""
import requests
import sys
import re
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Referer": "https://www.procyclingstats.com/",
}

def fetch(stage):
    url = f"https://www.procyclingstats.com/race/tour-de-france/2026/stage-{stage}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
    except Exception as e:
        return None, f"ERR {e}"
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return BeautifulSoup(resp.text, 'html.parser'), ""

def count_rider_tables(soup):
    """Count tables that look like they contain rider result rows."""
    n = 0
    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        if len(rows) < 3:
            continue
        # a rider result table has a row with a rider/ link
        has_rider = any(r.find('a', href=lambda x: x and 'rider/' in x) for r in rows[:6])
        if has_rider:
            n += 1
    return n

def main():
    stages = range(5, 22)
    print("stage | http | tables_with_riders | note")
    for s in stages:
        soup, err = fetch(s)
        if soup is None:
            print(f"S{s:>2}   | {err} | - | UNREACHABLE")
            continue
        n = count_rider_tables(soup)
        # detect "no race" / upcoming page
        title = soup.find('h1')
        title_txt = title.get_text(strip=True) if title else ""
        note = ""
        if n == 0:
            note = "NO RESULTS (upcoming/not started)"
        elif n == 1:
            note = "only 1 rider table (likely results only, no classifications yet)"
        else:
            note = f"{n} rider tables -> classifications likely available"
        print(f"S{s:>2}   | 200  | {n:>2} | {note}  [{title_txt[:40]}]")

if __name__ == '__main__':
    main()
