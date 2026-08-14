#!/usr/bin/env python3
"""
Generate classification data files for TDF 2026 stages where PCS is blocked.
Data sourced from cyclinguptodate.com and Wikipedia articles.
"""

import json
import sys

# --- S19 Classification Data (from Wikipedia + cyclinguptodate) ---

S19_GC = [
    {"rank":"1","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","total_time":"67:53:00","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","total_time":"","time_gap":"+7:11","points":""},
    {"rank":"3","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"","time_gap":"+9:42","points":""},
    {"rank":"4","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+10:06","points":""},
    {"rank":"5","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain Victorious","total_time":"","time_gap":"+13:00","points":""},
    {"rank":"6","rider":"Skjelmose Mattias","rider_id":"","nationality":"DK","team":"Lidl - Trek","total_time":"","time_gap":"+13:09","points":""},
    {"rank":"7","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+15:58","points":""},
    {"rank":"8","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","total_time":"","time_gap":"+21:15","points":""},
    {"rank":"9","rider":"Pidcock Tom","rider_id":"","nationality":"GB","team":"Pinarello Q36.5 Pro Cycling Team","total_time":"","time_gap":"+21:30","points":""},
    {"rank":"10","rider":"Jegat Jordan","rider_id":"","nationality":"FR","team":"TotalEnergies","total_time":"","time_gap":"+23:21","points":""},
]

S19_POINTS = [
    {"rank":"1","rider":"Pedersen Mads","rider_id":"","nationality":"DK","team":"Lidl - Trek","points":"502","time_gap":"","total_time":""},
    {"rank":"2","rider":"Philipsen Jasper","rider_id":"","nationality":"BE","team":"Alpecin - Premier Tech","points":"445","time_gap":"","total_time":""},
    {"rank":"3","rider":"Girmay Biniam","rider_id":"","nationality":"ER","team":"NSN Cycling Team","points":"361","time_gap":"","total_time":""},
    {"rank":"4","rider":"Kanter Max","rider_id":"","nationality":"DE","team":"XDS Astana Team","points":"271","time_gap":"","total_time":""},
    {"rank":"5","rider":"Kooij Olav","rider_id":"","nationality":"NL","team":"Decathlon CMA CGM Team","points":"230","time_gap":"","total_time":""},
    {"rank":"6","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","points":"185","time_gap":"","total_time":""},
    {"rank":"7","rider":"Waerenskjold Soren","rider_id":"","nationality":"NO","team":"Uno-X Mobility","points":"159","time_gap":"","total_time":""},
    {"rank":"8","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","points":"140","time_gap":"","total_time":""},
    {"rank":"9","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","points":"132","time_gap":"","total_time":""},
    {"rank":"10","rider":"Schmid Mauro","rider_id":"","nationality":"CH","team":"Team Jayco AlUla","points":"131","time_gap":"","total_time":""},
]

S19_KOM = [
    {"rank":"1","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","points":"91","time_gap":"","total_time":""},
    {"rank":"2","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","points":"90","time_gap":"","total_time":""},
    {"rank":"3","rider":"Paret-Peintre Valentin","rider_id":"","nationality":"FR","team":"Soudal Quick-Step","points":"84","time_gap":"","total_time":""},
    {"rank":"4","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","points":"42","time_gap":"","total_time":""},
    {"rank":"5","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain Victorious","points":"37","time_gap":"","total_time":""},
    {"rank":"6","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","points":"34","time_gap":"","total_time":""},
    {"rank":"7","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","points":"34","time_gap":"","total_time":""},
    {"rank":"8","rider":"Johannessen Tobias Halland","rider_id":"","nationality":"NO","team":"Uno-X Mobility","points":"26","time_gap":"","total_time":""},
    {"rank":"9","rider":"Schmid Mauro","rider_id":"","nationality":"CH","team":"Team Jayco AlUla","points":"22","time_gap":"","total_time":""},
    {"rank":"10","rider":"Pidcock Tom","rider_id":"","nationality":"GB","team":"Pinarello Q36.5 Pro Cycling Team","points":"20","time_gap":"","total_time":""},
]

S19_YOUTH = [
    {"rank":"1","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"68:02:42","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+0:24","points":""},
    {"rank":"3","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain Victorious","total_time":"","time_gap":"+3:18","points":""},
    {"rank":"4","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+6:16","points":""},
    {"rank":"5","rider":"Piganzoli Davide","rider_id":"","nationality":"IT","team":"Team Visma | Lease a Bike","total_time":"","time_gap":"+46:15","points":""},
    {"rank":"6","rider":"Simmons Quinn","rider_id":"","nationality":"US","team":"Lidl - Trek","total_time":"","time_gap":"+1:16:49","points":""},
    {"rank":"7","rider":"Castrillo Pablo","rider_id":"","nationality":"ES","team":"Movistar Team","total_time":"","time_gap":"+1:41:55","points":""},
    {"rank":"8","rider":"Riccitello Matthew","rider_id":"","nationality":"US","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+1:55:35","points":""},
    {"rank":"9","rider":"Garcia Raul","rider_id":"","nationality":"ES","team":"Movistar Team","total_time":"","time_gap":"+2:09:19","points":""},
    {"rank":"10","rider":"Vauquelin Kevin","rider_id":"","nationality":"FR","team":"Netcompany INEOS","total_time":"","time_gap":"+2:12:52","points":""},
]

S19_TEAM = [
    {"rank":"1","team":"Lidl - Trek","total_time":"203:46:27","time_gap":None},
    {"rank":"2","team":"UAE Team Emirates - XRG","total_time":"+19:33","time_gap":None},
    {"rank":"3","team":"Red Bull - BORA - hansgrohe","total_time":"+1:06:53","time_gap":None},
    {"rank":"4","team":"Decathlon CMA CGM Team","total_time":"+1:45:33","time_gap":None},
    {"rank":"5","team":"Team Visma | Lease a Bike","total_time":"+1:49:23","time_gap":None},
    {"rank":"6","team":"EF Education - EasyPost","total_time":"+3:09:45","time_gap":None},
    {"rank":"7","team":"Netcompany INEOS","total_time":"+3:50:41","time_gap":None},
    {"rank":"8","team":"Movistar Team","total_time":"+4:31:03","time_gap":None},
    {"rank":"9","team":"Bahrain Victorious","total_time":"+4:46:20","time_gap":None},
    {"rank":"10","team":"Pinarello Q36.5 Pro Cycling Team","total_time":"+4:49:16","time_gap":None},
]

def save_stage(stage, gc, points, kom, youth, team):
    data = {
        "stage": stage,
        "gc": gc,
        "points": points,
        "kom": kom,
        "youth": youth,
        "team": team,
    }
    fn = f"tdf_s{stage}_data.json"
    with open(fn, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"S{stage}: gc={len(gc)} pts={len(points)} kom={len(kom)} youth={len(youth)} team={len(team)} -> {fn}")

if __name__ == '__main__':
    stage = int(sys.argv[1]) if len(sys.argv) > 1 else 19
    if stage == 19:
        save_stage(19, S19_GC, S19_POINTS, S19_KOM, S19_YOUTH, S19_TEAM)
    else:
        print(f"No data for stage {stage}")
