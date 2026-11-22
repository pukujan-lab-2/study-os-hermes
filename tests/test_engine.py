"""Runs the whole engine on a throwaway database with a pretend model: python -m unittest discover -s tests"""

import io
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine import classroom, courses, essay, film, ingest, llm, mastery, media, quiz, services, store, tutor, voice  # noqa: E402

QUIZ = {
    "objectives": [
        {
            "label": f"Explain idea {n}",
            "questions": [
                {"kind": "choice", "difficulty": d, "prompt": f"Q{n} {d}?", "answer": "right", "hint": "think", "explanation": "because", "options": [{"text": "right", "correct": True, "why": "yes"}, {"text": "wrong one", "correct": False, "why": "mix-up"}, {"text": "other", "correct": False, "why": "no"}]}
                for d in ("recall", "understand")
            ]
            + [{"kind": "blank", "difficulty": "apply", "prompt": f"Idea {n} is ___.", "options": [], "answer": "osmosis", "hint": "o", "explanation": "e"}],
        }
        for n in (1, 2)
    ],
    "terms": [{"term": "Osmosis", "definition": "Water moving."}],
    "visual": {"kind": "flow", "title": "Steps", "items": [{"label": "One"}, {"label": "Two", "points": ["a"]}]},
}


def make_wav(seconds):
    import wave

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"\0\0" * int(8000 * seconds))
    return buf.getvalue()


class FakeModel:
    def __init__(self):
        self.calls, self.fail_lesson, self.bodies = [], 0, 0

    def complete(self, messages, **k):
        self.calls.append(("text", messages[-1]["content"]))
        if self.fail_lesson:
            self.fail_lesson -= 1
            raise RuntimeError("429 rate limit")
        if "whiteboard" in messages[0]["content"]:
            return SimpleNamespace(text="title: Cell\ncircle 100 100 9999 blue fill\narrow 1 1 50 50 red\ntext 5 5 30 ink Cell wall\npath ink M0 0 <script>\npath green fill M 1 1 L 20 20 Z\nblob 1 2")
        self.bodies += 1
        return SimpleNamespace(text=f"# Title\n\n### Why\n\nBody {self.bodies}.\n\n> **Compare it to cooking:** like soup.\n\n### Then\n\nMore.")

    def complete_structured(self, *, instructions, input, json_schema, **k):
        self.calls.append(("data", instructions[:40]))
        req = json_schema["required"]
        if "sections" in req:
            parts = input[0]["text"].count("<part number")
            out = {"title": "Osmosis", "subject": "Biology", "summary": "Explain it.", "sections": [{"number": i + 1, "title": f"Part {i + 1}", "goal": "Explain", "skip": parts > 2 and i == 0} for i in range(parts or 3)]}
        elif "objectives" in req:
            out = QUIZ
        elif "turns" in req:
            out = {"title": "Talk", "turns": [{"who": "a", "text": "Why does water move?"}, {"who": "b", "text": "Gravity?"}, {"who": "a", "text": "Not here."}]}
        elif "scenes" in req:
            out = {"title": "Film <b>", "scenes": [{"kind": "title", "heading": "Osmosis & you", "say": "Water moves.", "items": [{"label": "A short film"}]}, {"kind": "steps", "heading": "How", "say": "First this then that.", "items": [{"label": "One", "note": "a"}, {"label": "Two"}]}, {"kind": "compare", "heading": "Empty one", "say": "Nothing to compare here."}, {"kind": "question", "heading": "Why?", "say": "Think about it."}]}
        elif req == ["say"]:
            out = {"say": "What do you think moves?", "quiz": False, "draw": "a cell"}
        elif "instructions" in req:
            out = {"title": "Mock exam", "instructions": "Take your time.", "questions": [{"kind": "choice", "prompt": "Pick", "options": ["a", "b", "c"], "answer": "b", "points": 2, "guide": ""}, {"kind": "choice", "prompt": "Broken", "options": ["a", "b", "c"], "answer": "z", "points": 2, "guide": ""}, {"kind": "essay", "prompt": "Explain", "points": 10, "guide": "water"}]}
        elif req == ["marks"]:
            out = {"marks": [{"number": 2, "points": 1, "why": "ok"}, {"number": 3, "points": 99, "why": "great"}]}
        elif "strong" in req:
            out = {"summary": "s", "strong": ["a"], "improve": [{"where": "w", "why": "y"}], "questions": ["q"]}
        else:
            out = {"goals": [{"number": 1, "score": 0.9}, {"number": 2, "score": 0}], "got": ["the idea"], "missing": ["why"], "next_question": "Why?"}
        return SimpleNamespace(parsed=None, text="Sure!\n```json\n" + json.dumps(out) + "\n```")


