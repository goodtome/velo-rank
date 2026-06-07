#!/usr/bin/env python3
"""
Parse Antwerp Port Epic 2026 results from local HTML file.
Extracts: stage results, GC, points, KOM, youth classifications.
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
        
        # Age from td[6]
        age = clean(tds[6].get_text()) if len(tds) > 6 else ""
        
        # Time from td[12]
        stage_time = parse_time_cell(tds[12]) if len(tds) > 12 else ""
        
        # UCI points from td[9]
        uci_points = clean(tds[9].get_text()) if len(tds) > 9 else ""
        
        # Pnt points from td[10]
        pnt_points = clean(tds[10].get_text()) if len(tds) > 10 else ""
        
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
                'age': age,
                'stage_time': stage_time,
                'uci_points': uci_points,
                'pnt_points': pnt_points,
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
    
    for row in rows:
        tds = row.find_all('td')
        if len(tds) < 5:
            continue
        
        rank = clean(tds[0].get_text())
        if not rank or not rank.isdigit():
            continue
        
        # Determine rider name column index based on table structure
        if len(tds) >= 13:
            rider_idx = 7
            team_idx = 8
        elif len(tds) >= 11:
            rider_idx = 7
            team_idx = 8
        elif len(tds) >= 9:
            rider_idx = 5
            team_idx = 6
        else:
            continue
        
        # Parse rider name
        rider_name, nationality, rider_id = parse_rider_cell(tds[rider_idx])
        
        # Parse team
        team = parse_team_cell(tds[team_idx]) if len(tds) > team_idx else ""
        
        # Parse points or time
        points = ""
        time_gap = ""
        total_time = ""
        
        if 'gc' in name.lower() or 'youth' in name.lower():
            # Time-based classification
            if len(tds) >= 13:
                time_val = parse_time_cell(tds[11]) if 11 < len(tds) else ""
                if rank == '1':
                    total_time = time_val
                    time_gap = "0:00"
                else:
                    time_gap = "+" + time_val if time_val and not time_val.startswith('+') else time_val
        else:
            # Points-based classification
            if len(tds) >= 11:
                points = clean(tds[9].get_text()) if 9 < len(tds) else ""
            elif len(tds) >= 9:
                points = clean(tds[7].get_text()) if 7 < len(tds) else ""
        
        if rider_name:
            classification.append({
                'rank': rank,
                'rider_name': rider_name,
                'rider_id': rider_id,
                'nationality': nationality,
                'team': team,
                'time_gap': time_gap,
                'total_time': total_time,
                'points': points,
            })
    
    return classification

def main():
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Debug: print table structure
    tables = soup.find_all('table')
    print(f"Found {len(tables)} tables", file=sys.stderr)
    for i, table in enumerate(tables[:10]):
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
        'gc': extract_classification(soup, 1, 'GC'),
        'points': extract_classification(soup, 2, 'Points'),
        'kom': extract_classification(soup, 6, 'KOM'),
        'youth': extract_classification(soup, 9, 'Youth'),
    }
    
    # Save to JSON file
    output_file = 'stage_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Data saved to: {output_file}", file=sys.stderr)
    print(output_file)

if __name__ == '__main__':
    main()
