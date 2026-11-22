"""A clean starting space for new devices, from a database that has the sample courses: python web/make_seed.py <data dir>"""
import shutil, sqlite3, sys
from pathlib import Path
src, out = Path(sys.argv[1]), Path(__file__).resolve().parent / "seed"
out.mkdir(exist_ok=True)
(out / "data.db").unlink(missing_ok=True)
a, b = sqlite3.connect(src / "data.db"), sqlite3.connect(out / "data.db")
a.backup(b)
b.executescript("""
delete from prefs; delete from attempts; delete from explanations;
update objectives set alpha = 1, beta = 1, streak = 0, next_review = null;
update sections set read_at = null; update courses set opened_at = null, owner = null, heartbeat = null;
delete from uploads where rowid not in (select max(rowid) from uploads group by name);
delete from students where name not like '%(sample)'; delete from submissions where student_name not like '%(sample)'; delete from meetings where title not like '%(sample)';
update media set export_status = null, export_error = null, export_file = null;
""")
b.commit(); b.execute("vacuum"); b.execute("pragma journal_mode = delete"); b.close()
if (src / "class").is_dir():
    shutil.copytree(src / "class", out / "class", dirs_exist_ok=True)
print(sorted(str(p.relative_to(out)) for p in out.rglob("*")))
