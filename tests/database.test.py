"""SQLite/D1-compatible migration, transaction and query regressions in isolation."""
import sqlite3, unittest, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class DatabaseTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.execute('PRAGMA foreign_keys=ON')
  self.db.executescript((ROOT/'drizzle/0000_easy_red_shift.sql').read_text());self.db.executescript((ROOT/'drizzle/0001_discovery_foundation.sql').read_text());self.db.execute("INSERT INTO config VALUES ('catalog-revision','0')");self.db.commit()
 def product(self,id='p1',title='My Melody Plush',search='my melody plush sanrio'):
  self.db.execute('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(id,title,id,'Sanrio','Plush','','Japan',None,'catalog','reviewed',search,json.dumps({'title':title,'images':[]}), '2026-11-07','2026-11-07',0))
 def test_migration_and_fts_trigger(self):
  self.product();self.assertEqual(self.db.execute('SELECT product_id FROM product_search WHERE product_search MATCH ?',('"mel"*',)).fetchone()[0],'p1')
  self.db.execute('UPDATE products SET search=? WHERE id=?',('usahana stationery','p1'));self.assertEqual(self.db.execute('SELECT COUNT(*) FROM product_search WHERE product_search MATCH ?',('"usahana"*',)).fetchone()[0],1)
  self.db.execute('DELETE FROM products');self.assertEqual(self.db.execute('SELECT COUNT(*) FROM product_search').fetchone()[0],0)
 def test_foreign_keys_unique_ids_and_rollback(self):
  self.product();self.db.commit()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:
    self.db.execute('INSERT INTO product_categories VALUES (?,?)',('p1','sanrio'))
    self.db.execute('INSERT INTO product_categories VALUES (?,?)',('missing','my-melody'))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM product_categories').fetchone()[0],0)
 def test_compare_and_swap_prevents_lost_update(self):
  self.db.execute('INSERT INTO personal VALUES (?,?,?,?)',('user',0,'{}','now'))
  a=self.db.execute('UPDATE personal SET revision=revision+1,data=? WHERE user_id=? AND revision=?',('{"favorites":["p1"]}','user',0)).rowcount
  b=self.db.execute('UPDATE personal SET revision=revision+1,data=? WHERE user_id=? AND revision=?',('{"favorites":["p2"]}','user',0)).rowcount
  self.assertEqual((a,b),(1,0));self.assertIn('p1',self.db.execute('SELECT data FROM personal').fetchone()[0])
 def test_cross_currency_filter_and_null_price(self):
  self.product()
  for id,price,currency in [('usd',10000000,'USD'),('jpy',500000000,'JPY'),('null',None,'USD')]:self.db.execute('INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?,?)',(id,'p1','Fixture','https://example.com/'+id,price,currency,'Unknown','unknown','unverified',None,'{}'))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM listings WHERE currency=? AND price_micros<=?',('USD',25000000)).fetchone()[0],1)
 def test_sql_injection_values_remain_data(self):
  self.product();self.assertEqual(self.db.execute('SELECT COUNT(*) FROM products WHERE title LIKE ?',("%'; DROP TABLE products; --%",)).fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM products').fetchone()[0],1)
 def test_catalog_conflict_rolls_back_entire_batch(self):
  self.product();self.db.commit()
  def write(revision,title):
   with self.db:
    self.db.execute("INSERT INTO catalog_write_guards VALUES ('guard',CASE WHEN (SELECT data FROM config WHERE key='catalog-revision')=? THEN 1 ELSE 0 END)",(revision,))
    self.db.execute('UPDATE products SET title=? WHERE id=?',(title,'p1'))
    self.db.execute("UPDATE config SET data='1' WHERE key='catalog-revision'")
    self.db.execute('DELETE FROM catalog_write_guards')
  write('0','Committed')
  with self.assertRaises(sqlite3.IntegrityError):write('0','Lost update')
  self.assertEqual(self.db.execute('SELECT title FROM products').fetchone()[0],'Committed');self.assertEqual(self.db.execute('SELECT COUNT(*) FROM catalog_write_guards').fetchone()[0],0)
 def test_job_claim_checkpoint_and_duplicate_protection(self):
  row=('job','openlibrary','usahana','queued','Usahana',2,0,'now','now',None,'{"checkpoint":{"page":2}}')
  self.db.execute('INSERT INTO discovery_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?)',row)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('INSERT INTO discovery_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?)',('other',*row[1:]))
  a=self.db.execute("UPDATE discovery_jobs SET status='running',attempts=attempts+1 WHERE id='job' AND status='queued'").rowcount
  b=self.db.execute("UPDATE discovery_jobs SET status='running',attempts=attempts+1 WHERE id='job' AND status='queued'").rowcount
  self.assertEqual((a,b),(1,0));self.assertEqual(json.loads(self.db.execute('SELECT data FROM discovery_jobs').fetchone()[0])['checkpoint']['page'],2)
  self.db.execute("UPDATE discovery_jobs SET status='cancelled' WHERE id='job'")
  self.db.execute('INSERT INTO discovery_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?)',('other',*row[1:]))
 def test_source_failure_preserves_prior_stock(self):
  self.product();self.db.execute('INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?,?)',('offer','p1','Fixture','https://example.com/item',1000,'USD','New','available','observed','now','{}'))
  self.db.execute("INSERT INTO source_health VALUES ('fixture',1,NULL,'HTTP503','later','{}')")
  self.assertEqual(self.db.execute('SELECT availability FROM listings').fetchone()[0],'available')
 def test_backup_restoration_preserves_personal_relationships(self):
  self.product();self.db.execute('INSERT INTO product_categories VALUES (?,?)',('p1','my-melody'));self.db.execute('INSERT INTO personal VALUES (?,?,?,?)',('private',4,'{"favorites":["p1"]}','now'));self.db.commit();clone=sqlite3.connect(':memory:');self.db.backup(clone)
  for table in ['personal','product_categories','products']:self.assertEqual(clone.execute('SELECT * FROM '+table).fetchall(),self.db.execute('SELECT * FROM '+table).fetchall())
 def test_simultaneous_ingestion_and_edit_have_one_winner(self):
  import tempfile,threading
  with tempfile.TemporaryDirectory() as folder:
   path=folder+'/db.sqlite';self.product();self.db.commit();disk=sqlite3.connect(path);self.db.backup(disk);disk.close();barrier=threading.Barrier(2);outcomes=[]
   def writer(title):
    con=sqlite3.connect(path,timeout=5);revision=con.execute("SELECT data FROM config WHERE key='catalog-revision'").fetchone()[0];barrier.wait()
    try:
     with con:
      con.execute("INSERT INTO catalog_write_guards VALUES (?,CASE WHEN (SELECT data FROM config WHERE key='catalog-revision')=? THEN 1 ELSE 0 END)",(title,revision));con.execute('UPDATE products SET title=? WHERE id=?',(title,'p1'));con.execute("UPDATE config SET data='1' WHERE key='catalog-revision'");con.execute('DELETE FROM catalog_write_guards')
     outcomes.append('saved')
    except sqlite3.IntegrityError:outcomes.append('conflict')
    finally:con.close()
   threads=[threading.Thread(target=writer,args=(title,)) for title in ['ingestion','edit']]
   for t in threads:t.start()
   for t in threads:t.join()
   self.assertEqual(sorted(outcomes),['conflict','saved'])
if __name__=='__main__':unittest.main()
