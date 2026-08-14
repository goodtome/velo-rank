#!/usr/bin/env python3
"""Build S21 (final stage) classification data from Wikipedia."""
import json

TEAMS = sorted([
    'UAE Team Emirates - XRG', 'Red Bull - BORA - hansgrohe', 'Decathlon CMA CGM Team',
    'Bahrain - Victorious', 'Lidl - Trek', 'EF Education - EasyPost', 'TotalEnergies',
    'Pinarello Q36.5 Pro Cycling Team', 'Tudor Pro Cycling Team', 'Soudal Quick-Step',
    'Uno-X Mobility', 'Team Visma | Lease a Bike', 'Team Jayco AlUla', 'Movistar Team',
    'Netcompany INEOS', 'XDS Astana Team', 'NSN Cycling Team', 'Alpecin - Premier Tech',
    'Cofidis', 'Lotto Intermarché', 'Team Picnic PostNL', 'Caja Rural',
    'Bahrain Victorious', 'Groupama-FDJ', 'Team Bahrain Victorious',
], key=len, reverse=True)

# Final GC after S21 (top 10 from Wikipedia)
GC = [
    {"rank":"1","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","total_time":"73:56:26","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","total_time":"","time_gap":"+6:26","points":""},
    {"rank":"3","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"","time_gap":"+9:42","points":""},
    {"rank":"4","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+11:56","points":""},
    {"rank":"5","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","total_time":"","time_gap":"+13:02","points":""},
    {"rank":"6","rider":"Skjelmose Mattias","rider_id":"","nationality":"DK","team":"Lidl - Trek","total_time":"","time_gap":"+14:59","points":""},
    {"rank":"7","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+17:48","points":""},
    {"rank":"8","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","total_time":"","time_gap":"+20:00","points":""},
    {"rank":"9","rider":"Pidcock Tom","rider_id":"","nationality":"GB","team":"Pinarello Q36.5 Pro Cycling Team","total_time":"","time_gap":"+29:28","points":""},
    {"rank":"10","rider":"Jegat Jordan","rider_id":"","nationality":"FR","team":"TotalEnergies","total_time":"","time_gap":"+33:21","points":""},
]

# Points (green jersey) final
POINTS = [
    {"rank":"1","rider":"Pedersen Mads","rider_id":"","nationality":"DK","team":"Lidl - Trek","points":"559","time_gap":"","total_time":""},
    {"rank":"2","rider":"Philipsen Jasper","rider_id":"","nationality":"BE","team":"Alpecin - Premier Tech","points":"475","time_gap":"","total_time":""},
    {"rank":"3","rider":"Girmay Biniam","rider_id":"","nationality":"ER","team":"NSN Cycling Team","points":"367","time_gap":"","total_time":""},
    {"rank":"4","rider":"Kanter Max","rider_id":"","nationality":"DE","team":"XDS Astana Team","points":"289","time_gap":"","total_time":""},
    {"rank":"5","rider":"Kooij Olav","rider_id":"","nationality":"NL","team":"Decathlon CMA CGM Team","points":"246","time_gap":"","total_time":""},
    {"rank":"6","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","points":"198","time_gap":"","total_time":""},
    {"rank":"7","rider":"Waerenskjold Soren","rider_id":"","nationality":"NO","team":"Uno-X Mobility","points":"159","time_gap":"","total_time":""},
    {"rank":"8","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","points":"157","time_gap":"","total_time":""},
    {"rank":"9","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","points":"143","time_gap":"","total_time":""},
    {"rank":"10","rider":"Turgis Anthony","rider_id":"","nationality":"FR","team":"TotalEnergies","points":"139","time_gap":"","total_time":""},
]

# KOM (polka dot) final
KOM = [
    {"rank":"1","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","points":"156","time_gap":"","total_time":""},
    {"rank":"2","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","points":"100","time_gap":"","total_time":""},
    {"rank":"3","rider":"Paret-Peintre Valentin","rider_id":"","nationality":"FR","team":"Soudal Quick-Step","points":"99","time_gap":"","total_time":""},
    {"rank":"4","rider":"Kuss Sepp","rider_id":"","nationality":"US","team":"Team Visma | Lease a Bike","points":"55","time_gap":"","total_time":""},
    {"rank":"5","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","points":"50","time_gap":"","total_time":""},
    {"rank":"6","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","points":"41","time_gap":"","total_time":""},
    {"rank":"7","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","points":"40","time_gap":"","total_time":""},
    {"rank":"8","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","points":"36","time_gap":"","total_time":""},
    {"rank":"9","rider":"Johannessen Tobias Halland","rider_id":"","nationality":"NO","team":"Uno-X Mobility","points":"29","time_gap":"","total_time":""},
    {"rank":"10","rider":"Hindley Jai","rider_id":"","nationality":"AU","team":"Red Bull - BORA - hansgrohe","points":"28","time_gap":"","total_time":""},
]

# Youth (white jersey) final
YOUTH = [
    {"rank":"1","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"74:06:08","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+2:14","points":""},
    {"rank":"3","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","total_time":"","time_gap":"+3:20","points":""},
    {"rank":"4","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+8:06","points":""},
    {"rank":"5","rider":"Piganzoli Davide","rider_id":"","nationality":"IT","team":"Team Visma | Lease a Bike","total_time":"","time_gap":"+54:01","points":""},
    {"rank":"6","rider":"Simmons Quinn","rider_id":"","nationality":"US","team":"Lidl - Trek","total_time":"","time_gap":"+1:25:46","points":""},
    {"rank":"7","rider":"Riccitello Matthew","rider_id":"","nationality":"US","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+2:01:27","points":""},
    {"rank":"8","rider":"Castrillo Pablo","rider_id":"","nationality":"ES","team":"Movistar Team","total_time":"","time_gap":"+2:22:01","points":""},
    {"rank":"9","rider":"Garcia Pierna Raul","rider_id":"","nationality":"ES","team":"Movistar Team","total_time":"","time_gap":"+2:42:50","points":""},
    {"rank":"10","rider":"Vauquelin Kevin","rider_id":"","nationality":"FR","team":"Netcompany INEOS","total_time":"","time_gap":"+2:51:35","points":""},
]

# Team classification final
TEAM = [
    {"rank":"1","team":"Lidl - Trek","total_time":"224:57:43","time_gap":None},
    {"rank":"2","team":"UAE Team Emirates - XRG","total_time":"+36:57","time_gap":None},
    {"rank":"3","team":"Red Bull - BORA - hansgrohe","total_time":"+1:06:22","time_gap":None},
    {"rank":"4","team":"Decathlon CMA CGM Team","total_time":"+1:47:44","time_gap":None},
    {"rank":"5","team":"Team Visma | Lease a Bike","total_time":"+2:18:03","time_gap":None},
    {"rank":"6","team":"EF Education - EasyPost","total_time":"+3:38:20","time_gap":None},
    {"rank":"7","team":"Netcompany INEOS","total_time":"+4:49:54","time_gap":None},
    {"rank":"8","team":"Bahrain - Victorious","total_time":"+5:38:20","time_gap":None},
    {"rank":"9","team":"TotalEnergies","total_time":"+5:48:37","time_gap":None},
    {"rank":"10","team":"Pinarello Q36.5 Pro Cycling Team","total_time":"+5:49:14","time_gap":None},
]

data = {
    "stage": 21,
    "gc": GC,
    "points": POINTS,
    "kom": KOM,
    "youth": YOUTH,
    "team": TEAM,
}

with open('D:/codes/velo-rank/tdf_s21_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"S21 final: gc={len(GC)} pts={len(POINTS)} kom={len(KOM)} youth={len(YOUTH)} team={len(TEAM)}")
