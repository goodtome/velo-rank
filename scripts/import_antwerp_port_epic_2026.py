#!/usr/bin/env python3
"""
Import Antwerp Port Epic / Sels Trophy 2026 teams and riders into database.
Avoids duplicates by checking existing teams (by name/uci_code) and riders (by name+team).
"""

import json
import os
import sys
from datetime import datetime
from uuid import uuid4

# Add parent path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))

import mysql.connector
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'server', '.env'))

# Database config
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '13306')),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'mysql123456'),
    'database': os.getenv('DB_NAME', 'jersey_db'),
}

# Race info
RACE_INFO = {
    'race_name': 'Antwerp Port Epic / Sels Trophy',
    'race_name_en': 'Antwerp Port Epic / Sels Trophy',
    'race_name_zh': '安特卫普港史诗赛',
    'race_code': 'antwerp-port-epic-2026',
    'category': 'Continental',
    'category_zh': '洲际赛',
    'gender': 'MEN',
    'season': 2026,
    'country': 'Belgium',
    'start_date': '2026-05-25',
    'end_date': '2026-05-25',
    'total_stages': 1,
    'is_active': 1,
}

# Teams and riders from the screenshot
TEAMS_DATA = [
    {
        "uci_code": "APT", "team_name": "ALPECIN-PREMIER TECH", "country": "BEL",
        "riders": [
            {"number": 1, "name": "DOCKX, Aaron", "nationality": "BEL"},
            {"number": 2, "name": "SENECHAL, Florian", "nationality": "FRA"},
            {"number": 3, "name": "SWEECK, Laurens", "nationality": "BEL"},
            {"number": 4, "name": "UHLIG, Henri", "nationality": "GER"},
            {"number": 5, "name": "VANDEBOSCH, Toon", "nationality": "BEL"},
            {"number": 6, "name": "VANDEPUTTE, Niels", "nationality": "BEL"},
            {"number": 7, "name": "WYSEURE, Joran", "nationality": "BEL"},
        ]
    },
    {
        "uci_code": "JAY", "team_name": "TEAM JAYCO ALULA", "country": "AUS",
        "riders": [
            {"number": 41, "name": "COLOMBO, Riccardo", "nationality": "ITA"},
            {"number": 42, "name": "DE BONDT, Dries", "nationality": "BEL"},
            {"number": 43, "name": "DE POOTER, Dries", "nationality": "BEL"},
            {"number": 44, "name": "GAMPER, Patrick", "nationality": "GER"},
            {"number": 45, "name": "PEDERSEN, Just Carl Emil", "nationality": "DEN"},
            {"number": 46, "name": "SMITHSON, Jed", "nationality": "AUS"},
            {"number": 47, "name": "VERBRUGGE, Jasper", "nationality": "BEL"},
        ]
    },
    {
        "uci_code": "TFB", "team_name": "TEAM FLANDERS - BALOISE", "country": "BEL",
        "riders": [
            {"number": 81, "name": "DEMAN, Bram", "nationality": "BEL"},
            {"number": 82, "name": "GEERAERTS, Ferre", "nationality": "BEL"},
            {"number": 83, "name": "HESTERS, Jules", "nationality": "BEL"},
            {"number": 84, "name": "LAMBRECHT, Michiel", "nationality": "BEL"},
            {"number": 85, "name": "VANDENSTORME, Dylan", "nationality": "BEL"},
            {"number": 86, "name": "VANHOOF, Ward", "nationality": "BEL"},
            {"number": 87, "name": "VERCOUILLIE, Victor", "nationality": "BEL"},
        ]
    },
    {
        "uci_code": "PSA", "team_name": "PAUWELS SAUZEN - ALTEZ INDUS", "country": "BEL",
        "riders": [
            {"number": 121, "name": "DE BRUYCKERE, Kay", "nationality": "BEL"},
            {"number": 122, "name": "DE CLERCQ, Naud", "nationality": "BEL"},
            {"number": 123, "name": "KUYPERS, Gerben", "nationality": "BEL"},
            {"number": 124, "name": "NUYENS, Wies", "nationality": "BEL"},
            {"number": 125, "name": "VANDENBERGHE, Viktor", "nationality": "BEL"},
            {"number": 126, "name": "VANELAERE, Loic", "nationality": "BEL"},
        ]
    },
    {
        "uci_code": "BCY", "team_name": "BEAT CC P/B SAXO", "country": "NED",
        "riders": [
            {"number": 161, "name": "COPPENS, Michiel", "nationality": "BEL"},
            {"number": 162, "name": "DEKKER, David", "nationality": "NED"},
            {"number": 163, "name": "DISSEL, Bram", "nationality": "NED"},
            {"number": 164, "name": "EISING, Tijmen", "nationality": "NED"},
            {"number": 165, "name": "KERCKHAERT, Jochem", "nationality": "BEL"},
            {"number": 166, "name": "KRAMER, Jesse", "nationality": "NED"},
            {"number": 167, "name": "KROONEN, Max", "nationality": "NED"},
        ]
    },
    {
        "uci_code": "TCQ", "team_name": "TEAM COLOQUICK", "country": "DEN",
        "riders": [
            {"number": 201, "name": "HANSEN, Asgaard Tobias", "nationality": "DEN"},
            {"number": 202, "name": "LINDEBO, Mads", "nationality": "DEN"},
            {"number": 203, "name": "NIELSEN, Andreas Stokbro", "nationality": "DEN"},
            {"number": 204, "name": "NIELSEN, Sebastian", "nationality": "DEN"},
            {"number": 205, "name": "NORTOFT, Aalling Morten", "nationality": "DEN"},
            {"number": 206, "name": "SORENSEN, Hjulmans Vos", "nationality": "DEN"},
            {"number": 207, "name": "VON WETTSTEIN, Joshua", "nationality": "DEN"},
        ]
    },
    {
        "uci_code": "TBV", "team_name": "BAHRAIN VICTORIOUS", "country": "BEL",
        "riders": [
            {"number": 11, "name": "BORGO, Alessandro", "nationality": "ITA"},
            {"number": 12, "name": "CAPRA, Thomas", "nationality": "ITA"},
            {"number": 13, "name": "ERZEN, Zak", "nationality": "SLO"},
            {"number": 14, "name": "GOVEKAR, Matevz", "nationality": "SLO"},
            {"number": 15, "name": "MIQUEL DELGADO, Pau", "nationality": "ESP"},
            {"number": 16, "name": "SKERL, Daniel", "nationality": "SLO"},
            {"number": 17, "name": "VAN DER MEULEN, Max", "nationality": "NED"},
        ]
    },
    {
        "uci_code": "TVL", "team_name": "TEAM VISMA | LEASE A BIKE", "country": "NED",
        "riders": [
            {"number": 51, "name": "FIORELLI, Filippo", "nationality": "ITA"},
            {"number": 52, "name": "HAGENES, Per Strand", "nationality": "NOR"},
            {"number": 53, "name": "HOYDAHL, Jonas Kind", "nationality": "NOR"},
            {"number": 54, "name": "KEPPENS, Cedric", "nationality": "BEL"},
            {"number": 55, "name": "KINGS, Ian", "nationality": "AUS"},
            {"number": 56, "name": "MATTIO, Pietro", "nationality": "ITA"},
            {"number": 57, "name": "UGLIHUS, Mikal Grimstad", "nationality": "NOR"},
        ]
    },
    {
        "uci_code": "TNN", "team_name": "TEAM NOVO NORDISK", "country": "USA",
        "riders": [
            {"number": 91, "name": "BEADLE, Hamish", "nationality": "GBR"},
            {"number": 92, "name": "COLLADON, Jacobo", "nationality": "ITA"},
            {"number": 93, "name": "DE GRAEVE, Quinten", "nationality": "BEL"},
            {"number": 94, "name": "MACKIE, Donovan", "nationality": "USA"},
            {"number": 95, "name": "POLGA, Antonio", "nationality": "ITA"},
            {"number": 96, "name": "RIDOLFO, Filippo", "nationality": "ITA"},
            {"number": 97, "name": "WATTELLE, Celestin", "nationality": "FRA"},
        ]
    },
    {
        "uci_code": "AAR", "team_name": "AARCO", "country": "BEL",
        "riders": [
            {"number": 131, "name": "BAGUELIN, Jocelyn", "nationality": "BEL"},
            {"number": 132, "name": "BLAISE, Arthur", "nationality": "BEL"},
            {"number": 133, "name": "DOCKX, Gilles", "nationality": "BEL"},
            {"number": 134, "name": "HANNES, Victor", "nationality": "BEL"},
            {"number": 135, "name": "LOWAGIE, Arthur", "nationality": "BEL"},
            {"number": 136, "name": "VAN DEN BROEK, Axel", "nationality": "BEL"},
            {"number": 137, "name": "ZABELINSKY, Bogdan", "nationality": "UKR"},
        ]
    },
    {
        "uci_code": "EEW", "team_name": "EEW-VIKT CYCLINGTEAM", "country": "NED",
        "riders": [
            {"number": 171, "name": "HAVIK, Yoeri", "nationality": "NED"},
            {"number": 172, "name": "OTTEMA, Rick", "nationality": "NED"},
            {"number": 173, "name": "PETERS, Marvin", "nationality": "NED"},
            {"number": 174, "name": "SCHULTEN, Chiel", "nationality": "NED"},
            {"number": 175, "name": "VAN DER WAL, Rik", "nationality": "NED"},
            {"number": 176, "name": "VELING, Quinten", "nationality": "NED"},
            {"number": 177, "name": "VISSER, Guillaume", "nationality": "NED"},
        ]
    },
    {
        "uci_code": "VWE", "team_name": "VOLKERWESSELS CYCLING TEAM", "country": "NED",
        "riders": [
            {"number": 211, "name": "ABMA, Elmar", "nationality": "NED"},
            {"number": 212, "name": "BRINKMAN, Joost", "nationality": "NED"},
            {"number": 213, "name": "CLAEYS, Robbe", "nationality": "BEL"},
            {"number": 214, "name": "ROECKERT, Finn", "nationality": "NED"},
            {"number": 215, "name": "DE DOBBELAERE, Born", "nationality": "BEL"},
            {"number": 216, "name": "HULSMANS, Senne", "nationality": "BEL"},
            {"number": 217, "name": "VAN HERWAARDEN, Thom", "nationality": "NED"},
        ]
    },
    {
        "uci_code": "LIO", "team_name": "LOTTO INTERMARCHE", "country": "BEL",
        "riders": [
            {"number": 21, "name": "GRIGNARD, Sebastien", "nationality": "BEL"},
            {"number": 22, "name": "KOCKELMANN, Mathieu", "nationality": "LUX"},
            {"number": 23, "name": "MENTEN, Milan", "nationality": "BEL"},
            {"number": 24, "name": "ORINS, Robin", "nationality": "BEL"},
            {"number": 25, "name": "ORN-KRISTOFF, Felix", "nationality": "NOR"},
            {"number": 26, "name": "TAMINIAUX, Lionel", "nationality": "BEL"},
            {"number": 27, "name": "VAN SINTMAARTENSDIJK, Roel", "nationality": "NED"},
        ]
    },
    {
        "uci_code": "COF", "team_name": "COFIDIS", "country": "FRA",
        "riders": [
            {"number": 61, "name": "BIERMANS, Jenthe", "nationality": "BEL"},
            {"number": 62, "name": "CHARRET, Camille", "nationality": "FRA"},
            {"number": 63, "name": "DEBEAUMARCHE, Nicolas", "nationality": "FRA"},
            {"number": 64, "name": "KNIGHT, Oliver", "nationality": "GBR"},
            {"number": 65, "name": "OURSELIN, Paul", "nationality": "FRA"},
            {"number": 66, "name": "PAGE, Hugo", "nationality": "FRA"},
            {"number": 67, "name": "RENARD, Alexis", "nationality": "FRA"},
        ]
    },
    {
        "uci_code": "PTV", "team_name": "TEAM POLTI VISITMALTA", "country": "ITA",
        "riders": [
            {"number": 101, "name": "BELLETTA, Dario Igor", "nationality": "ITA"},
            {"number": 102, "name": "BENITO GONZALEZ, Adrian", "nationality": "ESP"},
            {"number": 103, "name": "BESSEGA, Gabriele", "nationality": "ITA"},
            {"number": 104, "name": "BESSEGA, Tommaso", "nationality": "ITA"},
            {"number": 105, "name": "PENALVER ANIORTE, Manuel", "nationality": "ESP"},
            {"number": 106, "name": "PIETROBON, Andrea", "nationality": "ITA"},
            {"number": 107, "name": "RACCAGNI, Gabriele", "nationality": "ITA"},
        ]
    },
    {
        "uci_code": "A6C", "team_name": "ATOM 6 BIKES - CYCLEUR DE LUX", "country": "AUS",
        "riders": [
            {"number": 141, "name": "DE MOYER, Kenay", "nationality": "BEL"},
            {"number": 142, "name": "DHAEYE, Enrico", "nationality": "BEL"},
            {"number": 143, "name": "FOSTER, Thibault", "nationality": "BEL"},
            {"number": 144, "name": "KING, Matthew", "nationality": "GBR"},
            {"number": 145, "name": "MCKAY, James", "nationality": "GBR"},
            {"number": 146, "name": "NIELSEN, Lorents Magnus", "nationality": "DEN"},
            {"number": 147, "name": "RADCLIFFE, George", "nationality": "GBR"},
        ]
    },
    {
        "uci_code": "LUC", "team_name": "LUCKY SPORT CYCLING TEAM", "country": "NED",
        "riders": [
            {"number": 181, "name": "KAGEVI, Carl", "nationality": "SWE"},
            {"number": 182, "name": "KALLBERG, Axel", "nationality": "SWE"},
            {"number": 183, "name": "KLVYER, Hjalmar", "nationality": "SWE"},
            {"number": 184, "name": "LENNARTSSON, Hugo", "nationality": "SWE"},
            {"number": 185, "name": "RAGILO, Frank Aron", "nationality": "EST"},
            {"number": 186, "name": "STRAND, Peder Dahl", "nationality": "NOR"},
            {"number": 187, "name": "THOMPSON, Gustav", "nationality": "SWE"},
        ]
    },
    {
        "uci_code": "SOQ", "team_name": "SOUDAL QUICK-STEP", "country": "BEL",
        "riders": [
            {"number": 31, "name": "DESAL, Ceriel", "nationality": "BEL"},
            {"number": 32, "name": "GELDERS, Gil", "nationality": "BEL"},
            {"number": 33, "name": "LAMPAERT, Yves", "nationality": "BEL"},
            {"number": 34, "name": "MERLIER, Tim", "nationality": "BEL"},
            {"number": 35, "name": "SVRCEK, Martin", "nationality": "SVK"},
            {"number": 36, "name": "VAN TRICHT, Stan", "nationality": "BEL"},
            {"number": 37, "name": "VERVENNE, Jonathan", "nationality": "BEL"},
        ]
    },
    {
        "uci_code": "PQT", "team_name": "PINARELLO-Q36.5 PRO CYCLING", "country": "SUI",
        "riders": [
            {"number": 71, "name": "DE GENDT, Aime", "nationality": "BEL"},
            {"number": 72, "name": "FRISON, Frederik", "nationality": "BEL"},
            {"number": 73, "name": "HOUCOUX, Emmanuel", "nationality": "BEL"},
            {"number": 74, "name": "LIEPINS, Emils", "nationality": "LAT"},
            {"number": 75, "name": "MALECKI, Kamil", "nationality": "POL"},
            {"number": 76, "name": "VAN MOER, Brent", "nationality": "BEL"},
            {"number": 77, "name": "WRIGHT, Alfred Brockwell", "nationality": "GBR"},
        ]
    },
    {
        "uci_code": "TEN", "team_name": "TOTALENERGIES", "country": "FRA",
        "riders": [
            {"number": 111, "name": "DUJARDIN, Sandy", "nationality": "FRA"},
            {"number": 112, "name": "GUERNALEC, Thibault", "nationality": "FRA"},
            {"number": 113, "name": "JOUSSEAUME, Alan", "nationality": "FRA"},
            {"number": 114, "name": "LEVEQUE, Theo", "nationality": "FRA"},
            {"number": 115, "name": "MARCEROU, Nicola", "nationality": "FRA"},
            {"number": 116, "name": "RETAILLEAU, Valentin", "nationality": "FRA"},
            {"number": 117, "name": "THIERRY, Pierre", "nationality": "FRA"},
        ]
    },
    {
        "uci_code": "BPL", "team_name": "BALOISE VERZEKERINGEN - HET PELCKMANS", "country": "BEL",
        "riders": [
            {"number": 151, "name": "BAERS, Eric", "nationality": "BEL"},
            {"number": 152, "name": "BELLENS, Jarno", "nationality": "BEL"},
            {"number": 153, "name": "GODFROID, Olivier", "nationality": "BEL"},
            {"number": 154, "name": "HILLEN, Michiel", "nationality": "BEL"},
            {"number": 155, "name": "MELLAERTS, Robbe", "nationality": "BEL"},
            {"number": 156, "name": "RONHAAR, Pim", "nationality": "NED"},
            {"number": 157, "name": "VAN DEN BOER, Arthur", "nationality": "BEL"},
        ]
    },
    {
        "uci_code": "NDT", "team_name": "NSN DEVELOPMENT TEAM", "country": "SWE",
        "riders": [
            {"number": 191, "name": "AMEY, Oscar", "nationality": "GBR"},
            {"number": 192, "name": "EDINGER, Roei", "nationality": "ISR"},
            {"number": 193, "name": "HEWES, Alexander", "nationality": "GBR"},
            {"number": 194, "name": "KOGUT, Oded", "nationality": "ISR"},
            {"number": 195, "name": "MARTI SORIANO, Pau", "nationality": "ESP"},
            {"number": 196, "name": "PIRINEN, Miko", "nationality": "FIN"},
            {"number": 197, "name": "TARLING, Luke Finlay", "nationality": "GBR"},
        ]
    },
]


