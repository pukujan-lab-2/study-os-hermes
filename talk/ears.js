/* Hearing that works in any browser (Brave and Firefox block Chrome's): the microphone, cut into sentences here, turned
   into words by Modal through Study OS' server. Same shape as SpeechRecognition, so the candle can use either. */
(() => {
  'use strict'
  const here = location.hostname === 'hackathon.design-bakery.com' || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '3190')
  const API = here ? '' : 'https://hackathon.design-bakery.com'
  function wav(chunks, from) {
    const n = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n)
    let o = 0
    for (const c of chunks) { all.set(c, o); o += c.length }
    const step = from / 16000, len = Math.floor(n / step), b = new DataView(new ArrayBuffer(44 + len * 2)), t = (at, s) => [...s].forEach((c, k) => b.setUint8(at + k, c.charCodeAt(0)))
    t(0, 'RIFF'); b.setUint32(4, 36 + len * 2, true); t(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); t(36, 'data'); b.setUint32(40, len * 2, true)
    for (let k = 0; k < len; k++) { const a = Math.floor(k * step), z = Math.min(n, Math.floor((k + 1) * step)); let s = 0; for (let j = a; j < z; j++) s += all[j]; b.setInt16(44 + k * 2, Math.max(-1, Math.min(1, s / Math.max(1, z - a))) * 32767, true) }
    return new Blob([b.buffer], { type: 'audio/wav' })
  }
  class Ears {
    constructor() { this.continuous = true; this.n = 0; this.open = false; this.talk = null; this.pre = []; this.waiting = 0 }
    async start() {
      this.open = true
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      } catch (e) { this.open = false; this.onerror && this.onerror({ error: e && e.name === 'NotFoundError' ? 'audio-capture' : 'not-allowed' }); return this.onend && this.onend() }
      if (!this.open) return this.close()
      const ac = (this.ac = new AudioContext()), node = (this.node = ac.createScriptProcessor(2048, 1, 1))
      let floor = 0.006, loud = 0, quiet = 0
      node.onaudioprocess = e => {
        if (!this.open && !this.talk) return
        const x = new Float32Array(e.inputBuffer.getChannelData(0))
        let s = 0
        for (let k = 0; k < x.length; k++) s += x[k] * x[k]
        const rms = Math.sqrt(s / x.length), ms = x.length / ac.sampleRate * 1000, voice = rms > Math.max(0.012, floor * 2.8) * (Ears.talking ? 1.7 : 1) // it is speaking too: only a clear voice counts
        floor = voice ? floor * 0.999 + rms * 0.001 : floor * 0.95 + rms * 0.05
        Ears.level = rms
        if (Ears.muted && !Ears.hold) { if (this.talk) this.drop(); this.pre = []; loud = 0; return }
        if (Ears.hold) { if (this.sid) this.drop(true); (this.talk = this.talk || this.pre.splice(0)).push(x); quiet = 0; return } // hold to talk: everything, until it's let go
        if (!this.talk) {
          this.pre.push(x); if (this.pre.length > 9) this.pre.shift()
          loud = voice ? loud + ms : Math.max(0, loud - ms)
          if (loud > 140) { this.talk = this.pre; this.pre = []; quiet = 0; this.onspeechstart && this.onspeechstart() }
        } else {
          this.talk.push(x)
          quiet = voice ? 0 : quiet + ms
          if (this.onsegment) { // guess early that the sentence is over, and take it back if they go on
            if (voice && this.sid) { this.oncancel(this.sid); this.sid = 0 }
            if (!this.sid && quiet > 240 && this.talk.length * ms > 420) { this.sid = ++Ears.ids; this.onsegment(this.sid, wav(this.talk, ac.sampleRate)) }
            if (quiet > 520 || this.talk.length * ms > 13000) { loud = 0; if (!this.sid && this.talk.length * ms > 420) { this.sid = ++Ears.ids; this.onsegment(this.sid, wav(this.talk, ac.sampleRate)) } if (this.sid) this.onconfirm(this.sid); this.sid = 0; this.talk = null }
          } else if (quiet > 620 || this.talk.length * ms > 13000) { loud = 0; this.cut() }
        }
      }
      ac.createMediaStreamSource(this.stream).connect(node); node.connect(ac.destination); ac.resume()
    }
    drop(keep) { if (this.sid) { this.oncancel && this.oncancel(this.sid); this.sid = 0 } if (!keep) this.talk = null }
    /** Hold-to-talk was let go: that is the whole sentence. */
    release() { if (this.onsegment && this.talk && this.ac) { const t = this.talk; this.talk = null; if (t.length * 2048 / this.ac.sampleRate > 0.35) { const id = ++Ears.ids; this.onsegment(id, wav(t, this.ac.sampleRate)); this.onconfirm(id) } } }
    async cut() {
      const t = this.talk; this.talk = null
      if (!t || !this.ac || t.length * 2048 / this.ac.sampleRate < 0.28) return this.rest()
      this.waiting++
      let text = ''
      try {
        const r = await fetch(API + '/api/presenter/listen', { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav(t, this.ac.sampleRate) })
        if (r.ok) text = (await r.json()).text || ''
        else if (r.status !== 429) this.onerror && this.onerror({ error: 'asleep' })
      } catch (e) { this.onerror && this.onerror({ error: 'network' }) }
      this.waiting--
      if (text.trim() && !this.dead) { const res = [{ transcript: text.trim() }]; res.isFinal = true; this.list = [...(this.list || []), res]; this.onresult && this.onresult({ resultIndex: this.list.length - 1, results: this.list }) }
      this.rest()
    }
    rest() { if (!this.open && !this.waiting && !this.dead) { this.dead = true; this.close(); this.onend && this.onend() } }
    close() { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); if (this.ac && this.ac.state !== 'closed') this.ac.close().catch(() => {}) }
    stop() { if (!this.open) return; this.open = false; if (this.talk) this.cut(); else this.rest() }
    abort() { this.open = false; this.talk = null; this.dead = true; this.close(); this.onend && this.onend() }
  }
  Ears.hold = false; Ears.level = 0; Ears.muted = false; Ears.talking = false; Ears.ids = 0
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext) && window.isSecureContext !== false) window.StudyEars = Ears
})()
