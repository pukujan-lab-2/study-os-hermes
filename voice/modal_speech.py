"""A voice and an ear for Study OS Solo, on your own Modal account: Kokoro speaks, Parakeet listens, on one GPU that
sleeps when nobody is using it.

  pip install modal && modal setup
  modal secret create study-os-solo-speech SPEECH_TOKEN=<a long random string>
  modal deploy voice/modal_speech.py

Put the printed address and the same token in Hermes: Settings, Plugins, Study OS Solo. Modal bills your account only
while it runs; it stops three minutes after the last sentence. The first sentence after a rest takes about a minute.

  GET  /health -> {"ok": true}
  POST /tts {"text", "voice"?} -> 16-bit mono PCM, header X-Sample-Rate: 24000
  POST /stt  body: WAV         -> {"text"}
"""

import os

import modal

RATE = 24_000
PARAKEET = "nvidia/parakeet-tdt-0.6b-v2"
image = (
    modal.Image.from_registry("nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04", add_python="3.12")
    .env({"HF_HOME": "/cache", "CC": "gcc", "CXX": "g++", "PIP_PREFER_BINARY": "1", "DEBIAN_FRONTEND": "noninteractive"})
    .apt_install("ffmpeg", "espeak-ng", "build-essential", "python3-dev", "libsndfile1")
    .uv_pip_install("nemo_toolkit[asr]==2.3.2", "cuda-python==12.8.0", "huggingface-hub==0.36.0", "hf_transfer==0.1.9", "numpy<2", "pyarrow==20.0.0", "kokoro>=0.9.4", "soundfile", "fastapi==0.115.12")
)
app = modal.App("study-os-solo-speech", image=image)
cache = modal.Volume.from_name("study-os-solo-speech-cache", create_if_missing=True)


@app.cls(gpu=["L4", "T4", "A10"], volumes={"/cache": cache}, secrets=[modal.Secret.from_name("study-os-solo-speech", required_keys=["SPEECH_TOKEN"])], scaledown_window=180, timeout=600, max_containers=1)
@modal.concurrent(max_inputs=4)
class Speech:
    @modal.enter()
    def load(self):
        import nemo.collections.asr as nemo_asr
        from kokoro import KPipeline

        self.asr = nemo_asr.models.ASRModel.from_pretrained(model_name=PARAKEET)
        self.say = KPipeline(lang_code="a")

    @modal.asgi_app()
    def web(self):
        import hmac
        import io
        import tempfile

        import numpy as np
        import soundfile as sf
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

        @api.post("/stt")
        async def stt(request: Request):
            wav = await request.body()
            if len(wav) < 44 or len(wav) > 20_000_000:
                return JSONResponse({"error": "bad audio"}, status_code=400)
            audio, rate = sf.read(io.BytesIO(wav), dtype="float32", always_2d=False)
            with tempfile.NamedTemporaryFile(suffix=".wav") as f:
                sf.write(f.name, audio.mean(axis=1) if audio.ndim > 1 else audio, rate)
                out = self.asr.transcribe([f.name])
            return {"text": (out[0].text if hasattr(out[0], "text") else str(out[0])).strip()}

        return api
