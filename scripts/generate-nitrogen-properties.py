"""Generate the bounded browser lookup from CoolProp; run from repository root."""
import json
from pathlib import Path
import CoolProp
from CoolProp.CoolProp import PropsSI

temperatures = list(range(200, 501, 5))
pressures = [101325.0] + [float(p) for p in range(200000, 40000001, 200000)]
rows = [[[float(f'{PropsSI(key, "T", t, "P", p, "Nitrogen"):.9g}')
          for key in ('D', 'V', 'A')] for p in pressures] for t in temperatures]
Path('src/nitrogenProperties.json').write_text(json.dumps({
    'source': f'CoolProp {CoolProp.__version__}, HEOS Nitrogen; density kg/m3, viscosity Pa s, sound m/s',
    'temperatures': temperatures, 'pressures': pressures, 'rows': rows,
}, separators=(',', ':')) + '\n')
