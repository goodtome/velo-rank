#!/usr/bin/env python3
"""
Fetch and parse ProCyclingStats stage results page.
Extracts: stage info, top results, jersey holders, GC standings.

Table structure (Table 0 = Stage Results, 13 columns):
  td[0]  = Rank
  td[1]  = GC rank
  td[2]  = Timelag (GC gap)
  td[3]  = BIB number
  td[4]  = H2H (checkbox, empty)
  td[5]  = Specialty (GC/Climber/Hills/etc.) with resSp bg color
  td[6]  = Age
  td[7]  = Rider name (ridername class, contains <a><span class="uppercase">Surname</span> Firstname</a>)
  td[8]  = Team (link)
  td[9]  = UCI points
  td[10] = Pnt points
  td[11] = Time gap in seconds (sprint bonus, e.g., "10″")
  td[12] = Stage time (<font>TIME</font><span class="hide">TIME</span> or ",,0:00" for s.t.)

Table 8 = Youth Combined Ranking (same structure as Table 9)
Table 9 = GC General Classification (same structure as Table 8)
Table 2 = Points Classification
Table 4 = KOM Classification
"""
import requests
from bs4 import BeautifulSoup
import json
import sys
import re

URL = sys.argv[1] if len(sys.argv) > 1 else "https://www.procyclingstats.com/race/giro-d-italia/2026/stage-4"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Referer": "https://www.procyclingstats.com/",
    "Upgrade-Insecure-Requests": "1",
}

def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_rider_cell(td):
    """Parse rider name from td with class='ridername'."""
    a_tag = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a_tag:
        return clean(td.get_text()), "", ""
    
    # Name: <span class="uppercase">Surname</span> Firstname
    span_upper = a_tag.find('span', class_='uppercase')
    if span_upper:
        surname = span_upper.get_text(strip=True)
        firstname = a_tag.get_text(strip=True).replace(surname, '').strip()
        name = f"{firstname} {surname}"
    else:
        name = a_tag.get_text(strip=True)
    
    # Nationality from flag
    flag = td.find('span', class_=lambda x: x and x.startswith('flag'))
    nationality = flag.get('class', [''])[0].replace('flag', '') if flag else ""
    
    # Rider ID from href
    href = a_tag.get('href', '')
    rider_id = href.split('/')[-1] if href else ""
    
    return name, nationality, rider_id

def parse_team_cell(td):
    """Parse team name from td."""
    a_tag = td.find('a', href=lambda x: x and 'team/' in x)
    if a_tag:
        return a_tag.get_text(strip=True)
    return clean(td.get_text())

def parse_time_cell(td):
    """Parse time from <font>TIME</font><span class="hide">TIME</span> or ',,' pattern."""
    font = td.find('font')
    if font:
        time_text = font.get_text(strip=True)
        if time_text and time_text != ',,':
            return time_text
    # Check for s.t. (same time)
    if ',,' in td.get_text():
        return "s.t."
    return clean(td.get_text())

def parse_specialty(td):
    """Parse specialty type from resSp div."""
    res_sp = td.find('div', class_='resSp')
    if not res_sp:
        return ""
    span = res_sp.find_next_sibling('span')
    if span:
        return span.get_text(strip=True)
    return ""

def extract_stage_results(soup):
    """Extract stage results from Table 0."""
    results = []
    tables = soup.find_all('table')
    if not tables:
        return results
    
    table = tables[0]
    rows = table.find_all('tr')
    
    for row in rows:  # 不跳过任何行，通过th/td判断
        tds = row.find_all('td')
        if len(tds) < 8:
            continue
        
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        
        # Parse rider name from td[7] (ridername column)
        rider_name, nationality, rider_id = parse_rider_cell(tds[7])
        
        # Team from td[8]
        team = parse_team_cell(tds[8]) if len(tds) > 8 else ""
        
        # GC rank from td[1]
        gc_rank = clean(tds[1].get_text()) if len(tds) > 1 else ""
        
        # Timelag from td[2]
        timelag = clean(tds[2].get_text()) if len(tds) > 2 else ""
        
        # BIB from td[3]
        bib = clean(tds[3].get_text()) if len(tds) > 3 else ""
        
        # Specialty from td[5]
        specialty = parse_specialty(tds[5]) if len(tds) > 5 else ""
        
        # Age from td[6]
        age = clean(tds[6].get_text()) if len(tds) > 6 else ""
        
        # Time bonus from td[11]
        time_bonus = clean(tds[11].get_text()) if len(tds) > 11 else ""
        
        # Stage time from td[12]
        stage_time = parse_time_cell(tds[12]) if len(tds) > 12 else ""
        
        # UCI points and Pnt points
        uci_points = clean(tds[9].get_text()) if len(tds) > 9 else ""
        pnt_points = clean(tds[10].get_text()) if len(tds) > 10 else ""
        
        if rider_name:
            results.append({
                'rank': rank,
                'rider': rider_name,
                'rider_id': rider_id,
                'nationality': nationality,
                'team': team,
                'gc_rank': gc_rank,
                'timelag': timelag,
                'bib': bib,
                'specialty': specialty,
                'age': age,
                'uci_points': uci_points,
                'pnt_points': pnt_points,
                'time_bonus': time_bonus,
                'stage_time': stage_time,
            })
    
    return results

