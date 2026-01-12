import json

def generate():
    try:
        with open('airline_source.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        mapping = {}
        for item in data:
            icao = item.get('icao')
            iata = item.get('iata')
            if icao and iata and len(icao) == 3 and len(iata) == 2 and iata not in ['-', 'N/A', '\\N']:
                mapping[icao.upper()] = iata.upper()
        
        # Write to python file
        with open('airlines_data.py', 'w', encoding='utf-8') as f:
            f.write("# Auto-generated ICAO -> IATA mapping\n")
            f.write(f"AIRLINES_ICAO_TO_IATA = {json.dumps(mapping, indent=4)}\n")
            
        print(f"Generated airlines_data.py with {len(mapping)} entries.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    generate()
