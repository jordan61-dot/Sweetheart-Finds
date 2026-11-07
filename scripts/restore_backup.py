import argparse,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser(description='Restore a private backup into a NEW isolated SQLite file; no network.');p.add_argument('backup',type=Path);p.add_argument('destination',type=Path);a=p.parse_args()
if a.destination.exists():p.error('Destination exists. Existing data will not be overwritten.')
raw=json.loads(a.backup.read_text());order=['products','listings','observations','product_categories','personal','config','ingestion'];tables=raw.get('tables')
if raw.get('format')!='sweetheart-d1-backup' or not isinstance(tables,dict) or set(tables)!=set(order):p.error('Invalid/incomplete backup')
con=sqlite3.connect(a.destination);con.execute('PRAGMA foreign_keys=ON');root=Path(__file__).resolve().parents[1]
try:
 for f in sorted((root/'drizzle').glob('*.sql')):con.executescript(f.read_text())
 with con:
  for table in order:
   columns=[r[1] for r in con.execute('PRAGMA table_info('+table+')')]
   for row in tables[table]:
    if set(row)!=set(columns):raise ValueError('Schema mismatch for '+table)
    con.execute(('INSERT OR REPLACE' if table=='config' else 'INSERT')+' INTO '+table+'('+','.join(columns)+') VALUES ('+','.join('?' for _ in columns)+')',[row[c] for c in columns])
  if con.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Broken backup relationships')
 print(json.dumps({'restored':{t:con.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in order},'integrity':con.execute('PRAGMA integrity_check').fetchone()[0]}))
except Exception:
 con.close();a.destination.unlink(missing_ok=True);raise