class Case(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        os.environ["STUDYOS_SOLO_DB"] = os.path.join(self.dir.name, "t.db")
        os.environ["STUDYOS_SOLO_DATA"] = self.dir.name
        self._computer = voice.computer
        voice.computer = lambda text, who: make_wav(len(text.split()) / 2.5)
        for k in ("REDUCTO_API_KEY", "PANGRAM_API_KEY", "MODAL_SPEECH_TOKEN"):
            os.environ.pop(k, None)
        self.model = FakeModel()
        llm.use(self.model)

    def tearDown(self):
        voice.computer = self._computer
        time.sleep(0.05)
        self.dir.cleanup()

    def wait(self, cid, until=lambda c: c["status"] in ("ready", "failed"), seconds=8):
        end = time.time() + seconds
        while time.time() < end:
            c = courses.get(cid)
            if until(c):
                return c
            time.sleep(0.02)
        self.fail(f"still {c['status']}")

    def made(self, **k):
        return self.wait(courses.create(topic="osmosis", **k))


class Building(Case):
    def test_a_topic_becomes_a_course_with_lessons_and_quizzes(self):
        c = self.made()
        self.assertEqual((c["title"], c["status"], len(c["list"])), ("Osmosis", "ready", 3))
        s = c["list"][0]
        self.assertTrue(s["body"].startswith("### Why"))
        self.assertNotIn("Compare it to", s["body"])  # nobody asked for one
        self.assertEqual(len(s["goals"]), 2)
        self.assertEqual(s["visual"]["kind"], "flow")

    def test_material_is_split_taught_in_order_and_its_front_matter_skipped(self):
        text = "\n\n".join(f"# Part {i}\n\n" + ("Cells take in water. " * 220) for i in range(4))
        cid = courses.create(material=text, name="cells.pdf")
        c = self.wait(cid)
        self.assertEqual(c["source_name"], "cells.pdf")
        self.assertEqual(len(c["list"]), 3)
        self.assertTrue(all(s["from_material"] for s in c["list"]))
        self.assertTrue(any("<source>" in t for k, t in self.model.calls if k == "text"))

    def test_too_little_to_go_on_is_refused(self):
        with self.assertRaises(courses.Problem):
            courses.create(material="short")

    def test_a_failed_section_leaves_the_rest_and_a_retry_finishes_it(self):
        self.model.fail_lesson = 2  # one lesson, both tries
        c = self.made()
        self.assertEqual(c["status"], "ready")
        self.assertEqual(sum(s["status"] == "failed" for s in c["list"]), 1)
        self.assertIn("rate limited", next(s["error"] for s in c["list"] if s["error"]))
        courses.retry(c["id"])
        c = self.wait(c["id"], lambda c: all(s["status"] == "ready" for s in c["list"]) and c["status"] == "ready")
        self.assertIsNone(c["error"])

    def test_a_build_left_by_a_closed_app_is_picked_up_and_a_live_one_is_not(self):
        c = self.made()
        store.run("update sections set status = 'writing', body = null where id = ?", c["list"][0]["id"])
        store.run("update courses set status = 'writing', owner = 'gone', heartbeat = ? where id = ?", store.now(), c["id"])
        self.assertFalse(courses.start(c["id"]))
        old = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(timespec="seconds")
        store.run("update courses set heartbeat = ? where id = ?", old, c["id"])
        self.wait(c["id"])
        self.assertEqual(len(courses.get(c["id"])["list"][0]["goals"]), 2)  # its quiz wasn't written twice


class Asking(Case):
    def test_a_miss_gets_one_more_try_then_counts_and_comes_back_soon(self):
        c = self.made()
        q = quiz.next_question(course_id=c["id"])
        self.assertNotIn("correct", json.dumps(q))
        opts = store.loads(store.row("select options from questions where id = ?", q["id"])["options"], [])
        wrong = next(i for i, o in enumerate(opts) if not o["correct"])
        r = quiz.answer(q["id"], option=wrong)
        self.assertFalse(r["final"])
        self.assertIn(r["why"], ("mix-up", "no"))
        r = quiz.answer(q["id"], option=wrong, tries=2)
        self.assertTrue(r["final"])
        self.assertEqual(r["mastery_after"], 0)  # a miss never looks like progress
        self.assertLess(r["next_review"], (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat())

    def test_right_answers_raise_mastery_and_every_question_is_asked_once(self):
        c = self.made()
        asked, sid = [], c["list"][0]["id"]
        while q := quiz.next_question(section_id=sid, asked=asked):
            asked.append(q["id"])
            row = store.row("select options, answer from questions where id = ?", q["id"])
            opts = store.loads(row["options"], [])
            r = quiz.answer(q["id"], option=next((i for i, o in enumerate(opts) if o["correct"]), None), text="Osmosis!")
            self.assertTrue(r["correct"])
        self.assertEqual(len(asked), 6)
        self.assertEqual(courses.get(c["id"])["mastered"], 2)  # clean answers at every difficulty
        self.assertEqual(quiz.streak()["days"], 1)

    def test_only_due_goals_come_up_for_review(self):
        c = self.made()
        self.assertIsNone(quiz.next_question(due_only=True))
        o = store.row("select id from objectives where course_id = ?", c["id"])
        store.run("update objectives set next_review = ? where id = ?", "2000-01-01T00:00:00+00:00", o["id"])
        self.assertEqual(quiz.progress()["due"], 1)
        self.assertIsNotNone(quiz.next_question(due_only=True))

    def test_fill_ins_forgive_slips_not_wrong_words(self):
        for said in ("osmosis", " Osmosis. ", "the osmosis", "osmossis"):
            self.assertTrue(quiz.blank_right("osmosis", said), said)
        for said in ("diffusion", "", "o"):
            self.assertFalse(quiz.blank_right("osmosis", said), said)

    def test_questions_that_cannot_be_marked_fairly_are_dropped(self):
        two = [{"text": "a", "correct": True}, {"text": "b", "correct": True}, {"text": "c", "correct": False}]
        self.assertIsNone(courses.clean_question({"kind": "choice", "prompt": "?", "options": two}))
        self.assertIsNone(courses.clean_question({"kind": "blank", "prompt": "no gap", "answer": "x"}))

    def test_explaining_back_moves_only_the_goals_it_shows(self):
        c = self.made()
        s = c["list"][0]
        r = quiz.explain_back(s["id"], "Water moves through a thin skin to where there is more salt in it.", lambda t: {"label": "Human", "ai": 0, "assisted": 0, "human": 1})
        self.assertEqual(r["authorship"]["label"], "Human")
        g = courses.get(c["id"])["list"][0]["goals"]
        self.assertEqual([x["started"] for x in g], [True, False])

        def down(_t):
            raise services.ServiceError("no")

        self.assertEqual(quiz.explain_back(s["id"], "Water moves through a thin skin to where there is more salt.", down)["authorship"], None)
        with self.assertRaises(courses.Problem):
            quiz.explain_back(s["id"], "too short")


class Rewording(Case):
    def test_preview_use_and_switch_back(self):
        c = self.made()
        s = c["list"][0]
        courses.preview(s["id"], {"level": 8, "compare_to": "cooking", "ask": "simpler"})
        end = time.time() + 5
        while not (w := courses.wordings(s["id"]))["draft"] and time.time() < end:
            time.sleep(0.02)
        self.assertEqual(w["draft"]["body"].count("Compare it to cooking"), 1)
        self.assertEqual(courses.get(c["id"])["list"][0]["body"], s["body"])  # nothing changes until it's used
        courses.use_version(s["id"])
        now = courses.get(c["id"])["list"][0]
        self.assertEqual((now["how"]["level"], now["goals"]), (8, s["goals"]))
        e = courses.wordings(s["id"])["earlier"]
        courses.use_version(s["id"], e[0]["id"])
        self.assertEqual(courses.get(c["id"])["list"][0]["body"], s["body"])


class Mastery(unittest.TestCase):
    def test_ladder(self):
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        st = {"alpha": 1, "beta": 1, "streak": 0}
        gaps = []
        for _ in range(4):
            st = mastery.apply_answer(st, score=1, difficulty="apply", now=now)
            gaps.append((datetime.fromisoformat(st["next_review"]) - now).days)
        self.assertEqual(gaps, [1, 3, 7, 16])
        self.assertTrue(mastery.is_mastered(st["alpha"], st["beta"]))
        self.assertEqual(mastery.apply_answer(st, score=0, now=now)["streak"], 0)


class Services(Case):
    """Reducto, Pangram and Modal, against a local server that answers in their shapes."""

    def setUp(self):
        super().setUp()
        seen = self.seen = []

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def send(self, body, ctype="application/json", **h):
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                for k, v in h.items():
                    self.send_header(k.replace("_", "-"), v)
                self.end_headers()
                self.wfile.write(body if isinstance(body, bytes) else json.dumps(body).encode())

            def do_GET(self):
                seen.append((self.path, dict(self.headers)))
                if self.path == "/big":
                    return self.send({"chunks": [{"content": "Cells and water. " * 40}]})
                self.send({"stage": "STAGE_SUCCESS", "prediction_short": "AI", "fraction_ai": 0.9, "fraction_ai_assisted": 0.1, "fraction_human": 0})

            def do_POST(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                seen.append((self.path, dict(self.headers)))
                if self.path == "/redirect":
                    self.send_response(302)
                    self.send_header("Location", "http://127.0.0.1:1/steal")
                    self.end_headers()
                elif self.path == "/upload":
                    self.send({"file_id": "reducto://1"} if b"%PDF-" in body else {})
                elif self.path == "/parse":
                    self.send({"job_id": "j", "result": {"type": "url", "url": f"http://127.0.0.1:{self.server.server_port}/big"}})
                elif self.path == "/task":
                    self.send({"task_id": "t1", "stage": "STAGE_PENDING"})
                elif self.path == "/tts":
                    self.send(b"\x00\x01" * 2400, "audio/pcm", X_Sample_Rate="24000")

        self.http = HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.http.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{self.http.server_port}"
        os.environ.update(REDUCTO_API_KEY="rk", PANGRAM_API_KEY="pk", MODAL_SPEECH_TOKEN="mt", STUDYOS_SOLO_REDUCTO_URL=url, STUDYOS_SOLO_PANGRAM_URL=url, STUDYOS_SOLO_MODAL_URL=url)

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        for k in ("REDUCTO_API_KEY", "PANGRAM_API_KEY", "MODAL_SPEECH_TOKEN", "STUDYOS_SOLO_REDUCTO_URL", "STUDYOS_SOLO_PANGRAM_URL", "STUDYOS_SOLO_MODAL_URL"):
            os.environ.pop(k, None)
        super().tearDown()

    def test_reducto_reads_a_pdf_and_its_key_goes_nowhere_else(self):
        text, by = ingest.read("notes.pdf", b"%PDF-1.7 fake")
        self.assertEqual(by, "Reducto")
        self.assertIn("Cells and water", text)
        by_path = dict(self.seen)
        self.assertEqual(by_path["/parse"]["Authorization"], "Bearer rk")
        self.assertNotIn("Authorization", by_path["/big"])

    def test_pangram_waits_for_its_verdict(self):
        self.assertEqual(services.pangram("some words"), {"label": "AI", "ai": 0.9, "assisted": 0.1, "human": 0.0, "parts": []})
        self.assertEqual({k.lower(): v for k, v in self.seen[0][1].items()}["x-api-key"], "pk")

    def test_modal_sound_becomes_a_wav(self):
        import base64
        import wave

        a = voice.speak("Hello")
        with wave.open(io.BytesIO(base64.b64decode(a["audio"]))) as w:
            self.assertEqual((w.getframerate(), w.getnframes()), (24000, 2400))

    def test_without_keys_everything_stays_here(self):
        os.environ.pop("MODAL_SPEECH_TOKEN")
        os.environ.pop("REDUCTO_API_KEY")
        voice.computer = lambda *_: None
        self.assertEqual(voice.speak("Hello there"), {"local": True})
        with self.assertRaises(courses.Problem):
            ingest.read("notes.pdf", b"%PDF-1.7 fake")
        self.assertEqual(self.seen, [])

    def test_a_key_is_never_sent_in_the_clear_or_after_a_redirect(self):
        with self.assertRaises(services.ServiceError):
            services._safe("http://example.com")
        with self.assertRaises(services.ServiceError):
            services._http("POST", f"http://127.0.0.1:{self.http.server_port}/redirect", headers={"Authorization": "Bearer rk"}, body=b"x")


class Media(Case):
    def ready(self, sid, kind):
        media.make(sid, kind)
        end = time.time() + 5
        while time.time() < end:
            m = next(x for x in media.listing(sid) if x["kind"] == kind)
            if m["status"] != "making":
                return m
            time.sleep(0.02)
        self.fail("still making")

    def test_a_podcast_has_two_voices_and_knows_when_the_words_changed(self):
        s = self.made()["list"][0]
        m = self.ready(s["id"], "podcast")
        self.assertEqual([t["who"] for t in m["data"]["turns"]], ["a", "b", "a"])
        self.assertFalse(m["stale"])
        store.run("update sections set body = 'new words' where id = ?", s["id"])
        self.assertTrue(media.listing(s["id"])[0]["stale"])
        self.assertEqual({t["who"] for t in self.ready(s["id"], "recap")["data"]["turns"]}, {"a"})

    def test_a_film_is_one_safe_page_whose_scenes_fill_its_length(self):
        s = self.made()["list"][0]
        for kind, size in (("explainer", "1920"), ("short", "1080"), ("slides", "1920")):
            self.assertEqual(self.ready(s["id"], kind)["status"], "ready")
            f = media.film_html(s["id"], kind)
            self.assertIn(f'data-width="{size}"', f["html"])
            self.assertIn('data-composition-id="main"', f["html"])
            self.assertNotIn("<b>Film", f["html"])
            self.assertIn("Film &lt;b&gt;", f["html"])
            self.assertNotIn("http", f["html"].replace("http-equiv", ""))
            self.assertAlmostEqual(f["duration"], sum(x["duration"] for x in f["scenes"]), places=1)
            self.assertEqual("cap clip" in f["html"], kind != "slides")
        self.assertEqual([x["kind"] for x in media.clean_scenes([{"kind": "compare", "heading": "Nothing here at all", "say": "x"}], "short")], ["title"])

    def test_a_video_exports_as_a_project_with_its_narration(self):
        s = self.made()["list"][0]
        self.ready(s["id"], "short")
        d = media.project(s["id"], "short")
        page = (d / "index.html").read_text()
        self.assertEqual(page.count("<audio"), 4)
        self.assertTrue((d / "voice" / "0.wav").exists())
        self.assertNotIn("REDUCTO_API_KEY", media._env())

    def test_the_ear_quiz_reads_the_right_answer(self):
        s = self.made()["list"][0]
        for x in media.ear_quiz(s["id"])["items"]:
            self.assertIn("The answer is", x["answer"])
            self.assertTrue("right" in x["answer"] or "osmosis" in x["answer"])

    def test_talking(self):
        s = self.made()["list"][0]
        t = tutor.turn(s["id"], "", [])
        self.assertEqual((t["say"], t["draw"]), ("What do you think moves?", "a cell"))
        k = tutor.sketch(s["id"], t["draw"])["marks"]
        self.assertEqual([m["kind"] for m in k], ["circle", "arrow", "text", "path"])  # the script path and the bad ones are gone
        self.assertEqual(k[0]["r"], 280)
        self.assertTrue(llm.strict(media.FILM_SCHEMA)["properties"]["scenes"]["items"]["additionalProperties"] is False)
        with self.assertRaises(services.ServiceError):
            voice.hear(b"not a wav")

    def test_an_essay_gets_feedback_and_a_shuffled_pair(self):
        text = "Water moves through the thin skin of a cell. " * 10
        r = essay.check(text, "Explain osmosis")
        self.assertIsNone(r["authorship"])
        self.assertIn("Pangram key", r["note"])
        sides = essay.ab(text, "Explain osmosis")["sides"]
        self.assertEqual(sorted(x["mine"] for x in sides), [False, True])
        with self.assertRaises(courses.Problem):
            essay.check("too short", "")

    def test_a_model_the_plan_does_not_include_is_named(self):
        self.assertIn("nous/welcome", llm._explain(Exception("Error code: 429 - {'message': \"This model isn't available on the free tier.\", 'reason': 'model_not_free', 'alternates': ['nous/welcome']}")))


class Classroom(Case):
    def test_from_a_document_to_marked_work_without_leaking_answers(self):
        aid = classroom.make(kind="exam", name="cells.pdf", text="Cells take in water. " * 30, read_by="Reducto", due="2026-11-30T17:00", minutes=30)
        end = time.time() + 5
        while (a := classroom.desk()["assignments"][0])["status"] == "making" and time.time() < end:
            time.sleep(0.02)
        self.assertEqual([q["kind"] for q in a["questions"]], ["choice", "short", "essay"])
        self.assertEqual(classroom.work()["work"], [])  # students don't see drafts
        classroom.publish(aid, None, None)
        page = (classroom.folder() / "set" / f"{aid}.studyos.json").read_text()
        self.assertNotIn("guide", page)
        self.assertNotIn('"answer"', page)
        with self.assertRaises(courses.Problem):
            classroom.save(aid, {}, {}, False)
        store.set_prefs({"student_id": "s1", "student_name": "Maya", "student_email": "maya@example.com"})
        q = classroom.work()["work"][0]["questions"]
        self.assertNotIn("guide", q[0])
        ans = {q[0]["id"]: {"text": "b"}, q[2]["id"]: {"text": "Water goes in. " * 30, "by": "photo"}}
        classroom.save(aid, ans, {"typed": 10, "pasted": 400, "line": [1, 2], "evil": "x"}, True)
        classroom.save(aid, {}, {}, False)  # nothing changes once it's handed in
        d = classroom.desk()
        while d["submissions"][0]["check_status"] != "done" and time.time() < end + 5:
            time.sleep(0.02)
            d = classroom.desk()
        s = d["submissions"][0]
        self.assertEqual((s["student_name"], s["process"]["pasted"], "evil" in s["process"]), ("Maya", 400, False))
        self.assertEqual([s["marks"][x["id"]]["points"] for x in q], [2, 1, 10])
        self.assertEqual(classroom.work()["work"][0]["mine"]["marks"], {})  # not before it's returned
        classroom.give_back(s["id"], s["marks"], "Nice")
        self.assertEqual(classroom.work()["work"][0]["mine"]["comment"], "Nice")

    def test_work_crosses_computers_through_a_folder(self):
        aid = classroom.make(kind="assignment", name="x", text="Cells take in water. " * 30, read_by="pasted", due=None, minutes=None)
        end = time.time() + 5
        while classroom.desk()["assignments"][0]["status"] == "making" and time.time() < end:
            time.sleep(0.02)
        classroom.publish(aid, None, None)
        shared = str(classroom.folder())
        os.environ["STUDYOS_SOLO_DB"] = os.path.join(self.dir.name, "student.db")
        store.set_prefs({"student_id": "s2", "student_name": "Leo", "class_folder": shared})
        self.assertEqual(classroom.work()["work"][0]["title"], "Mock exam")
        classroom.save(aid, {classroom.work()["work"][0]["questions"][0]["id"]: {"text": "a"}}, {}, True)
        os.environ["STUDYOS_SOLO_DB"] = os.path.join(self.dir.name, "t.db")
        (Path(shared) / "handed-in" / "bad.studyos.json").write_text("{")
        self.assertEqual([s["student_name"] for s in classroom.desk()["submissions"]], ["Leo"])

    def test_meetings_open_google_calendar_filled_in(self):
        mid = classroom.meet("Office hours", ["maya@example.com", "Leo"], "2026-11-24T15:00:00-05:00", 30, "Bring questions", "student", False)
        link = classroom.calendar_link(mid)
        self.assertIn("20261124T200000Z/20261124T203000Z", link)
        self.assertIn("maya%40example.com", link)
        self.assertNotIn("Leo", link)
        with self.assertRaises(courses.Problem):
            classroom.meet("x", [], "soon", 30, "", "student", False)
        self.assertTrue(classroom.mail_link(["a@b.c"], "Hi", "there & you").endswith("body=there%20%26%20you"))


class Tools(Case):
    def setUp(self):
        super().setUp()
        import importlib
        import types

        root = Path(__file__).resolve().parent.parent
        pkg = types.ModuleType("solo")
        pkg.__path__ = [str(root)]
        sys.modules["solo"] = pkg
        for n in ("engine", "engine.store", "engine.courses", "engine.quiz", "engine.llm", "engine.ingest", "engine.services", "engine.media", "engine.tutor", "engine.voice", "engine.essay", "engine.film", "engine.classroom"):
            sys.modules[f"solo.{n}"] = sys.modules[n]
        self.tools = importlib.import_module("solo.study_tools")

    def test_a_course_can_be_named_and_a_wrong_name_lists_them(self):
        c = self.made()
        q = json.loads(self.tools.question({"course_id": "OSMOSIS"}))
        self.assertEqual(q["course_id"], c["id"])
        self.assertIn("Osmosis", json.loads(self.tools.question({"course_id": "physics"}))["error"])
        self.assertEqual(json.loads(self.tools.lesson({"course_id": c["id"], "section": 9}))["error"], "That course has 3 sections.")
        self.assertIn("error", json.loads(self.tools.answer({"question_id": "nope"})))


class Files(Case):
    def test_word_documents_and_text(self):
        buf = io.BytesIO()
        ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("word/document.xml", f'<w:document xmlns:w="{ns}"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Cells</w:t></w:r></w:p><w:p><w:r><w:t>Water moves.</w:t></w:r></w:p></w:body></w:document>')
        self.assertEqual(ingest.read("a.docx", buf.getvalue())[0], "## Cells\n\nWater moves.")
        self.assertEqual(ingest.read("a.md", b"hello")[0], "hello")
        with self.assertRaises(courses.Problem):
            ingest.read("a.bin", b"\x00\x01\x02")


if __name__ == "__main__":
    unittest.main()