def extract_classification(soup, table_index, name):
    """Extract classification table (GC, Points, KOM, Youth)."""
    classification = []
    tables = soup.find_all('table')
    if table_index >= len(tables):
        return classification
    
    table = tables[table_index]
    rows = table.find_all('tr')
    
    for row in rows:  # 不跳过任何行
        tds = row.find_all('td')
        if len(tds) < 8:
            continue
        
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        
        # Parse rider from td[7] (same as stage results)
        rider_name, nationality, rider_id = parse_rider_cell(tds[7])
        
        # Team from td[8]
        team = parse_team_cell(tds[8]) if len(tds) > 8 else ""
        
        # Time from td[12]
        stage_time = parse_time_cell(tds[12]) if len(tds) > 12 else ""
        
        if rider_name:
            classification.append({
                'rank': rank,
                'rider': rider_name,
                'rider_id': rider_id,
                'nationality': nationality,
                'team': team,
                'time': stage_time,
            })
    
    return classification

def extract_jersey_holders(soup):
    """Extract jersey holders from svg_shirt elements embedded in results."""
    jerseys = []
    color_map = {
        '#f5e947': 'YELLOW (GC)',
        '#8bd600': 'GREEN (Points)',
        '#ff4a36': 'RED (KOM)',
        '#e0e0e0': 'WHITE (Youth)',
        '#007deb': 'BLUE (Teams)',
        '#f5f5f5': 'LIGHT_GRAY',
        '#EA529E': 'PINK2',
        '#FBA3AF': 'PINK (GC)',
        '#0087EE': 'BLUE2',
    }
    
    shirts = soup.find_all('span', class_='svg_shirt')
    for shirt in shirts:
        style = shirt.get('style', '')
        data_color = shirt.get('data-color', '')
        
        # Extract background color from style
        bg_color = ''
        if 'background:' in style:
            bg_match = re.search(r'background:\s*([^;]+)', style)
            if bg_match:
                bg_color = bg_match.group(1).strip()
        
        if not bg_color and not data_color:
            continue
        
        color_name = color_map.get(bg_color, bg_color) or data_color
        
        # Find rider info by traversing up to tr
        parent = shirt.parent
        for _ in range(10):
            if parent is None:
                break
            if parent.name == 'tr':
                rider_a = parent.find('a', href=lambda x: x and 'rider/' in x)
                if rider_a:
                    span = rider_a.find('span', class_='uppercase')
                    if span:
                        name = span.get_text(strip=True) + ' ' + rider_a.get_text(strip=True).replace(span.get_text(strip=True), '').strip()
                    else:
                        name = rider_a.get_text(strip=True)
                    
                    team_a = parent.find('a', href=lambda x: x and 'team/' in x)
                    team = team_a.get_text(strip=True) if team_a else ''
                    
                    flag = parent.find('span', class_=lambda x: x and x.startswith('flag'))
                    nat = flag.get('class', [''])[0].replace('flag', '') if flag else ''
                    
                    jerseys.append({
                        'color': color_name,
                        'bg_hex': bg_color,
                        'rider': name,
                        'team': team,
                        'nationality': nat,
                    })
                break
            parent = parent.parent
    
    return jerseys

def extract_stage_info(soup):
    """Extract basic stage info."""
    info = {}
    h1 = soup.find('h1')
    if h1:
        info['title'] = clean(h1.get_text())
    
    # Find info table
    tables = soup.find_all('table')
    for table in tables:
        for row in table.find_all('tr'):
            cells = [clean(td.get_text()) for td in row.find_all(['td', 'th'])]
            if len(cells) >= 2:
                key = cells[0].lower()
                val = cells[1]
                if 'stage' in key and 'number' in key:
                    info['stage_number'] = val
                elif 'date' in key:
                    info['date'] = val
                elif 'distance' in key:
                    info['distance'] = val
                elif 'start' in key:
                    info['start'] = val
                elif 'finish' in key or 'end' in key:
                    info['finish'] = val
    return info

def main():
    print(f"Fetching: {URL}")
    resp = requests.get(URL, headers=HEADERS, timeout=30)
    print(f"HTTP {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"Error: HTTP {resp.status_code}")
        print(resp.text[:500])
        sys.exit(1)
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    data = {
        'url': URL,
        'stage_info': extract_stage_info(soup),
        'results': extract_stage_results(soup),
        'jersey_holders': extract_jersey_holders(soup),
        'gc': extract_classification(soup, 9, 'GC'),
        'youth': extract_classification(soup, 8, 'Youth'),
        'points': extract_classification(soup, 2, 'Points'),
        'kom': extract_classification(soup, 4, 'KOM'),
    }
    
    print(json.dumps(data, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
