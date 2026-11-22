"""A voice for Study OS Solo on your own Modal account: Kokoro on a small GPU that sleeps when nobody is listening.

  pip install modal && modal setup
  modal secret create study-os-solo-speech SPEECH_TOKEN=<a long random string>
  modal deploy voice/modal_speech.py

Put the printed address and the same token in Hermes: Settings, Plugins, Study OS Solo. Modal bills your account only
while it runs; it stops two minutes after the last sentence.

  GET  /health -> {"ok": true}
  POST /tts {"text", "voice"?} -> 16-bit mono PCM, header X-Sample-Rate: 24000
"""

import os

import modal

RATE = 24_000
image = modal.Image.debian_slim(python_version="3.12").apt_install("espeak-ng").uv_pip_install("kokoro==0.9.4", "soundfile", "fastapi==0.115.12").env({"HF_HOME": "/cache"})
app = modal.App("study-os-solo-speech", image=image)
cache = modal.Volume.from_name("study-os-solo-speech-cache", create_if_missing=True)


@app.cls(gpu="T4", volumes={"/cache": cache}, secrets=[modal.Secret.from_name("study-os-solo-speech", required_keys=["SPEECH_TOKEN"])], scaledown_window=120, timeout=300, max_containers=1)
@modal.concurrent(max_inputs=4)
class Speech:
    @modal.enter()
    def load(self):
        from kokoro import KPipeline

        self.say = KPipeline(lang_code="a")

    @modal.asgi_app()
    def web(self):
        import hmac

        import numpy as np
        from fastapi import FastAPI, Request
        from fastapi.responses import JSONResponse, Response

        api = FastAPI()

        @api.middleware("http")
        async def token(request: Request, call_next):
            if not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {os.environ['SPEECH_TOKEN']}"):
                return JSONResponse({"error": "unauthorized"}, status_code=401)
            return await call_next(request)

        @api.get("/health")
        def health():
            return {"ok": True}

        @api.post("/tts")
        def tts(body: dict):
            text = str(body.get("text", "")).strip()
            if not text or len(text) > 4000:
                return JSONResponse({"error": "bad text"}, status_code=400)
            pcm = b"".join((np.clip(np.asarray(a), -1, 1) * 32767).astype("<i2").tobytes() for _g, _p, a in self.say(text, voice=str(body.get("voice") or "af_heart"), split_pattern=r"\n+"))
            return Response(pcm, media_type="audio/pcm", headers={"X-Sample-Rate": str(RATE), "Cache-Control": "no-store"})

        return api
