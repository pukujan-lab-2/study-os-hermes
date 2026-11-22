# Study OS Solo for Hermes

Learn anything inside [Hermes](https://github.com/NousResearch/hermes-agent), on your own computer. Give it a topic, a PDF or your notes and it makes a short course: plain lessons, quizzes that fit what you know, reviews at the right time, and a place to explain things back in your own words.

**No account, no server.** Your courses and progress are one SQLite file in your Hermes folder. Lessons are written by whatever model you use in Hermes, so there is no extra AI key.

## Install

```bash
hermes plugins install pukujan-lab-2/study-os-hermes --enable
```

Then, in Hermes Desktop, open **Capabilities → Plugins**, choose **Rescan**, and turn on **Study OS Solo**. It appears in the sidebar. In chat, just ask: "Make me a course on how vaccines work", "Quiz me on what's due", "Teach me section 2".

## What it does

- **Make a course** from a topic, a PDF, a Word document, or pasted text. It's written in the background and picks up where it stopped if you close Hermes.
- **Plain lessons.** Ideas are explained in their own subject with everyday things. A comparison to something you know well is optional, short, and folds away.
- **Change how it's explained.** Simpler, slower, another level or style. Preview it, use it, switch back. Your progress stays.
- **Quizzes** pick what you know least, say why a wrong answer is tempting, give one more try, and move your mastery of each goal.
- **Review** brings each goal back after 1, 3, 7, 16, 35 and 75 days, sooner when you miss it.
- **Explain it back** and see what you got, what's missing, and a question to try next.
- **What you know**: every goal, searchable, with what's known, being learned, and due. A streak keeps count.
- **Read it to me**, with your computer's voice or your own on Modal.

## Optional services, with your own keys

Add these under **Settings → Plugins → Study OS Solo**. Each key is stored by Hermes and only ever sent to its own service.

| Service | What it adds | Without it |
|---|---|---|
| [Reducto](https://reducto.ai) | Reads PDFs and scans, with tables | PDFs with text are read on your computer |
| [Pangram](https://www.pangram.com) | Says whether an explanation reads as AI-written: a signal, never proof | That check is off |
| [Modal](https://modal.com) | A natural voice on your own account: `modal deploy voice/modal_speech.py` | Your computer's own voice |

## What leaves your computer

- The text a lesson, quiz or grade needs goes to the model you chose in Hermes. Choose a local model and it stays here.
- A PDF goes to Reducto, an explanation to Pangram, and lesson text to Modal, only if you added that service.
- Nothing else. There is no analytics and no Study OS server.

Lessons made from a topic are written from what your model knows, with no sources. Check anything important.

## How it's built

`engine/` is plain Python and SQLite (no framework), `dashboard/plugin_api.py` are the routes Hermes mounts for the page, `desktop/plugin.js` is the page, and `study_tools.py` are the agent's tools. Tests use a pretend model and no network:

```bash
python -m unittest discover -s tests
hermes plugins validate .
```

This is the solo edition. Classes, live rooms, videos and the full catalog are part of the full Study OS, which is not in this repository.

## License

[MIT](LICENSE)
