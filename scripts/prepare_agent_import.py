"""Resolve explicit roster codes against the existing polling-unit reference."""
import collections
import csv
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
folder = Path(sys.argv[1])
source = json.loads((folder / 'comprehensive-source.json').read_text(encoding='utf-8'))
def key(value):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFKD', str(value)).encode('ascii', 'ignore').decode().lower())
def phone(value):
    digits = re.sub(r'\D', '', value)
    if digits.startswith('234') and len(digits) == 13: digits = '0' + digits[3:]
    if len(digits) == 10 and digits[0] in '789': digits = '0' + digits
    return digits if re.fullmatch(r'0[789]\d{9}', digits) else ''

with open(sys.argv[2], encoding='utf-8-sig', newline='') as file:
    reference = [r for r in csv.DictReader(file) if r['State / FCT'].upper() == 'OYO']
lgas = {key(r['Local Government Area']): r['Local Government Area'] for r in reference}
aliases = {'su urulere': 'SURULERE', 'suurulere': 'SURULERE', 'ibsouthwest': 'IBADAN SOUTH WEST', 'orelope': 'OORELOPE'}
wards = collections.defaultdict(dict)
units = collections.defaultdict(dict)
for record in reference:
    lga, ward = record['Local Government Area'], record['Registration Area / Ward']
    wards[lga][int(record['Ward / RA Code'])] = ward
    units[lga, ward][int(record['Polling Unit Code'].split('/')[-1])] = record['Polling Unit Name / Location']

def ward_number(value):
    text = value.upper().replace('WARD O', 'WARD 0')
    for word, number in [('ONE', 1), ('TWO', 2), ('THREE', 3)]:
        text = re.sub(r'\bWARD\s+' + word + r'\b', f'WARD {number}', text)
    match = re.search(r'\bWARD[.\s]*(\d{1,3})\b', text) or re.match(r'^(\d{1,3})(?:\s*[:.-]|\s*$)', text)
    return int(match.group(1)) if match else None

prepared = []
duplicates = []
seen = {}
for row in source['records']:
    raw = key(re.sub(r'\s+LG$', '', row['sheet']))
    lga = aliases.get(raw) or lgas.get(raw)
    if not lga: raise ValueError(f"Unresolved LGA: {row['sheet']}")
    name = re.sub(r'^NAME\s+|\s+PHONE$', '', row['name'], flags=re.I).strip()
    normalized_phone = phone(row['phone'])
    flags = []
    if not normalized_phone: flags.append('Phone missing or invalid; use login ID')
    matched_wards = [value for value in wards[lga].values() if key(value) == key(row['ward'])]
    number = ward_number(row['ward'])
    ward = matched_wards[0] if len(matched_wards) == 1 else wards[lga].get(number, '')
    if not ward: flags.append('Ward needs review; included in LGA count only')
    unit = ''
    if ward:
        choices = units[lga, ward]
        matched_units = [value for value in choices.values() if key(value) == key(row['pollingUnit'])]
        unit_match = re.match(r'^(?:UNIT\s*)?(\d{1,3})(?:\b|\s*[-:])', row['pollingUnit'], re.I)
        if not unit_match: unit_match = re.search(r'\bUNIT\s*(\d{1,3})\b', row['pollingUnit'], re.I)
        unit = matched_units[0] if len(matched_units) == 1 else choices.get(int(unit_match.group(1)), '') if unit_match else ''
    if not unit: flags.append('Polling unit needs review; included in matched ward and LGA counts')
    identity = '|'.join(key(v) for v in [lga, name, normalized_phone or row['phone'], row['ward'], row['pollingUnit']])
    if identity in seen:
        duplicates.append({**row, 'duplicateOf': seen[identity]})
        continue
    login_id = f"PU-{key(lga).upper()}-{row['row']:04d}"
    seen[identity] = login_id
    prepared.append({
        'id': 'pu_' + hashlib.sha256(identity.encode()).hexdigest()[:24],
        'name': name, 'email': login_id.lower() + '@agents.sigar.invalid', 'loginId': login_id,
        'role': 'Agent', 'rank': 'Agent', 'active': True, 'state': 'Oyo', 'lga': lga,
        'ward': ward, 'pollingUnit': unit, 'station': normalized_phone or row['phone'],
        'unit': 'Polling Unit Agent', 'unitType': 'Field Team', 'command': 'Oyo State Command', 'division': '',
        'lat': None, 'lng': None,
        'importSource': {'file': source['source'], **row}, 'importWarnings': flags,
    })

phones = collections.Counter(phone(user['station']) for user in prepared if phone(user['station']))
for user in prepared:
    value = phone(user['station'])
    user['preferredLogin'] = value if value and phones[value] == 1 else user['loginId']
    if value and phones[value] > 1: user['importWarnings'].append('Shared phone number; use login ID')
summary = {'sourceRows': len(source['records']), 'accounts': len(prepared), 'duplicateRows': len(duplicates),
    'uniquePhoneLogins': sum(user['preferredLogin'] != user['loginId'] for user in prepared),
    'loginIdRequired': sum(user['preferredLogin'] == user['loginId'] for user in prepared),
    'matchedWard': sum(bool(user['ward']) for user in prepared), 'matchedPollingUnit': sum(bool(user['pollingUnit']) for user in prepared),
    'byLga': dict(sorted(collections.Counter(user['lga'] for user in prepared).items()))}
(folder / 'prepared.json').write_text(json.dumps({'summary': summary, 'users': prepared, 'duplicates': duplicates}, ensure_ascii=False, indent=2), encoding='utf-8')
with (folder / 'agent-login-roster.csv').open('w', encoding='utf-8-sig', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['Source sheet', 'Source row', 'Agent name', 'Phone', 'Sign-in', 'Alternative login ID', 'LGA', 'Ward', 'Polling unit', 'Source ward', 'Source polling unit', 'Review notes'])
    for user in prepared:
        original = user['importSource']
        values = [original['sheet'], original['row'], user['name'], user['station'], user['preferredLogin'], user['loginId'], user['lga'], user['ward'], user['pollingUnit'], original['ward'], original['pollingUnit'], '; '.join(user['importWarnings'])]
        writer.writerow(["'" + str(v) if str(v).startswith(('=', '+', '-', '@')) else v for v in values])
(folder / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary))
