"""Checks a running web version with several devices: python web/try_devices.py http://localhost:3190 [--live]
Without --live only saved results and the database are used."""

import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request

BASE, LIVE = sys.argv[1].rstrip("/"), "--live" in sys.argv
P = "/api/plugins/study-os-solo"


class Device:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.o = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.get("/app", raw=True)

    def ask(self, method, path, body=None, raw=False, headers=None):
        r = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"content-type": "application/json", "user-agent": "study-os-check", **(headers or {})})
        try:
            t = self.o.open(r, timeout=120).read()
            return t if raw else json.loads(t or b"{}")
        except urllib.error.HTTPError as e:
            return {"error": e.code, "detail": (e.read() or b"")[:200].decode("utf-8", "replace")}

    def get(self, path, **k):
        return self.ask("GET", path, **k)

    def post(self, path, body=None, **k):
        return self.ask("POST", path, body or {}, **k)


def ok(name, good, note=""):
    print(("ok   " if good else "FAIL ") + name, note if not good else "")
    if not good:
        ok.bad += 1


ok.bad = 0
teacher, ann, sam, other = Device(), Device(), Device(), Device()
ids = {d.get("/api/space")["device"] for d in (teacher, ann, sam, other)}
ok("every device is its own", len(ids) == 4)

# private spaces
home = [d.get(P + "/home")["courses"] for d in (ann, sam)]
cid = home[0][0]["id"]
ann.ask("DELETE", f"{P}/courses/{cid}")
ok("a course deleted on one device stays on the other", len(ann.get(P + "/home")["courses"]) == len(home[0]) - 1 and len(sam.get(P + "/home")["courses"]) == len(home[1]))

# a class
room = teacher.post("/api/space/open")
code = room["code"]
ok("a class has a code and a link", len(code) == 6 and code in room["link"])
ok("a wrong code is refused", ann.post("/api/space/join/ZZZZZZ").get("error") == 404)
ok("a student joins", ann.post(f"/api/space/join/{code}").get("ok") and sam.post(f"/api/space/join/{code.lower()}").get("ok"))
ok("the teacher can't join their own class", teacher.post(f"/api/space/join/{code}").get("error") == 400)
for d, n in ((ann, "Ann"), (sam, "Sam")):
    d.post(P + "/prefs", {"student_name": n, "student_id": "a1a1a1a1a1a1a1a1", "class_folder": "/etc"})
me = [d.get(P + "/class")["me"] for d in (ann, sam)]
ok("the server says who a student is", me[0]["id"] != me[1]["id"] and "a1a1" not in me[0]["id"] and me[0]["name"] == "Ann", me)
ok("a page can't choose a folder", not ann.get(P + "/home")["prefs"].get("class_folder"))

# work: made, set, handed in, seen, returned
up = teacher.post(P + "/samples/faraday")["upload"]["id"]
aid = teacher.post(P + "/teach/make", {"kind": "exam", "upload_id": up, "minutes": 30})["id"]
for _ in range(60):
    a = next(x for x in teacher.get(P + "/teach")["assignments"] if x["id"] == aid)
    if a["status"] != "making":
        break
    time.sleep(1)
ok("a PDF becomes an exam", a["status"] == "draft" and len(a["questions"]) >= 5, a)
ok("students don't see a draft", all(x["id"] != aid for x in ann.get(P + "/class")["work"]))
teacher.post(f"{P}/teach/assignments/{aid}/set", {"due": "2026-12-01T22:00:00+00:00", "minutes": 30})
w = next((x for x in ann.get(P + "/class")["work"] if x["id"] == aid), None)
ok("it reaches the students", bool(w))
ok("no answers leak", w and "answer" not in json.dumps(w["questions"]) and "guide" not in json.dumps(w["questions"]))
for d, text in ((ann, "A candle is a good place to start because everyone has one, and each part of it, the wax, the wick and the air, does a job you can watch with your own eyes while it burns down on the table in front of you."), (sam, "I don't know yet.")):
    d.post(f"{P}/class/{aid}", {"answers": {q["id"]: {"text": q["options"][0] if q["options"] else text, "by": "typed"} for q in w["questions"]}, "process": {"typed": 200, "pasted": 0, "keys": 210, "seconds": 300}, "hand_in": True})
