#!/usr/bin/env python3
"""For TDF 2026 stages 1..4, report PCS stage-results finisher count and any
rows whose rider name failed to parse (empty) -- these are the dropped rows."""
import requests, sys, json
from bs4 import BeautifulSoup
H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36','Accept-Language':'en-US,en;q=0.5','Referer':'https://www.procyclingstats.com/'}

def fetch(stage):
    url=f"https://www.procyclingstats.com/race/tour-de-france/2026/stage-{stage}"
    r=requests.get(url,headers=H,timeout=30)
    return BeautifulSoup(r.text,'html.parser') if r.status_code==200 else None

def main():
    for s in range(1,5):
        soup=fetch(s)
        if not soup:
            print(f"S{s}: fetch failed"); continue
        t0=soup.find_all('table')[0]
        ranks=[]; empty=[]
        for tr in t0.find_all('tr'):
            tds=tr.find_all('td')
            if len(tds)<5: continue
            rank=tds[0].get_text(strip=True)
            a=tr.find('a',href=lambda x:x and 'rider/' in x)
            name=a.get_text(strip=True) if a else ''
            if rank.isdigit():
                ranks.append(int(rank))
                if not name:
                    empty.append(rank)
        print(f"S{s}: PCS finishers={len(ranks)} maxRank={max(ranks) if ranks else 0} emptyNameRows={len(empty)} {('empty@'+','.join(empty)) if empty else ''}")

if __name__=='__main__':
    main()
