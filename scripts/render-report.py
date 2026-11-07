"""Small deterministic renderer for the authored completion report (no external package)."""
from pathlib import Path
import html,re
root=Path(__file__).resolve().parents[1]
lines=(root/'docs/STAGE_1_REPORT.md').read_text().splitlines()
parts=[];table=False;bullets=False
for line in lines:
 if line.startswith('|'):
  if bullets:parts.append('</ul>');bullets=False
  if not table:parts.append('<div class="table"><table>');table=True
  cols=[s.strip() for s in line.strip('|').split('|')]
  if all(re.match(r'^[- :]+$',c) for c in cols):continue
  parts.append('<tr>'+''.join('<td>'+html.escape(c)+'</td>' for c in cols)+'</tr>');continue
 if table:parts.append('</table></div>');table=False
 if line.startswith('- '):
  if not bullets:parts.append('<ul>');bullets=True
  parts.append('<li>'+html.escape(line[2:])+'</li>');continue
 if bullets:parts.append('</ul>');bullets=False
 if not line.strip():continue
 if line.startswith('# '):parts.append('<h1>'+html.escape(line[2:])+'</h1>')
 elif line.startswith('## '):parts.append('<h2>'+html.escape(line[3:])+'</h2>')
 else:
  escaped=html.escape(line)
  escaped=re.sub(r'(https://[^ <]+)',r'<a href="\1">\1</a>',escaped)
  parts.append('<p>'+escaped+'</p>')
if table:parts.append('</table></div>')
if bullets:parts.append('</ul>')
style='body{margin:0;background:#fcfaf8;color:#493a40;font:15px/1.8 Arial,sans-serif}main{max-width:1000px;margin:auto;padding:45px 24px}a{color:#a94e70}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.2}h1{font-size:45px;max-width:750px}h2{font-size:30px;margin:42px 0 18px}p,li{color:#6f5e66}.table{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}td{padding:12px 14px;border:1px solid #e8dae1;min-width:100px}tr:first-child{background:#f7e5ec;font-weight:bold}li{margin-bottom:8px}header{border-bottom:1px solid #e8dae1;background:white;padding:17px 25px}header a{text-decoration:none}footer{margin-top:40px;padding-top:20px;border-top:1px solid #e8dae1;font-size:12px}@media(max-width:600px){h1{font-size:35px}h2{font-size:27px}body{font-size:14px}main{padding-top:25px}}'
(root/'public/stage-1-report.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sweetheart Finds — Stage 1 report</title><style>'+style+'</style></head><body><header><a href="/">♡ Sweetheart Finds · Return to Discover</a></header><main>'+''.join(parts)+'<footer>Authoritative source: docs/STAGE_1_REPORT.md · Stage 1 v1.0.0</footer></main></body></html>')
