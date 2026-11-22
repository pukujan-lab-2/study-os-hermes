---
name: setup
description: Set up Study OS for someone in Hermes - turn on its pages, add optional Reducto, Pangram and Modal keys, choose a class folder, and make a first course. Use right after installing the plugin, or when someone asks to set up Study OS.
---

# Setting up Study OS

Work through these with the person, one at a time. Skip anything they don't want. Everything works without keys.

1. **Pages.** In Hermes Desktop: Capabilities, Plugins, Rescan, then turn on Study OS Solo. Two entries appear in the sidebar: **Study OS** (learn) and **Study OS Teacher**.
2. **Model.** It uses whatever model Hermes is set to. If calls fail, run `hermes model`.
3. **Keys (optional).** They paste these themselves under Settings, Plugins, Study OS Solo. Never ask for a key in chat, and never print one.
   - Reducto reads PDFs, scans and photos of handwriting.
   - Pangram says who wrote a source, an essay or an answer, part by part. A signal, never proof.
   - Modal gives a natural voice and hears them: `modal secret create study-os-solo-speech SPEECH_TOKEN=<a long random string>`, then `modal deploy voice/modal_speech.py` from the plugin folder. They paste the printed address and the same token. Modal bills their own account while it runs.
4. **Class (optional).** A teacher and students on different computers share one folder, such as one in Google Drive. Both set it as the class folder.
5. **First course.** Ask what they want to learn and call `study_make_course`, or have them press Try a sample on the New page.
