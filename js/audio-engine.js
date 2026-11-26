class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bufferSize = 256;
    this.sf2Info = null;
    this.songBuffer = null;
    this.songSource = null;
    this.padBuffers = [null, null, null, null];
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: "interactive" });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.75;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setBufferSize(size) {
    const allowed = [128, 256, 512, 1024];
    this.bufferSize = allowed.includes(Number(size)) ? Number(size) : 256;
    return this.getLatencyMetrics();
  }

  getLatencyMetrics() {
    const sr = this.ctx ? this.ctx.sampleRate : 48000;
    const outputMs = (this.bufferSize / sr) * 1000;
    const midiInputMs = 2.0;
    const osOverheadMs = 4.5;
    const totalWiredMs = outputMs + midiInputMs + osOverheadMs;
    const bluetoothExtraMs = 140;

    return {
      sampleRate: sr,
      bufferSize: this.bufferSize,
      outputMs: Number(outputMs.toFixed(1)),
      totalWiredMs: Number(totalWiredMs.toFixed(1)),
      estimatedBluetoothMs: Number((totalWiredMs + bluetoothExtraMs).toFixed(1))
    };
  }

  async loadSf2File(file) {
    this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const view = new DataView(arrayBuffer);
    const riff =
      String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));

    if (riff !== "RIFF") {
      throw new Error("El archivo seleccionado no tiene cabecera RIFF válida para un .SF2");
    }

    this.sf2Info = {
      name: file.name,
      sizeMB: Number((file.size / (1024 * 1024)).toFixed(2)),
      loadedAt: new Date().toLocaleTimeString()
    };
    return this.sf2Info;
  }

  async loadAudioFile(file, target = "song", padIndex = 0) {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);

    if (target === "pad") {
      this.padBuffers[padIndex] = {
        name: file.name,
        buffer: decoded
      };
      return this.padBuffers[padIndex];
    }

    this.songBuffer = {
      name: file.name,
      buffer: decoded
    };
    return this.songBuffer;
  }

  playSong(loop = false) {
    if (!this.songBuffer || !this.songBuffer.buffer) return false;
    const ctx = this.ensureContext();
    this.stopSong();

    const source = ctx.createBufferSource();
    source.buffer = this.songBuffer.buffer;
    source.loop = loop;
    source.connect(this.masterGain);
    source.start();
    this.songSource = source;
    return true;
  }

  stopSong() {
    if (this.songSource) {
      try {
        this.songSource.stop();
        this.songSource.disconnect();
      } catch (_) {}
      this.songSource = null;
    }
  }

  triggerPad(index) {
    const pad = this.padBuffers[index];
    if (!pad || !pad.buffer) return false;
    const ctx = this.ensureContext();

    const source = ctx.createBufferSource();
    source.buffer = pad.buffer;
    source.connect(this.masterGain);
    source.start();
    return true;
  }

  midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  playDrum(noteNumber, velocity = 0.8) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    if (noteNumber === 35 || noteNumber === 36) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
      gain.gain.setValueAtTime(velocity * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.17);
      return;
    }

    const duration = noteNumber === 46 ? 0.22 : 0.08;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = noteNumber === 38 || noteNumber === 40 ? "bandpass" : "highpass";
    filter.frequency.value = noteNumber === 38 || noteNumber === 40 ? 1600 : 7500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + duration + 0.01);
  }

  playNote(midiNote, durationSec = 0.25, velocity = 0.65, waveType = "triangle") {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(this.midiToFreq(midiNote), now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(velocity * 0.28, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }
}

window.AudioEngine = AudioEngine;
