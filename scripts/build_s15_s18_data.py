#!/usr/bin/env python3
"""Build classification data for S15 and S18 from cyclinguptodate search results."""
import json

# ===== S15 (after Stage 15, July 19) =====
S15_GC = [
    {"rank":"1","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","total_time":"55:41:31","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","total_time":"","time_gap":"+5:00","points":""},
    {"rank":"3","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"","time_gap":"+5:58","points":""},
    {"rank":"4","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+6:23","points":""},
    {"rank":"5","rider":"Lipowitz Florian","rider_id":"","nationality":"DE","team":"Red Bull - BORA - hansgrohe","total_time":"","time_gap":"+6:48","points":""},
    {"rank":"6","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+7:28","points":""},
    {"rank":"7","rider":"Skjelmose Mattias","rider_id":"","nationality":"DK","team":"Lidl - Trek","total_time":"","time_gap":"+9:38","points":""},
    {"rank":"8","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","total_time":"","time_gap":"+10:28","points":""},
    {"rank":"9","rider":"Pidcock Tom","rider_id":"","nationality":"GB","team":"Pinarello Q36.5 Pro Cycling Team","total_time":"","time_gap":"+10:59","points":""},
    {"rank":"10","rider":"Jegat Jordan","rider_id":"","nationality":"FR","team":"TotalEnergies","total_time":"","time_gap":"+19:26","points":""},
    {"rank":"11","rider":"Voisard Yannis","rider_id":"","nationality":"CH","team":"Tudor Pro Cycling Team","total_time":"","time_gap":"+21:44","points":""},
    {"rank":"12","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","total_time":"","time_gap":"+22:08","points":""},
    {"rank":"13","rider":"Van Wilder Ilan","rider_id":"","nationality":"BE","team":"Soudal Quick-Step","total_time":"","time_gap":"+22:09","points":""},
    {"rank":"14","rider":"Yates Adam","rider_id":"","nationality":"GB","team":"UAE Team Emirates - XRG","total_time":"","time_gap":"+24:12","points":""},
    {"rank":"15","rider":"Piganzoli Davide","rider_id":"","nationality":"IT","team":"Team Visma | Lease a Bike","total_time":"","time_gap":"+24:42","points":""},
    {"rank":"16","rider":"Bernal Egan","rider_id":"","nationality":"CO","team":"Netcompany INEOS","total_time":"","time_gap":"+41:01","points":""},
    {"rank":"17","rider":"Kuss Sepp","rider_id":"","nationality":"US","team":"Team Visma | Lease a Bike","total_time":"","time_gap":"+45:38","points":""},
    {"rank":"18","rider":"McNulty Brandon","rider_id":"","nationality":"US","team":"UAE Team Emirates - XRG","total_time":"","time_gap":"+50:31","points":""},
    {"rank":"19","rider":"Quinn Sean","rider_id":"","nationality":"US","team":"EF Education - EasyPost","total_time":"","time_gap":"+1:03:16","points":""},
    {"rank":"20","rider":"Prodhomme Nicolas","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+1:03:28","points":""},
]
S15_POINTS = [
    {"rank":"1","rider":"Pedersen Mads","rider_id":"","nationality":"DK","team":"Lidl - Trek","points":"417","time_gap":"","total_time":""},
    {"rank":"2","rider":"Philipsen Jasper","rider_id":"","nationality":"BE","team":"Alpecin - Premier Tech","points":"386","time_gap":"","total_time":""},
    {"rank":"3","rider":"Girmay Biniam","rider_id":"","nationality":"ER","team":"NSN Cycling Team","points":"361","time_gap":"","total_time":""},
]
S15_KOM = [
    {"rank":"1","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","points":"67","time_gap":"","total_time":""},
    {"rank":"2","rider":"Paret-Peintre Valentin","rider_id":"","nationality":"FR","team":"Soudal Quick-Step","points":"45","time_gap":"","total_time":""},
    {"rank":"3","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","points":"39","time_gap":"","total_time":""},
    {"rank":"4","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","points":"34","time_gap":"","total_time":""},
    {"rank":"5","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","points":"31","time_gap":"","total_time":""},
    {"rank":"6","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","points":"30","time_gap":"","total_time":""},
    {"rank":"7","rider":"Pidcock Tom","rider_id":"","nationality":"GB","team":"Pinarello Q36.5 Pro Cycling Team","points":"28","time_gap":"","total_time":""},
    {"rank":"8","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","points":"22","time_gap":"","total_time":""},
    {"rank":"9","rider":"Lipowitz Florian","rider_id":"","nationality":"DE","team":"Red Bull - BORA - hansgrohe","points":"20","time_gap":"","total_time":""},
    {"rank":"10","rider":"Prodhomme Nicolas","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","points":"17","time_gap":"","total_time":""},
]
S15_YOUTH = [
    {"rank":"1","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"55:47:29","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+0:25","points":""},
    {"rank":"3","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+1:30","points":""},
    {"rank":"4","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","total_time":"","time_gap":"+4:30","points":""},
    {"rank":"5","rider":"Piganzoli Davide","rider_id":"","nationality":"IT","team":"Team Visma | Lease a Bike","total_time":"","time_gap":"+18:44","points":""},
]
S15_TEAM = [
    {"rank":"1","team":"Lidl - Trek","total_time":"167:15:39","time_gap":None},
    {"rank":"2","team":"UAE Team Emirates - XRG","total_time":"+3:19","time_gap":None},
    {"rank":"3","team":"Red Bull - BORA - hansgrohe","total_time":"+47:39","time_gap":None},
]

# ===== S18 (after Stage 18, July 23) =====
S18_GC = [
    {"rank":"1","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","total_time":"64:35:13","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","total_time":"","time_gap":"+4:30","points":""},
    {"rank":"3","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"","time_gap":"+5:58","points":""},
    {"rank":"4","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+6:23","points":""},
    {"rank":"5","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","total_time":"","time_gap":"+8:58","points":""},
    {"rank":"6","rider":"Skjelmose Mattias","rider_id":"","nationality":"DK","team":"Lidl - Trek","total_time":"","time_gap":"+9:38","points":""},
    {"rank":"7","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+12:58","points":""},
    {"rank":"8","rider":"Pidcock Tom","rider_id":"","nationality":"GB","team":"Pinarello Q36.5 Pro Cycling Team","total_time":"","time_gap":"+12:58","points":""},
    {"rank":"9","rider":"Jegat Jordan","rider_id":"","nationality":"FR","team":"TotalEnergies","total_time":"","time_gap":"+14:04","points":""},
    {"rank":"10","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","total_time":"","time_gap":"+21:00","points":""},
    {"rank":"11","rider":"Voisard Yannis","rider_id":"","nationality":"CH","team":"Tudor Pro Cycling Team","total_time":"","time_gap":"+24:18","points":""},
    {"rank":"12","rider":"Van Wilder Ilan","rider_id":"","nationality":"BE","team":"Soudal Quick-Step","total_time":"","time_gap":"+26:30","points":""},
    {"rank":"13","rider":"Johannessen Tobias Halland","rider_id":"","nationality":"NO","team":"Uno-X Mobility","total_time":"","time_gap":"+48:41","points":""},
    {"rank":"14","rider":"Bernal Egan","rider_id":"","nationality":"CO","team":"Netcompany INEOS","total_time":"","time_gap":"+48:46","points":""},
    {"rank":"15","rider":"Prodhomme Nicolas","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+1:07:39","points":""},
    {"rank":"16","rider":"Kuss Sepp","rider_id":"","nationality":"US","team":"Team Visma | Lease a Bike","total_time":"","time_gap":"+1:07:39","points":""},
    {"rank":"17","rider":"Hindley Jai","rider_id":"","nationality":"AU","team":"Red Bull - BORA - hansgrohe","total_time":"","time_gap":"+1:09:01","points":""},
    {"rank":"18","rider":"Benoot Tiesj","rider_id":"","nationality":"BE","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+1:14:18","points":""},
    {"rank":"19","rider":"Quinn Sean","rider_id":"","nationality":"US","team":"EF Education - EasyPost","total_time":"","time_gap":"+1:19:23","points":""},
    {"rank":"20","rider":"Simmons Quinn","rider_id":"","nationality":"US","team":"Lidl - Trek","total_time":"","time_gap":"+1:19:55","points":""},
]
S18_POINTS = [
    {"rank":"1","rider":"Pedersen Mads","rider_id":"","nationality":"DK","team":"Lidl - Trek","points":"477","time_gap":"","total_time":""},
    {"rank":"2","rider":"Philipsen Jasper","rider_id":"","nationality":"BE","team":"Alpecin - Premier Tech","points":"445","time_gap":"","total_time":""},
    {"rank":"3","rider":"Girmay Biniam","rider_id":"","nationality":"ER","team":"NSN Cycling Team","points":"361","time_gap":"","total_time":""},
    {"rank":"4","rider":"Kanter Max","rider_id":"","nationality":"DE","team":"XDS Astana Team","points":"271","time_gap":"","total_time":""},
    {"rank":"5","rider":"Kooij Olav","rider_id":"","nationality":"NL","team":"Decathlon CMA CGM Team","points":"230","time_gap":"","total_time":""},
    {"rank":"6","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","points":"165","time_gap":"","total_time":""},
    {"rank":"7","rider":"Waerenskjold Soren","rider_id":"","nationality":"NO","team":"Uno-X Mobility","points":"159","time_gap":"","total_time":""},
    {"rank":"8","rider":"Schmid Mauro","rider_id":"","nationality":"CH","team":"Team Jayco AlUla","points":"131","time_gap":"","total_time":""},
    {"rank":"9","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","points":"130","time_gap":"","total_time":""},
    {"rank":"10","rider":"Turgis Anthony","rider_id":"","nationality":"FR","team":"TotalEnergies","points":"129","time_gap":"","total_time":""},
]
S18_KOM = [
    {"rank":"1","rider":"Pogacar Tadej","rider_id":"","nationality":"SI","team":"UAE Team Emirates - XRG","points":"70","time_gap":"","total_time":""},
    {"rank":"2","rider":"Paret-Peintre Valentin","rider_id":"","nationality":"FR","team":"Soudal Quick-Step","points":"69","time_gap":"","total_time":""},
    {"rank":"3","rider":"Carapaz Richard","rider_id":"","nationality":"EC","team":"EF Education - EasyPost","points":"63","time_gap":"","total_time":""},
    {"rank":"4","rider":"Evenepoel Remco","rider_id":"","nationality":"BE","team":"Red Bull - BORA - hansgrohe","points":"36","time_gap":"","total_time":""},
    {"rank":"5","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","points":"34","time_gap":"","total_time":""},
    {"rank":"6","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","points":"30","time_gap":"","total_time":""},
    {"rank":"7","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","points":"22","time_gap":"","total_time":""},
    {"rank":"8","rider":"Schmid Mauro","rider_id":"","nationality":"CH","team":"Team Jayco AlUla","points":"22","time_gap":"","total_time":""},
    {"rank":"9","rider":"Pidcock Tom","rider_id":"","nationality":"GB","team":"Pinarello Q36.5 Pro Cycling Team","points":"20","time_gap":"","total_time":""},
    {"rank":"10","rider":"Johannessen Tobias Halland","rider_id":"","nationality":"NO","team":"Uno-X Mobility","points":"18","time_gap":"","total_time":""},
]
S18_YOUTH = [
    {"rank":"1","rider":"del Toro Isaac","rider_id":"","nationality":"MX","team":"UAE Team Emirates - XRG","total_time":"64:42:04","time_gap":"0:00","points":""},
    {"rank":"2","rider":"Seixas Paul","rider_id":"","nationality":"FR","team":"Decathlon CMA CGM Team","total_time":"","time_gap":"+0:20","points":""},
    {"rank":"3","rider":"Martinez Lenny","rider_id":"","nationality":"FR","team":"Bahrain - Victorious","total_time":"","time_gap":"+3:00","points":""},
    {"rank":"4","rider":"Ayuso Juan","rider_id":"","nationality":"ES","team":"Lidl - Trek","total_time":"","time_gap":"+2:31","points":""},
    {"rank":"5","rider":"Piganzoli Davide","rider_id":"","nationality":"IT","team":"Team Visma | Lease a Bike","total_time":"","time_gap":"+46:15","points":""},
]
S18_TEAM = [
    {"rank":"1","team":"Lidl - Trek","total_time":"193:36:59","time_gap":None},
    {"rank":"2","team":"UAE Team Emirates - XRG","total_time":"+10:00","time_gap":None},
    {"rank":"3","team":"Red Bull - BORA - hansgrohe","total_time":"+50:00","time_gap":None},
]

def save(stage, gc, pts, kom, youth, team):
    data = {"stage":stage, "gc":gc, "points":pts, "kom":kom, "youth":youth, "team":team}
    fn = f"D:/codes/velo-rank/tdf_s{stage}_data.json"
    with open(fn, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"S{stage}: gc={len(gc)} pts={len(pts)} kom={len(kom)} youth={len(youth)} team={len(team)}")

save(15, S15_GC, S15_POINTS, S15_KOM, S15_YOUTH, S15_TEAM)
save(18, S18_GC, S18_POINTS, S18_KOM, S18_YOUTH, S18_TEAM)
