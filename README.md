# Study OS Solo for Hermes

Learn anything inside [Hermes](https://github.com/NousResearch/hermes-agent), on your own computer. Give it a topic, a PDF or your notes and it makes a short course: plain lessons, quizzes that fit what you know, reviews at the right time, and a place to explain things back in your own words.

**No account, no server.** Your courses and progress are one SQLite file in your Hermes folder. Lessons are written by whatever model you use in Hermes, so there is no extra AI key.

## Install

```bash
hermes plugins install pukujan-lab-2/study-os-hermes --enable
```

**Let your Hermes do it:** tell it *"Install the plugin pukujan-lab-2/study-os-hermes and set it up for me."* It comes with a `setup` skill that walks through the rest.

Then, in Hermes Desktop, open **Capabilities → Plugins**, choose **Rescan**, and turn on **Study OS Solo**. **Study OS** and **Study OS Teacher** appear in the sidebar. In chat, just ask: "Make me a course on how vaccines work", "Quiz me on what's due", "Teach me section 2".

## What it does

- **Make a course** from a topic, a PDF, a Word document, or pasted text. It's written in the background and picks up where it stopped if you close Hermes.
- **Showcase.** Drop one page and watch it become a course and a film: Reducto reads it, Pangram says who wrote it, your model teaches it.
- **Show the seams.** Every lesson has a label: who wrote it, who wrote its source, which line of the source each part came from (matched word for word by code, or it isn't shown), the choices made and what they were made instead of. Lessons with stock phrases are sent back once before you read them.
- **Play** a small game made for the section, where you work the idea with your hands.
- **Plain lessons.** Ideas are explained in their own subject with everyday things. A comparison to something you know well is optional, short, and folds away.
- **Change how it's explained.** Simpler, slower, another level or style. Preview it, use it, switch back. Your progress stays.
- **Quizzes** pick what you know least, say why a wrong answer is tempting, give one more try, and move your mastery of each goal.
- **Review** brings each goal back after 1, 3, 7, 16, 35 and 75 days, sooner when you miss it.
- **Explain it back** and see what you got, what's missing, and a question to try next.
- **Check the source.** Drop a PDF or paste an article and see who wrote it, part by part, before you learn from it (Pangram).
- **Class.** On the teacher's page, a document becomes an assignment or a mock exam with a deadline. Students work in the app, or hand in a photo of handwriting (Reducto reads it). The teacher sees a calendar, one row per student, suggested marks, and three signals: how it reads, whether it was typed, pasted or handwritten, and how long it took. Students are told all of this. They are signals to start a conversation, never proof.
- **Meetings.** Students ask, teachers book, for one student or a group. Google Calendar and Gmail open already filled in; no Google sign-in is stored.
- **What you know**: every goal, searchable, with what's known, being learned, and due. A streak keeps count.
- **Watch** each section as an explainer, a vertical Short, or slides with notes. Every video is a [HyperFrames](https://hyperframes.heygen.com) composition: it plays live in Hermes, saves as a project, and renders to MP4 (with Node 22 and FFmpeg installed).
- **Listen** to a two-host podcast, a one-minute recap, a quiz in your ear, or the lesson itself.
- **Talk** it through out loud. A tutor that asks instead of lecturing, draws on a whiteboard when it helps, hands you a quiz question when you're ready, and stops when you talk over it. You can type instead.
- **Essay check** for a draft: feedback that never rewrites it, how it reads (Pangram), and a blind A/B test against what a model would write. A detector can be wrong both ways; use it to start a conversation, never to decide one.

## Optional services, with your own keys

Add these under **Settings → Plugins → Study OS Solo**. Each key is stored by Hermes and only ever sent to its own service.

| Service | What it adds | Without it |
|---|---|---|
| [Reducto](https://reducto.ai) | Reads PDFs, scans and photos of handwriting | PDFs with text are read on your computer |
| [Pangram](https://www.pangram.com) | Says whether a source, an explanation or an essay reads as AI-written: a signal, never proof | That check is off |
| [Modal](https://modal.com) | A natural voice and live listening on your own account: `modal deploy voice/modal_speech.py` | Your computer's own voice; listening uses Hermes' speech-to-text |

## What leaves your computer

- The text a lesson, quiz or grade needs goes to the model you chose in Hermes. Choose a local model and it stays here.
- A PDF or photo goes to Reducto; a source, explanation, essay or handed-in answer to Pangram; and lesson text and what you say out loud to Modal, only if you added that service.
- Nothing else. There is no analytics and no Study OS server.

Lessons made from a topic are written from what your model knows, with no sources. Check anything important.

## Try it in a browser, or host it

[hackathon.design-bakery.com](https://hackathon.design-bakery.com) runs the same engine and page with no sign-in. Each device gets its own database, known by a random cookie; a teacher opens a class with a code or QR and students join from their own devices. Spaces are deleted after three quiet days, and each device has a daily limit. To host your own, see `web/` (`server.py`, `docker-compose.yml`); keys stay in an env file on your server, and `web/try_devices.py` checks a running copy with several devices at once.

## How it's built

`engine/` is plain Python and SQLite (no framework), `dashboard/plugin_api.py` are the routes Hermes mounts for the page, `desktop/plugin.js` is the page, and `study_tools.py` are the agent's tools. Tests use a pretend model and no network:

```bash
python -m unittest discover -s tests
hermes plugins validate .
```

Teacher and student share work through one class folder, by default on the same computer; it can be a folder you both sync, such as one in Google Drive (the `class_folder` preference). A person can edit files in a folder they share, so treat what arrives as you would any homework.

This is the solo edition. Live rooms, quiz battles and the full catalog are part of the full Study OS, which is not in this repository.

## License

[MIT](LICENSE)

The pages use Inter and Space Mono, under the SIL Open Font License (see `licenses/`).