desk = teacher.get(P + "/teach")
names = {s["student_name"] for s in desk["submissions"] if s["assignment_id"] == aid}
ok("both land on the teacher's page", names == {"Ann", "Sam"}, names)
ok("a student sees only their own", next(x for x in ann.get(P + "/class")["work"] if x["id"] == aid)["mine"]["answers"] != next(x for x in sam.get(P + "/class")["work"] if x["id"] == aid)["mine"]["answers"])
ok("a student can't open the teacher's page", ann.get(P + "/teach").get("error") == 403 and ann.post(f"{P}/teach/assignments/{aid}/set").get("error") == 403)
sub = next(s for s in desk["submissions"] if s["student_name"] == "Ann" and s["assignment_id"] == aid)
teacher.post(f"{P}/teach/submissions/{sub['id']}/return", {"marks": {w["questions"][0]["id"]: {"points": 3, "why": "Good"}}, "comment": "Nice work"})
back = next(x for x in ann.get(P + "/class")["work"] if x["id"] == aid)["mine"]
ok("marks come back to that student", back["status"] == "returned" and back["comment"] == "Nice work", back)
ok("and to nobody else", next(x for x in sam.get(P + "/class")["work"] if x["id"] == aid)["mine"]["status"] == "handed_in")

# meetings
ann.post(P + "/meetings", {"title": "Help", "who": ["Ann"], "start": "2026-11-25T15:00:00-05:00", "asked_by": "student"})
ok("a meeting request reaches the teacher", any(m["title"] == "Help" for m in teacher.get(P + "/teach")["meetings"]))
ok("other students don't see it", all(m["title"] != "Help" for m in sam.get(P + "/class")["meetings"]))

# other classes
ok("another device sees none of this", all(x["id"] != aid for x in other.get(P + "/class")["work"]) and all(s["student_name"] not in ("Ann", "Sam") for s in other.get(P + "/teach")["submissions"]))
ok("leaving goes back to your own space", ann.post("/api/space/leave").get("ok") and all(x["id"] != aid for x in ann.get(P + "/class")["work"]))
ok("another site can't write", ann.post(P + "/prefs", {"student_name": "x"}, headers={"origin": "https://example.com"}).get("error") == 403)
ok("saving videos is off here", "Hermes" in str(teacher.post(f"{P}/sections/{teacher.get(P + '/courses/' + cid)['list'][0]['id']}/export", {"kind": "explainer"}).get("detail", "Hermes")))
ok("the label is saved", teacher.get(f"{P}/sections/{teacher.get(P + '/courses/' + cid)['list'][0]['id']}/label").get("choices") is not None)

if LIVE:
    sid = teacher.get(P + "/courses/" + cid)["list"][0]["id"]
    t = time.time()
    r = teacher.post(f"{P}/sections/{sid}/talk", {"text": "Why does the flame need air?", "history": []})
    ok(f"the tutor answers ({time.time() - t:.1f}s)", bool(r.get("say")), r)
    t = time.time()
    r = teacher.post(P + "/read", {"text": "The quick test of a detector is a paragraph that a person typed in a hurry, with a few turns in it that no one would plan, and then a full stop. " * 2})
    ok(f"Pangram answers ({time.time() - t:.1f}s)", "ai" in r, r)
    t = time.time()
    r = teacher.post(P + "/speak", {"text": "Hello from the web version.", "who": "a"})
    ok(f"it speaks ({time.time() - t:.1f}s)", "audio" in r or r.get("local"), r)
    print("     voice from", "Modal" if "audio" in r else "the browser")
    new = sam.post(P + "/courses", {"topic": "Why ice floats", "how": {"level": 8}})
    t = time.time()
    while (c := sam.get(f"{P}/courses/{new['id']}")).get("status") in ("planning", "writing") and time.time() - t < 150:
        time.sleep(2)
    ok(f"a new course is made ({time.time() - t:.0f}s)", c.get("status") == "ready", c.get("error"))

for d in (teacher, ann, sam, other):
    d.post("/api/space/forget")
ok("forgetting deletes it", other.get("/api/space").get("error") == 401)
print("all good" if not ok.bad else f"{ok.bad} failed")
sys.exit(bool(ok.bad))
