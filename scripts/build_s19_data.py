#!/usr/bin/env python3
"""Build S19 classification data from cyclinguptodate.com article."""
import json, re

gc_raw = """1 Pogačar Tadej UAE Team Emirates - XRG 67:53:00
2 Evenepoel Remco Red Bull - BORA - hansgrohe +7:11
3 del Toro Isaac UAE Team Emirates - XRG +9:42
4 Seixas Paul Decathlon CMA CGM Team +10:06
5 Martinez Lenny Bahrain - Victorious +13:00
6 Skjelmose Mattias Lidl - Trek +13:09
7 Ayuso Juan Lidl - Trek +15:58
8 Carapaz Richard EF Education - EasyPost +21:15
9 Pidcock Tom Pinarello Q36.5 Pro Cycling Team +21:30
10 Jegat Jordan TotalEnergies +23:21
11 Voisard Yannis Tudor Pro Cycling Team +30:00
12 Van Wilder Ilan Soudal Quick-Step +35:47
13 Johannessen Tobias Halland Uno-X Mobility +50:58
14 Piganzoli Davide Team Visma | Lease a Bike +55:57
15 Kuss Sepp Team Visma | Lease a Bike +1:02:01"""

pts_raw = """1 Pedersen Mads Lidl - Trek 502
2 Philipsen Jasper Alpecin - Premier Tech 445
3 Girmay Biniam NSN Cycling Team 361
4 Kanter Max XDS Astana Team 271
5 Kooij Olav Decathlon CMA CGM Team 230
6 Pogacar Tadej UAE Team Emirates - XRG 185
7 Waerenskjold Soren Uno-X Mobility 159
8 Evenepoel Remco Red Bull - BORA - hansgrohe 140
9 del Toro Isaac UAE Team Emirates - XRG 132
10 Schmid Mauro Team Jayco AlUla 131"""

kom_raw = """1 Carapaz Richard EF Education - EasyPost 91
2 Pogacar Tadej UAE Team Emirates - XRG 90
3 Paret-Peintre Valentin Soudal Quick-Step 84
4 Evenepoel Remco Red Bull - BORA - hansgrohe 42
5 Martinez Lenny Bahrain - Victorious 37
6 del Toro Isaac UAE Team Emirates - XRG 34
7 Seixas Paul Decathlon CMA CGM Team 34
8 Johannessen Tobias Halland Uno-X Mobility 26"""

yth_raw = """1 del Toro Isaac UAE Team Emirates - XRG 68:02:42
2 Seixas Paul Decathlon CMA CGM Team +0:24
3 Martinez Lenny Bahrain - Victorious +3:18
4 Ayuso Juan Lidl - Trek +6:16
5 Piganzoli Davide Team Visma | Lease a Bike +46:15
6 Simmons Quinn Lidl - Trek +1:16:49
7 Castrillo Pablo Movistar Team +1:41:55
8 Riccitello Matthew Decathlon CMA CGM Team +1:55:35
9 Garcia Pierna Raul Movistar Team +2:09:19
10 Vauquelin Kevin Netcompany INEOS +2:12:52"""

team_raw = """1 Lidl - Trek 203:46:27
2 UAE Team Emirates - XRG +19:33
3 Red Bull - BORA - hansgrohe +1:06:53
4 Decathlon CMA CGM Team +1:45:33
5 Team Visma | Lease a Bike +1:49:23
6 EF Education - EasyPost +3:09:45
7 Netcompany INEOS +3:50:41
8 Movistar Team +4:31:03
9 Bahrain - Victorious +4:46:20
10 Pinarello Q36.5 Pro Cycling Team +4:49:16"""

