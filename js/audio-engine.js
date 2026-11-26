class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bufferSize = 256;
    this.sf2Info = null;
    this.sf2Samples = []; // { name, buffer, rootKey, sampleRate, loopStart, loopEnd, hasLoop }
    this.sf2Enabled = false;
    this.sf2Assignments = {
      r1: -1,   // -1 = auto / synth, >= 0 = índice en sf2Samples
      r2: -1,
      left: -1,
      bass: -1,
      chord: -1
    };
    this.songBuffer = null;
    this.songSource = null;
    this.padBuffers = [null, null, null, null];
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: "interactive" });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setBufferSize(size) {
    this.bufferSize = Number(size) || 256;
  }

  getLatencyMetrics() {
    const sr = this.ctx ? this.ctx.sampleRate : 48000;
    const outputMs = (this.bufferSize / sr) * 1000;
    const totalWiredMs = outputMs + 4.2;
    return {
      sampleRate: sr,
      bufferSize: this.bufferSize,
      outputMs: outputMs.toFixed(1),
      totalWiredMs: totalWiredMs.toFixed(1),
      estimatedBluetoothMs: (totalWiredMs + 145).toFixed(0)
    };
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  playSf2Sample(sampleIndex, midiNote, duration = 0.4, velocity = 0.8) {
    const sample = this.sf2Samples[sampleIndex];
    if (!sample || !sample.buffer) return false;

    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;

    const semitoneDiff = midiNote - (sample.rootKey || 60);
    src.playbackRate.setValueAtTime(Math.pow(2, semitoneDiff / 12), now);

    if (sample.hasLoop && sample.loopEnd > sample.loopStart) {
      src.loop = true;
      src.loopStart = sample.loopStart / sample.sampleRate;
      src.loopEnd = sample.loopEnd / sample.sampleRate;
    }

    const gain = ctx.createGain();
    const peak = Math.max(0.001, Math.min(1, velocity));
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.01);
    gain.gain.setValueAtTime(peak, now + Math.max(0.05, duration - 0.06));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.08);

    src.connect(gain);
    gain.connect(this.masterGain);

    src.start(now);
    src.stop(now + duration + 0.1);
    return true;
  }

  playNote(midiNote, duration = 0.3, velocity = 0.75, wave = "triangle", partKey = null) {
    if (this.sf2Enabled && this.sf2Samples.length > 0) {
      let chosenIdx = -1;
      if (partKey && this.sf2Assignments[partKey] >= 0) {
        chosenIdx = this.sf2Assignments[partKey];
      } else if (this.sf2Assignments.r1 >= 0) {
        chosenIdx = this.sf2Assignments.r1;
      } else {
        chosenIdx = 0;
      }
      if (this.playSf2Sample(chosenIdx, midiNote, duration, velocity)) {
        return;
      }
    }

    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(this.midiToFreq(midiNote), now);

    const peak = Math.max(0.001, velocity * 0.45);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playDrum(note, velocity = 0.85) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Kick (35, 36)
    if (note === 35 || note === 36) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
      gain.gain.setValueAtTime(velocity * 0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.23);
      return;
    }

    // Toms (41, 43, 45, 47, 48, 50)
    if ([41, 43, 45, 47, 48, 50].includes(note)) {
      const baseFreq = 85 + (note - 41) * 14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.18);
      gain.gain.setValueAtTime(velocity * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
      return;
    }

    // Snare, Rim, Hi-Hat, Crash, Ride (ruido filtrado + cuerpo)
    const isSnare = note === 37 || note === 38 || note === 40;
    const isOpen = note === 46 || note === 49 || note === 51 || note === 57;
    const len = isOpen ? 0.36 : isSnare ? 0.16 : 0.065;

    const bufferSize = Math.floor(ctx.sampleRate * len);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = isSnare ? "bandpass" : "highpass";
    filter.frequency.value = isSnare ? 1600 : 6500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(velocity * (isSnare ? 0.65 : 0.4), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + len);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  async loadSf2File(file) {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const ascii = (offset, len) =>
      String.fromCharCode(...bytes.slice(offset, offset + len));

    if (bytes.length < 64 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "sfbk") {
      throw new Error("El archivo no tiene cabecera válida SoundFont 2 (RIFF/sfbk).");
    }

    // Buscar chunks 'smpl' (PCM 16-bit) y 'shdr' (cabeceras de muestra)
    let smplOffset = -1;
    let smplSize = 0;
    let shdrOffset = -1;
    let shdrSize = 0;

    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const chunkId = ascii(pos, 4);
      const chunkSize = view.getUint32(pos + 4, true);
      if (chunkId === "LIST" && pos + 12 <= bytes.length) {
        pos += 12; // Entrar dentro de LIST (INFO, sdta, pdta)
        continue;
      }
      if (chunkId === "smpl") {
        smplOffset = pos + 8;
        smplSize = chunkSize;
      } else if (chunkId === "shdr") {
        shdrOffset = pos + 8;
        shdrSize = chunkSize;
      }
      pos += 8 + chunkSize + (chunkSize % 2);
    }

    if (smplOffset < 0 || shdrOffset < 0) {
      throw new Error("No se encontraron bloques de audio PCM (smpl/shdr) dentro del .SF2.");
    }

    const totalSamples = Math.floor(smplSize / 2);
    const pcm16 = new Int16Array(arrayBuffer, smplOffset, totalSamples);
    const recordSize = 46; // Cada registro shdr mide 46 bytes
    const numRecords = Math.floor(shdrSize / recordSize);

    const parsedSamples = [];
    for (let i = 0; i < numRecords; i++) {
      const rec = shdrOffset + i * recordSize;
      const rawName = ascii(rec, 20).replace(/\0.*$/, "").trim();
      if (!rawName || rawName === "EOS") continue;

      const start = view.getUint32(rec + 20, true);
      const end = view.getUint32(rec + 24, true);
      const startLoop = view.getUint32(rec + 28, true);
      const endLoop = view.getUint32(rec + 32, true);
      const sampleRate = view.getUint32(rec + 36, true) || 44100;
      const origPitch = view.getUint8(rec + 40);
      const sampleType = view.getUint16(rec + 44, true);

      // Evitar duplicados del canal derecho en muestras estéreo (sampleType === 2)
      if (sampleType === 2) continue;

      const length = end - start;
      if (length <= 32 || end > pcm16.length) continue;

      try {
        const audioBuf = ctx.createBuffer(1, length, Math.max(8000, Math.min(96000, sampleRate)));
        const channelData = audioBuf.getChannelData(0);
        for (let s = 0; s < length; s++) {
          channelData[s] = pcm16[start + s] / 32768;
        }

        const relLoopStart = Math.max(0, startLoop - start);
        const relLoopEnd = Math.min(length, endLoop - start);

        parsedSamples.push({
          name: rawName,
          buffer: audioBuf,
          rootKey: origPitch <= 127 ? origPitch : 60,
          sampleRate,
          loopStart: relLoopStart,
          loopEnd: relLoopEnd,
          hasLoop: relLoopEnd - relLoopStart > 64
        });
      } catch (_) {
        // Ignorar muestras con sampleRate inválido
      }

      if (parsedSamples.length >= 96) break; // Límite seguro de memoria en móvil
    }

    if (parsedSamples.length === 0) {
      throw new Error("El archivo .SF2 no contiene muestras PCM descomprimidas reproducibles.");
    }

    this.sf2Samples = parsedSamples;
    this.sf2Enabled = true;
    this.sf2Assignments = {
      r1: 0,
      r2: parsedSamples.length > 1 ? 1 : 0,
      left: parsedSamples.length > 2 ? 2 : 0,
      bass: parsedSamples.length > 3 ? 3 : 0,
      chord: 0
    };

    this.sf2Info = {
      name: file.name,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      sampleCount: parsedSamples.length
    };
    return this.sf2Info;
  }

  async loadAudioFile(file, target = "song", padIndex = 0) {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (target === "pad") {
      this.padBuffers[padIndex] = { name: file.name, buffer: decoded };
    } else {
      this.songBuffer = { name: file.name, buffer: decoded };
    }
    return { name: file.name, duration: decoded.duration.toFixed(1) };
  }

  playSong(loop = false) {
    if (!this.songBuffer) return false;
    this.stopSong();
    const ctx = this.ensureContext();
    const src = ctx.createBufferSource();
    src.buffer = this.songBuffer.buffer;
    src.loop = loop;
    src.connect(this.masterGain);
    src.start(0);
    this.songSource = src;
    return true;
  }

  stopSong() {
    if (this.songSource) {
      try {
        this.songSource.stop();
      } catch (_) {}
      this.songSource = null;
    }
  }

  triggerPad(index) {
    const item = this.padBuffers[index];
    if (!item) return false;
    const ctx = this.ensureContext();
    const src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.connect(this.masterGain);
    src.start(0);
    return true;
  }
}

window.AudioEngine = AudioEngine;
