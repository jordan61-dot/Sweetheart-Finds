import sqlite3,time,json,statistics,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=[]
for size in (1000,10000,100000):
 with tempfile.TemporaryDirectory() as tmp:
  path=tmp+'/db.sqlite';db=sqlite3.connect(path)
  for f in sorted((root/'drizzle').glob('*.sql')):db.executescript(f.read_text())
  t=time.perf_counter();db.executemany('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[(f'qa-{n}',f'QA Usahana plush {n}',f'qa{n}','QA','Plush','','Japan',None,'potential','potential',f'usahana plush variant {n}',json.dumps({'title':f'QA Usahana plush {n}','images':[]}), '2026-01-01','2026-01-01',0) for n in range(size)]);db.executemany('INSERT INTO product_categories VALUES (?,?)',[(f'qa-{n}','usahana') for n in range(size)]);db.commit();ingest=time.perf_counter()-t;timings={}
  for label,sql,param in [('old_category','SELECT data FROM products WHERE archived=0 AND id IN(SELECT product_id FROM product_categories WHERE category=?) ORDER BY observed_at DESC,id LIMIT24','usahana'),('indexed_category','SELECT data FROM products WHERE archived=0 AND EXISTS(SELECT 1 FROM product_categories pc WHERE pc.product_id=products.id AND pc.category=?) ORDER BY observed_at DESC,id DESC LIMIT24','usahana'),('broad_fts','SELECT data FROM products WHERE archived=0 AND id IN(SELECT product_id FROM product_search WHERE product_search MATCH ?) ORDER BY observed_at DESC,id DESC LIMIT24','usahana AND plush')]:
   values=[]
   for _ in range(12):
    a=time.perf_counter();rows=db.execute(sql.replace('LIMIT24','LIMIT 24'),(param,)).fetchall();values.append((time.perf_counter()-a)*1000)
   timings[label]={'median_ms':round(statistics.median(values),3),'max_ms':round(max(values),3),'rows':len(rows)}
  out.append({'products':size,'ingestion_seconds':round(ingest,3),'products_per_second':round(size/ingest),'database_bytes':Path(path).stat().st_size,'queries':timings})
print(json.dumps({'environment':'Isolated synthetic local SQLite, warm repeated queries; not production D1 or browser latency','results':out},indent=2))