TEAMS = sorted([
    'UAE Team Emirates - XRG', 'Red Bull - BORA - hansgrohe', 'Decathlon CMA CGM Team',
    'Bahrain - Victorious', 'Lidl - Trek', 'EF Education - EasyPost', 'TotalEnergies',
    'Pinarello Q36.5 Pro Cycling Team', 'Tudor Pro Cycling Team', 'Soudal Quick-Step',
    'Uno-X Mobility', 'Team Visma | Lease a Bike', 'Team Jayco AlUla', 'Movistar Team',
    'Netcompany INEOS', 'XDS Astana Team', 'NSN Cycling Team', 'Alpecin - Premier Tech',
    'Cofidis', 'Lotto Intermarché', 'Team Picnic PostNL', 'Caja Rural',
    'Groupama-FDJ', 'Bahrain Victorious', 'CAJA RURAL-SEGUROS RGA'
], key=len, reverse=True)

def split_rider_team(text):
    """Split 'Rider Name Team Name' into (rider, team)."""
    for t in TEAMS:
        if text.endswith(t):
            return text[:-len(t)].strip(), t
    return text.strip(), 'UNKNOWN'

def parse_gc(raw):
    out = []
    for line in raw.strip().split('\n'):
        # "1 Pogačar Tadej UAE Team Emirates - XRG 67:53:00"
        m = re.match(r'(\d+)\s+(.+)', line)
        if not m: continue
        rk = m.group(1)
        rest = m.group(2)
        # Extract time at end
        time_m = re.search(r'(\+?\d{1,2}:\d{2}(?::\d{2})?)\s*$', rest)
        if not time_m: continue
        time_part = time_m.group(1)
        before = rest[:time_m.start()].strip()
        rider, team = split_rider_team(before)
        out.append({'rank': rk, 'rider': rider, 'rider_id': '', 'nationality': '',
                    'team': team, 'total_time': time_part if rk == '1' else '',
                    'time_gap': '0:00' if rk == '1' else ('+' + time_part if not time_part.startswith('+') else time_part),
                    'points': ''})
    return out

def parse_pts(raw):
    out = []
    for line in raw.strip().split('\n'):
        # "1 Pedersen Mads Lidl - Trek 502"
        m = re.match(r'(\d+)\s+(.+?)\s+(\d+)\s*$', line)
        if not m: continue
        rk, rest, pts = m.groups()
        rider, team = split_rider_team(rest)
        out.append({'rank': rk, 'rider': rider, 'rider_id': '', 'nationality': '',
                    'team': team, 'points': pts, 'time_gap': '', 'total_time': ''})
    return out

def parse_youth(raw):
    out = []
    for line in raw.strip().split('\n'):
        m = re.match(r'(\d+)\s+(.+)', line)
        if not m: continue
        rk = m.group(1)
        rest = m.group(2)
        time_m = re.search(r'(\+?\d{1,2}:\d{2}(?::\d{2})?)\s*$', rest)
        if not time_m: continue
        time_part = time_m.group(1)
        before = rest[:time_m.start()].strip()
        rider, team = split_rider_team(before)
        out.append({'rank': rk, 'rider': rider, 'rider_id': '', 'nationality': '',
                    'team': team, 'total_time': time_part if rk == '1' else '',
                    'time_gap': '0:00' if rk == '1' else ('+' + time_part if not time_part.startswith('+') else time_part),
                    'points': ''})
    return out

def parse_team(raw):
    out = []
    for line in raw.strip().split('\n'):
        m = re.match(r'(\d+)\s+(.+?)\s+(\+?\d{1,2}:\d{2}(?::\d{2})?)\s*$', line)
        if not m: continue
        rk, name, t = m.groups()
        out.append({'rank': rk, 'team': name.strip(), 'total_time': t.strip(), 'time_gap': None})
    return out

data = {
    'stage': 19,
    'gc': parse_gc(gc_raw),
    'points': parse_pts(pts_raw),
    'kom': parse_pts(kom_raw),
    'youth': parse_youth(yth_raw),
    'team': parse_team(team_raw),
}

with open('D:/codes/velo-rank/tdf_s19_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"S19: gc={len(data['gc'])} pts={len(data['points'])} kom={len(data['kom'])} youth={len(data['youth'])} team={len(data['team'])}")
