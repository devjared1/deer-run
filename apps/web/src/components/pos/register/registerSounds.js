// Short register tones (WebAudio, no files): a high blip when an item goes on the sale, a low double buzz when a
// scan or search finds nothing. Quiet, and silently skipped where audio isn't available.
let ctx = null

function tone(frequency, ms, { type = 'sine', gain = 0.08, delay = 0 } = {}) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    ctx ??= new AudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const start = ctx.currentTime + delay / 1000
    const end = start + ms / 1000
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = type
    osc.frequency.value = frequency
    amp.gain.setValueAtTime(gain, start)
    amp.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(amp).connect(ctx.destination)
    osc.start(start)
    osc.stop(end)
  } catch {
    // No audio: the highlight and message still show
  }
}

export function beepAdded() {
  tone(1760, 70)
}

export function beepError() {
  tone(220, 140, { type: 'square', gain: 0.05 })
  tone(165, 200, { type: 'square', gain: 0.05, delay: 170 })
}
