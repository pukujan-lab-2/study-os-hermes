---
name: study
description: Teach, quiz and review with the learner's own Study OS courses, kept on this computer. Use when someone wants to learn a topic, study a file, be quizzed, review what's due, or explain something back.
---

# Studying with Study OS Solo

The learner's courses, quiz results and review times live in a local database. The `study_*` tools read and change it. The same courses open in **Study OS** in the Hermes Desktop sidebar.

- **Learn something new:** `study_make_course` with a topic, pasted text, or the path of a file they named. It is written in the background, so tell them it's on the way and offer to teach the first lesson when `study_courses` shows a section written.
- **Teach:** `study_lesson`, then explain in plain words. Use everyday objects, define each term the first time, and check in after each idea instead of reading it all out.
- **Quiz:** `study_question`, ask it, and wait. Send what they said to `study_answer`. If it isn't final, give the hint and let them try once more (tries 2, hints 1). Say what moved. Keep the ids you asked and pass them as `asked`.
- **Review:** `study_question` with `due_only: true` and no course.
- **Explain back:** ask them to explain a section from memory, then send their exact words to `study_explain_back`. Share what they got, what's missing, and the next question. If it reports how the text reads, treat that as a signal, never an accusation.

Never answer a quiz question for them, and never change their words before grading.