def normalize_name(name):
    """Normalize rider name: Last, First -> First Last"""
    name = name.strip()
    if ',' in name:
        parts = [p.strip() for p in name.split(',')]
        if len(parts) == 2:
            return f"{parts[1]} {parts[0]}"
    return name


def get_team_slug(name):
    """Generate team slug from name"""
    return name.lower().replace(' ', '-').replace('|', '').replace('/', '-')


def get_rider_slug(name):
    """Generate rider slug from normalized name"""
    return name.lower().replace(' ', '-').replace(',', '').replace("'", '')


def main():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    print("=" * 60)
    print("Antwerp Port Epic / Sels Trophy 2026 - Data Import")
    print("=" * 60)
    
    # 1. Check if race exists
    cursor.execute("SELECT id FROM races WHERE race_code = %s", (RACE_INFO['race_code'],))
    existing_race = cursor.fetchone()
    
    if existing_race:
        race_id = existing_race['id']
        print(f"\n[EXISTING] Race already exists: {race_id}")
    else:
        race_id = str(uuid4())
        cursor.execute("""
            INSERT INTO races (id, race_name, race_name_en, race_name_zh, race_code,
                category, category_zh, gender, season, country, start_date, end_date,
                total_stages, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """, (race_id, RACE_INFO['race_name'], RACE_INFO['race_name_en'],
              RACE_INFO['race_name_zh'], RACE_INFO['race_code'],
              RACE_INFO['category'], RACE_INFO['category_zh'], RACE_INFO['gender'],
              RACE_INFO['season'], RACE_INFO['country'], RACE_INFO['start_date'],
              RACE_INFO['end_date'], RACE_INFO['total_stages'], RACE_INFO['is_active']))
        print(f"\n[CREATED] Race: {race_id}")
    
    # 2. Create stage if not exists
    cursor.execute("SELECT id FROM stages WHERE race_id = %s", (race_id,))
    existing_stage = cursor.fetchone()
    
    if existing_stage:
        stage_id = existing_stage['id']
        print(f"[EXISTING] Stage already exists: {stage_id}")
    else:
        stage_id = str(uuid4())
        cursor.execute("""
            INSERT INTO stages (id, race_id, stage_number, stage_name, stage_name_zh,
                stage_type, date, start_city, finish_city, stage_code, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """, (stage_id, race_id, 1, 'Antwerp Port Epic', '安特卫普港史诗赛',
              'Flat', RACE_INFO['start_date'], 'Antwerp', 'Antwerp',
              f"{RACE_INFO['race_code']}-s1"))
        print(f"[CREATED] Stage: {stage_id}")
    
    # 3. Import teams (skip existing by uci_code)
    cursor.execute("SELECT uci_code, id, team_name FROM teams")
    existing_teams = {row['uci_code']: row for row in cursor.fetchall()}
    
    new_teams = 0
    skipped_teams = 0
    team_id_map = {}
    
    for team_data in TEAMS_DATA:
        uci_code = team_data['uci_code']
        if uci_code in existing_teams:
            team_id = existing_teams[uci_code]['id']
            print(f"[SKIP TEAM] {uci_code}: {existing_teams[uci_code]['team_name']}")
            skipped_teams += 1
        else:
            team_id = str(uuid4())
            cursor.execute("""
                INSERT INTO teams (id, uci_code, team_name, team_name_en, team_slug, country, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (team_id, uci_code, team_data['team_name'], team_data['team_name'],
                  get_team_slug(team_data['team_name']), team_data['country']))
            new_teams += 1
            print(f"[NEW TEAM] {uci_code}: {team_data['team_name']}")
        team_id_map[uci_code] = team_id
    
    # 4. Import riders (skip existing by name)
    cursor.execute("SELECT rider_name, id FROM riders")
    existing_riders = {row['rider_name']: row['id'] for row in cursor.fetchall()}
    
    new_riders = 0
    skipped_riders = 0
    rider_id_map = {}
    
    for team_data in TEAMS_DATA:
        team_id = team_id_map[team_data['uci_code']]
        for rider in team_data['riders']:
            normalized = normalize_name(rider['name'])
            
            # Check if rider exists (by normalized name)
            if normalized in existing_riders:
                rider_id = existing_riders[normalized]
                skipped_riders += 1
            else:
                # Also check by raw name format
                raw_name = rider['name'].strip()
                if raw_name in existing_riders:
                    rider_id = existing_riders[raw_name]
                    skipped_riders += 1
                else:
                    rider_id = str(uuid4())
                    cursor.execute("""
                        INSERT INTO riders (id, rider_name, rider_slug, nationality, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, NOW(), NOW())
                    """, (rider_id, normalized, get_rider_slug(normalized), rider['nationality']))
                    existing_riders[normalized] = rider_id
                    new_riders += 1
            
            rider_id_map[f"{team_data['uci_code']}_{rider['number']}"] = {
                'rider_id': rider_id,
                'team_id': team_id,
                'number': rider['number'],
                'name': normalized
            }
    
    conn.commit()
    
    # Summary
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"Race ID:        {race_id}")
    print(f"Stage ID:       {stage_id}")
    print(f"Teams:          {new_teams} new, {skipped_teams} skipped")
    print(f"Riders:         {new_riders} new, {skipped_riders} skipped")
    print(f"Total riders:   {len(rider_id_map)}")
    
    cursor.close()
    conn.close()
    print("\nDone!")


if __name__ == '__main__':
    main()
