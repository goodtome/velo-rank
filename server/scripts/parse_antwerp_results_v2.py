#!/usr/bin/env python3
"""
Parse Antwerp Port Epic 2026 results from local HTML file.
Table structure (10 columns):
  td[0]  = Rank
  td[1]  = GC rank
  td[2]  = Timelag (empty)
  td[3]  = Specialty (Classic/Hills/TT)
  td[4]  = BIB number
  td[5]  = Rider name (has <a> link)
  td[6]  = Team (has <a> link)
  td[7]  = UCI points
  td[8]  = Pnt points
  td[9]  = Time
"""
import sys
import json
import re
from bs4 import BeautifulSoup

HTML_FILE = 'pcs_antwerp_2026.html'

def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_rider_cell(td):
    """Parse rider name from td with <a> tag."""
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
    
    # Nationality from flag: <span class="flag dk"> → class list ['flag','dk'] → take second
    flag = td.find('span', class_=lambda x: x and 'flag' in (x if isinstance(x, list) else [x]))
    if flag:
        classes = flag.get('class', [])
        # Find the non-'flag' class (the actual country code, e.g., 'dk', 'it', 'nl')
        country_code = next((c for c in classes if c != 'flag'), '')
        nationality = country_code.upper()  # 'dk' → 'DK'
    else:
        nationality = ""
    
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
    """Parse time from cell."""
    text = td.get_text(strip=True)
    if not text or text == ',,':
        return ""
    return text

def extract_stage_results(soup):
    """Extract stage results from Table 0."""
    results = []
    tables = soup.find_all('table')
    if not tables:
        return results
    
    table = tables[0]
    rows = table.find_all('tr')
    
    for row in rows:
        tds = row.find_all('td')
        if len(tds) < 10:  # Need at least 10 columns
            continue
        
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        
        # Parse rider name from td[5]
        rider_name, nationality, rider_id = parse_rider_cell(tds[5])
        
        # Team from td[6]
        team = parse_team_cell(tds[6])
        
        # GC rank from td[1]
        gc_rank = clean(tds[1].get_text())
        
        # Timelag from td[2]
        timelag = clean(tds[2].get_text())
        
        # BIB from td[4]
        bib = clean(tds[4].get_text())
        
        # Specialty from td[3]
        specialty = clean(tds[3].get_text())
        
        # UCI points from td[7]
        uci_points = clean(tds[7].get_text())
        
        # Pnt points from td[8]
        pnt_points = clean(tds[8].get_text())
        
        # Time from td[9]
        stage_time = parse_time_cell(tds[9])
        
        if rider_name:
            results.append({
                'rank': rank,
                'rider_name': rider_name,
                'rider_id': rider_id,
                'nationality': nationality,
                'team': team,
                'gc_rank': gc_rank,
                'timelag': timelag,
                'bib': bib,
                'specialty': specialty,
                'uci_points': uci_points,
                'pnt_points': pnt_points,
                'stage_time': stage_time,
            })
    
    return results

def main():
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Debug: print table structure
    tables = soup.find_all('table')
    print(f"Found {len(tables)} tables", file=sys.stderr)
    for i, table in enumerate(tables[:5]):
        rows = table.find_all('tr')
        if not rows:
            continue
        first_row = rows[0]
        tds = first_row.find_all(['td', 'th'])
        has_rider = len(first_row.find_all('a')) > 0
        sample = first_row.get_text(strip=True)[:60]
        print(f"Table {i}: {len(rows)} rows, {len(tds)} cols, has_rider: {has_rider}", file=sys.stderr)
        if has_rider:
            riders = []
            for row in rows[1:3]:
                a_tags = row.find_all('a')
                if a_tags:
                    riders.append(a_tags[0].get_text(strip=True)[:20])
            if riders:
                print(f"  Sample riders: {riders}", file=sys.stderr)
    
    data = {
        'results': extract_stage_results(soup),
    }
    
    # Save to JSON file
    output_file = 'stage_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Data saved to: {output_file}", file=sys.stderr)
    print(output_file)

if __name__ == '__main__':
    main()
