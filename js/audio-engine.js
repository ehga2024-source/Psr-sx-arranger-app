class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.bufferSize = 256;

    // Lista de bancos SF2 guardados en memoria de la app
    this.sf2Banks = [];
    this.activeSf2BankId = null;

    this.sf2Info = null;
    this.sf2Samples = [];
    this.sf2Presets = [];
    this.sf2Enabled = false;
    this.sf2Assignments = {
      r1: -1,
      r2: -1,
      left: -1,
      bass: -1,
      chord: -1
    };

    // Librería de samples (SF2 presets + WAV/MP3 cargados)
    this.sampleLibrary = [];
    this.songBuffer = null;
    this.songSource = null;
    this.padBuffers = [null, null, null, null];
  }

  openStorageDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = indexedDB.open("PsrSxStudioStorage", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("sf2_files")) {
          db.createObjectStore("sf2_files", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSf2ToStorage(id, name, arrayBuffer) {
    try {
      const db = await this.openStorageDb();
      if (!db) return;
      const tx = db.transaction("sf2_files", "readwrite");
      tx.objectStore("sf2_files").put({ id, name, arrayBuffer, savedAt: Date.now() });
    } catch (_) {}
  }

  async restoreSavedSf2Banks() {
    try {
      const db = await this.openStorageDb();
      if (!db) return [];
      const records = await new Promise((resolve) => {
        const tx = db.transaction("sf2_files", "readonly");
        const req = tx.objectStore("sf2_files").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      for (const rec of records) {
        if (rec && rec.arrayBuffer) {
          await this.parseSf2Buffer(rec.arrayBuffer, rec.name, rec.id, false);
        }
      }
      // Al restaurar bancos, dejamos GM/XG activo por defecto hasta que el usuario elija un preset SF2
      this.sf2Enabled = false;
      return this.sf2Banks;
    } catch (_) {
      return [];
    }
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: "interactive" });

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.16, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  getOutNode() {
    this.ensureContext();
    return this.compressor || this.masterGain;
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

  rebuildSampleLibrary() {
    const items = [];
    this.sf2Banks.forEach((bank) => {
      bank.presets.forEach((preset, pIdx) => {
        items.push({
          uid: `sf2:${bank.id}:${pIdx}`,
          kind: "sf2_preset",
          bankId: bank.id,
          bankName: bank.name,
          presetIndex: pIdx,
          name: `${preset.name} (${bank.name})`
        });
      });
    });

    this.padBuffers.forEach((pad, idx) => {
      if (pad) {
        items.push({
          uid: `pad:${idx}`,
          kind: "audio_buffer",
          padIndex: idx,
          name: `[WAV/MP3] ${pad.name}`
        });
      }
    });

    this.sampleLibrary = items;
  }

  activateSf2Bank(bankId, enableSf2 = true) {
    const bank = this.sf2Banks.find((b) => b.id === bankId);
    if (!bank) return false;
    this.activeSf2BankId = bank.id;
    this.sf2Samples = bank.samples;
    this.sf2Presets = bank.presets;
    this.sf2Enabled = Boolean(enableSf2);
    this.sf2Assignments = {
      r1: 0,
      r2: bank.presets.length > 1 ? 1 : 0,
      left: 0,
      bass: Math.max(0, bank.presets.findIndex((p) => /bass/i.test(p.name))),
      chord: 0
    };
    this.sf2Info = {
      id: bank.id,
      name: bank.name,
      sizeMB: bank.sizeMB,
      presetCount: bank.presets.length,
      sampleCount: bank.samples.filter(Boolean).length
    };
    return true;
  }

  selectGmXgProgram(program, partKey = "r1") {
    const prog = Math.max(0, Math.min(127, Number(program) || 0));
    // Al seleccionar una voz GM/XG/XP-10/N364, desactivamos el forzado global de SF2
    // para que suene el programa GM/XG correspondiente.
    this.sf2Enabled = false;
    if (partKey && this.sf2Assignments[partKey] !== undefined) {
      this.sf2Assignments[partKey] = -1;
    }
    return prog;
  }

  playSampleLibraryItem(uid, midiNote = 60, duration = 0.5, velocity = 0.9) {
    if (!uid) return false;
    if (uid.startsWith("sf2:")) {
      const parts = uid.split(":");
      const bankId = parts[1];
      const pIdx = Number(parts[2]);
      const bank = this.sf2Banks.find((b) => b.id === bankId);
      if (!bank) return false;
      const prevSamples = this.sf2Samples;
      const prevPresets = this.sf2Presets;
      this.sf2Samples = bank.samples;
      this.sf2Presets = bank.presets;
      const ok = this.playSf2Preset(pIdx, midiNote, duration, velocity);
      this.sf2Samples = prevSamples;
      this.sf2Presets = prevPresets;
      return ok;
    }
    if (uid.startsWith("pad:")) {
      const idx = Number(uid.split(":")[1]);
      return this.triggerPad(idx);
    }
    return false;
  }

  playSf2Sample(sampleIndex, midiNote, duration = 0.45, velocity = 0.85, overrideRoot = null) {
    const sample = this.sf2Samples[sampleIndex];
    if (!sample || !sample.buffer) return false;

    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;

    const root = overrideRoot !== null ? overrideRoot : sample.rootKey || 60;
    const semitoneDiff = midiNote - root;
    src.playbackRate.setValueAtTime(Math.pow(2, semitoneDiff / 12), now);

    if (sample.hasLoop && sample.loopEnd > sample.loopStart) {
      src.loop = true;
      src.loopStart = sample.loopStart / sample.sampleRate;
      src.loopEnd = sample.loopEnd / sample.sampleRate;
    }

    const gain = ctx.createGain();
    const peak = Math.max(0.002, Math.min(1.0, velocity * 0.95));
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.setValueAtTime(peak, now + Math.max(0.06, duration - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.12);

    src.connect(gain);
    gain.connect(this.getOutNode());

    src.start(now);
    src.stop(now + duration + 0.14);
    return true;
  }

  playSf2Preset(presetIndex, midiNote, duration = 0.45, velocity = 0.85) {
    const preset = this.sf2Presets[presetIndex];
    if (!preset || !preset.zones || preset.zones.length === 0) {
      return this.playSf2Sample(presetIndex, midiNote, duration, velocity);
    }

    let matchingZones = preset.zones.filter(
      (z) => midiNote >= z.keyLo && midiNote <= z.keyHi
    );

    if (matchingZones.length === 0) {
      matchingZones = [
        preset.zones.reduce((best, z) => {
          const dist = Math.min(Math.abs(midiNote - z.keyLo), Math.abs(midiNote - z.keyHi));
          const bestDist = Math.min(Math.abs(midiNote - best.keyLo), Math.abs(midiNote - best.keyHi));
          return dist < bestDist ? z : best;
        }, preset.zones[0])
      ];
    }

    let played = false;
    matchingZones.slice(0, 2).forEach((z) => {
      if (this.playSf2Sample(z.sampleId, midiNote, duration, velocity, z.rootKey)) {
        played = true;
      }
    });
    return played;
  }

  playSynthInstrument(program, midiNote, duration = 0.35, velocity = 0.8) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const prog = Math.max(0, Math.min(127, Number(program) || 0));
    const freq = this.midiToFreq(midiNote);
    const out = this.getOutNode();

    const masterNoteGain = ctx.createGain();
    const peak = Math.max(0.002, velocity * 0.58);
    masterNoteGain.gain.setValueAtTime(0.001, now);
    masterNoteGain.connect(out);

    // 0..7: Piano / Electric Piano / Clavi
    if (prog <= 7) {
      const isEp = prog >= 4 && prog <= 5;
      const isClavi = prog === 7;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = isClavi ? "sawtooth" : isEp ? "sine" : "triangle";
      osc2.type = isEp ? "triangle" : "sine";
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(isEp ? freq * 2 : freq * (prog === 1 ? 3 : 2), now);

      const g2 = ctx.createGain();
      g2.gain.value = isEp ? 0.45 : prog === 1 ? 0.38 : 0.25;

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(isClavi ? 4200 : prog === 1 ? 4600 : 3200, now);
      filter.frequency.exponentialRampToValueAtTime(isEp ? 900 : 520, now + duration + 0.12);

      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.9, now + 0.006);
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.14);

      osc1.connect(filter);
      osc2.connect(g2);
      g2.connect(filter);
      filter.connect(masterNoteGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.16);
      osc2.stop(now + duration + 0.16);
      return;
    }

    // 8..15: Chromatic Percussion (Marimba, Vibraphone, Celesta, Bells)
    if (prog >= 8 && prog <= 15) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 4, now);
      g2.gain.setValueAtTime(peak * 0.35, now);
      g2.gain.exponentialRampToValueAtTime(0.0008, now + 0.08);

      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.85, now + 0.004);
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + Math.max(0.25, duration + 0.15));

      osc1.connect(masterNoteGain);
      osc2.connect(g2);
      g2.connect(out);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.18);
      osc2.stop(now + 0.12);
      return;
    }

    // 16..23: Organ & Accordion
    if (prog >= 16 && prog <= 23) {
      const isAccordion = prog === 21 || prog === 23;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = isAccordion ? "sawtooth" : "sine";
      osc2.type = isAccordion ? "triangle" : "sine";
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(isAccordion ? freq * 1.005 : freq * 2, now);

      const g2 = ctx.createGain();
      g2.gain.value = isAccordion ? 0.75 : 0.45;

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(isAccordion ? 2300 : 3400, now);

      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.75, now + 0.016);
      masterNoteGain.gain.setValueAtTime(peak * 0.7, now + Math.max(0.08, duration - 0.03));
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.06);

      osc1.connect(filter);
      osc2.connect(g2);
      g2.connect(filter);
      filter.connect(masterNoteGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.08);
      osc2.stop(now + duration + 0.08);
      return;
    }

    // 24..31: Guitar
    if (prog >= 24 && prog <= 31) {
      const isDist = prog >= 29 && prog <= 30;
      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      osc1.type = isDist ? "sawtooth" : prog === 24 ? "triangle" : "sawtooth";
      osc1.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.Q.value = isDist ? 4.5 : 1.5;
      filter.frequency.setValueAtTime(isDist ? 3800 : 2600, now);
      filter.frequency.exponentialRampToValueAtTime(isDist ? 1200 : 620, now + duration + 0.08);

      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.85, now + 0.007);
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.1);

      osc1.connect(filter);
      filter.connect(masterNoteGain);
      osc1.start(now);
      osc1.stop(now + duration + 0.12);
      return;
    }

    // 32..39: Bass
    if (prog >= 32 && prog <= 39) {
      const subOsc = ctx.createOscillator();
      const bodyOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(freq, now);

      bodyOsc.type = prog >= 36 ? "sawtooth" : "triangle";
      bodyOsc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.Q.value = prog === 36 || prog === 37 ? 5.0 : 2.8;
      filter.frequency.setValueAtTime(freq * (prog >= 36 ? 8 : 5.5), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(110, freq * 1.5), now + 0.14);

      const subGain = ctx.createGain();
      subGain.gain.value = 0.85;
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.55;

      masterNoteGain.gain.linearRampToValueAtTime(peak * 1.25, now + 0.008);
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + Math.max(0.28, duration + 0.08));

      subOsc.connect(subGain);
      bodyOsc.connect(bodyGain);
      subGain.connect(filter);
      bodyGain.connect(filter);
      filter.connect(masterNoteGain);

      subOsc.start(now);
      bodyOsc.start(now);
      subOsc.stop(now + duration + 0.12);
      bodyOsc.stop(now + duration + 0.12);
      return;
    }

    // 40..55: Strings, Ensemble & Choir
    if (prog >= 40 && prog <= 55) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = "sawtooth";
      osc2.type = "sawtooth";
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.006, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2100, now);

      const att = prog >= 48 ? 0.055 : 0.025;
      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.72, now + att);
      masterNoteGain.gain.setValueAtTime(peak * 0.68, now + Math.max(att + 0.05, duration));
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.14);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(masterNoteGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.16);
      osc2.stop(now + duration + 0.16);
      return;
    }

    // 56..67: Brass & Sax
    if (prog >= 56 && prog <= 67) {
      const isSax = prog >= 64;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = "sawtooth";
      osc2.type = isSax ? "triangle" : "square";
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 0.998, now);

      const g2 = ctx.createGain();
      g2.gain.value = isSax ? 0.45 : 0.35;

      filter.type = "lowpass";
      filter.Q.value = isSax ? 2.5 : 2.0;
      filter.frequency.setValueAtTime(520, now);
      filter.frequency.linearRampToValueAtTime(isSax ? 2800 : 3400, now + 0.045);
      filter.frequency.exponentialRampToValueAtTime(1500, now + duration);

      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.8, now + 0.022);
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.07);

      osc1.connect(filter);
      osc2.connect(g2);
      g2.connect(filter);
      filter.connect(masterNoteGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.09);
      osc2.stop(now + duration + 0.09);
      return;
    }

    // 68..79: Reed & Pipe (Flute, Oboe, Clarinet, Pan Flute)
    if (prog >= 68 && prog <= 79) {
      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      osc1.type = prog === 73 || prog === 75 ? "sine" : "triangle";
      osc1.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, now);

      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.75, now + 0.03);
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.08);

      osc1.connect(filter);
      filter.connect(masterNoteGain);
      osc1.start(now);
      osc1.stop(now + duration + 0.1);
      return;
    }

    // 80..95: Synth Lead & Synth Pad
    if (prog >= 80 && prog <= 95) {
      const isPad = prog >= 88;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = prog === 80 ? "square" : "sawtooth";
      osc2.type = isPad ? "triangle" : "sawtooth";
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * (isPad ? 1.007 : 1.003), now);

      filter.type = "lowpass";
      filter.Q.value = isPad ? 1.2 : 3.2;
      filter.frequency.setValueAtTime(isPad ? 1600 : 3500, now);

      const att = isPad ? 0.08 : 0.01;
      masterNoteGain.gain.linearRampToValueAtTime(peak * 0.78, now + att);
      masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + (isPad ? 0.18 : 0.06));

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(masterNoteGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.2);
      osc2.stop(now + duration + 0.2);
      return;
    }

    // 96..127: Synth FX, Ethnic & Percussive
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    osc1.type = "sawtooth";
    osc2.type = "square";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.5, now);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.value = 2.0;

    masterNoteGain.gain.linearRampToValueAtTime(peak * 0.72, now + 0.01);
    masterNoteGain.gain.exponentialRampToValueAtTime(0.0008, now + duration + 0.1);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(masterNoteGain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.12);
    osc2.stop(now + duration + 0.12);
  }

  playNote(midiNote, duration = 0.35, velocity = 0.8, programOrWave = 0, partKey = null) {
    const prog = typeof programOrWave === "number" ? programOrWave : 0;

    if (this.sf2Enabled && (this.sf2Presets.length > 0 || this.sf2Samples.length > 0)) {
      let chosenIdx = -1;
      if (partKey && this.sf2Assignments[partKey] >= 0) {
        chosenIdx = this.sf2Assignments[partKey];
      } else if (partKey === null && this.sf2Assignments.r1 >= 0) {
        chosenIdx = this.sf2Assignments.r1;
      }
      if (chosenIdx >= 0 && this.playSf2Preset(chosenIdx, midiNote, duration, velocity)) {
        return;
      }
    }

    this.playSynthInstrument(prog, midiNote, duration, velocity);
  }

  createNoiseBuffer(durationSec) {
    const ctx = this.ensureContext();
    const len = Math.max(64, Math.floor(ctx.sampleRate * durationSec));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  playDrum(note, velocity = 0.9) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const out = this.getOutNode();
    const vel = Math.max(0.05, Math.min(1.0, velocity));

    if (note === 35 || note === 36) {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(165, now);
      subOsc.frequency.exponentialRampToValueAtTime(52, now + 0.065);
      subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.24);

      subGain.gain.setValueAtTime(vel * 1.15, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      const clickNoise = ctx.createBufferSource();
      clickNoise.buffer = this.createNoiseBuffer(0.025);
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = "bandpass";
      clickFilter.frequency.value = 2400;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(vel * 0.45, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      subOsc.connect(subGain);
      subGain.connect(out);
      clickNoise.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(out);

      subOsc.start(now);
      subOsc.stop(now + 0.3);
      clickNoise.start(now);
      return;
    }

    if (note === 38 || note === 40) {
      const shellOsc = ctx.createOscillator();
      const shellGain = ctx.createGain();
      shellOsc.type = "triangle";
      shellOsc.frequency.setValueAtTime(210, now);
      shellOsc.frequency.exponentialRampToValueAtTime(125, now + 0.09);
      shellGain.gain.setValueAtTime(vel * 0.78, now);
      shellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      const snareNoise = ctx.createBufferSource();
      snareNoise.buffer = this.createNoiseBuffer(0.22);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1100;
      const bp = ctx.createBiquadFilter();
      bp.type = "peaking";
      bp.frequency.value = 3200;
      bp.gain.value = 6;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vel * 0.75, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      shellOsc.connect(shellGain);
      shellGain.connect(out);
      snareNoise.connect(hp);
      hp.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(out);

      shellOsc.start(now);
      shellOsc.stop(now + 0.16);
      snareNoise.start(now);
      return;
    }

    if (note === 37 || note === 75) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      const f = note === 75 ? 2450 : 860;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.75, now + 0.045);
      gain.gain.setValueAtTime(vel * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.06);
      return;
    }

    if ([41, 43, 45, 47, 48, 50].includes(note)) {
      const pitchMap = { 50: 255, 48: 220, 47: 185, 45: 155, 43: 128, 41: 102 };
      const startF = pitchMap[note] || 180;

      const mainOsc = ctx.createOscillator();
      const overtoneOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      mainOsc.type = "sine";
      mainOsc.frequency.setValueAtTime(startF * 1.65, now);
      mainOsc.frequency.exponentialRampToValueAtTime(startF, now + 0.045);
      mainOsc.frequency.exponentialRampToValueAtTime(startF * 0.72, now + 0.28);

      overtoneOsc.type = "triangle";
      overtoneOsc.frequency.setValueAtTime(startF * 2.4, now);
      overtoneOsc.frequency.exponentialRampToValueAtTime(startF * 1.45, now + 0.09);

      const overGain = ctx.createGain();
      overGain.gain.setValueAtTime(vel * 0.35, now);
      overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1800, now);

      gain.gain.setValueAtTime(vel * 0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.31);

      mainOsc.connect(filter);
      overtoneOsc.connect(overGain);
      overGain.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      mainOsc.start(now);
      overtoneOsc.start(now);
      mainOsc.stop(now + 0.33);
      overtoneOsc.stop(now + 0.12);
      return;
    }

    if (note >= 60 && note <= 66) {
      const latinPitch = {
        60: 340, 61: 270,
        62: 295, 63: 245, 64: 185,
        65: 420, 66: 310
      };
      const baseF = latinPitch[note] || 250;
      const isTimbale = note === 65 || note === 66;
      const isMute = note === 62;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isTimbale ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(baseF * 1.35, now);
      osc.frequency.exponentialRampToValueAtTime(baseF, now + 0.03);

      const dur = isMute ? 0.08 : isTimbale ? 0.26 : 0.21;
      gain.gain.setValueAtTime(vel * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + dur + 0.02);
      return;
    }

    if (note === 56) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = "square";
      osc2.type = "square";
      osc1.frequency.setValueAtTime(545, now);
      osc2.frequency.setValueAtTime(815, now);

      bp.type = "bandpass";
      bp.frequency.value = 720;
      bp.Q.value = 2.5;

      gain.gain.setValueAtTime(vel * 0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(bp);
      osc2.connect(bp);
      bp.connect(gain);
      gain.connect(out);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
      return;
    }

    if (note === 73 || note === 74) {
      const dur = note === 74 ? 0.28 : 0.09;
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(dur);

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(3400, now);
      bp.Q.value = 3.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.55, now);
      if (note === 74) {
        for (let t = 0; t < 7; t++) {
          const stepT = now + (t * dur) / 7;
          gain.gain.setValueAtTime(vel * (t % 2 === 0 ? 0.65 : 0.15), stepT);
        }
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(out);
      noise.start(now);
      return;
    }

    const isLongCymbal = [46, 49, 51, 52, 55, 57].includes(note);
    const len = note === 49 || note === 57 ? 0.65 : isLongCymbal ? 0.34 : 0.075;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(len);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = note === 82 || note === 70 ? 4800 : 6800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * (isLongCymbal ? 0.45 : 0.36), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + len);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(out);
    noise.start(now);
  }

  async parseSf2Buffer(arrayBuffer, fileName, bankId = null, persist = true) {
    const ctx = this.ensureContext();
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const ascii = (offset, len) =>
      String.fromCharCode(...bytes.slice(offset, offset + len));

    if (bytes.length < 64 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "sfbk") {
      throw new Error("El archivo no es un SoundFont 2 válido (RIFF/sfbk).");
    }

    const chunks = {};
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const id = ascii(pos, 4);
      const size = view.getUint32(pos + 4, true);
      if (id === "LIST" && pos + 12 <= bytes.length) {
        pos += 12;
        continue;
      }
      chunks[id] = { offset: pos + 8, size };
      pos += 8 + size + (size % 2);
    }

    if (!chunks.smpl || !chunks.shdr) {
      throw new Error("El .SF2 no contiene bloques de audio PCM (smpl/shdr).");
    }

    const pcm16 = new Int16Array(
      arrayBuffer,
      chunks.smpl.offset,
      Math.floor(chunks.smpl.size / 2)
    );

    const shdrCount = Math.floor(chunks.shdr.size / 46);
    const parsedSamples = [];
    for (let i = 0; i < shdrCount; i++) {
      const rec = chunks.shdr.offset + i * 46;
      const name = ascii(rec, 20).replace(/\0.*$/, "").trim();
      const start = view.getUint32(rec + 20, true);
      const end = view.getUint32(rec + 24, true);
      const startLoop = view.getUint32(rec + 28, true);
      const endLoop = view.getUint32(rec + 32, true);
      const sampleRate = view.getUint32(rec + 36, true) || 44100;
      const origPitch = view.getUint8(rec + 40);
      const sampleType = view.getUint16(rec + 44, true);

      const length = end - start;
      if (!name || name === "EOS" || length <= 32 || end > pcm16.length || sampleType === 2) {
        parsedSamples.push(null);
        continue;
      }

      try {
        const audioBuf = ctx.createBuffer(1, length, Math.max(8000, Math.min(96000, sampleRate)));
        const chData = audioBuf.getChannelData(0);
        for (let s = 0; s < length; s++) {
          chData[s] = pcm16[start + s] / 32768;
        }
        const relLoopStart = Math.max(0, startLoop - start);
        const relLoopEnd = Math.min(length, endLoop - start);

        parsedSamples.push({
          id: i,
          name,
          buffer: audioBuf,
          rootKey: origPitch <= 127 ? origPitch : 60,
          sampleRate,
          loopStart: relLoopStart,
          loopEnd: relLoopEnd,
          hasLoop: relLoopEnd - relLoopStart > 64
        });
      } catch (_) {
        parsedSamples.push(null);
      }
    }

    const parsedPresets = [];
    if (chunks.phdr && chunks.pbag && chunks.pgen && chunks.inst && chunks.ibag && chunks.igen) {
      const readBags = (bagChunk, count) => {
        const list = [];
        for (let i = 0; i < count; i++) {
          list.push(view.getUint16(bagChunk.offset + i * 4, true));
        }
        return list;
      };

      const readGens = (genChunk, startIdx, endIdx) => {
        const gens = [];
        for (let g = startIdx; g < endIdx; g++) {
          const off = genChunk.offset + g * 4;
          if (off + 4 > chunks.igen.offset + chunks.igen.size && genChunk === chunks.igen) break;
          const oper = view.getUint16(off, true);
          const lo = view.getUint8(off + 2);
          const hi = view.getUint8(off + 3);
          const u16 = view.getUint16(off + 2, true);
          gens.push({ oper, lo, hi, u16 });
        }
        return gens;
      };

      const instCount = Math.floor(chunks.inst.size / 22);
      const ibags = readBags(chunks.ibag, Math.floor(chunks.ibag.size / 4));
      const instruments = [];

      for (let i = 0; i < instCount - 1; i++) {
        const rec = chunks.inst.offset + i * 22;
        const bagStart = view.getUint16(rec + 20, true);
        const bagEnd = view.getUint16(rec + 22 + 20, true);
        const zones = [];
        let globalKeyLo = 0;
        let globalKeyHi = 127;

        for (let b = bagStart; b < bagEnd && b + 1 < ibags.length; b++) {
          const gens = readGens(chunks.igen, ibags[b], ibags[b + 1]);
          let keyLo = globalKeyLo;
          let keyHi = globalKeyHi;
          let sampleId = -1;
          let overrideRoot = null;

          gens.forEach((g) => {
            if (g.oper === 43) { keyLo = g.lo; keyHi = g.hi; }
            if (g.oper === 58 && g.u16 <= 127) { overrideRoot = g.u16; }
            if (g.oper === 53) { sampleId = g.u16; }
          });

          if (sampleId === -1 && b === bagStart) {
            globalKeyLo = keyLo;
            globalKeyHi = keyHi;
          } else if (sampleId >= 0 && parsedSamples[sampleId]) {
            zones.push({
              sampleId,
              keyLo,
              keyHi,
              rootKey: overrideRoot !== null ? overrideRoot : parsedSamples[sampleId].rootKey
            });
          }
        }
        instruments.push(zones);
      }

      const phdrCount = Math.floor(chunks.phdr.size / 38);
      const pbags = readBags(chunks.pbag, Math.floor(chunks.pbag.size / 4));

      for (let p = 0; p < phdrCount - 1; p++) {
        const rec = chunks.phdr.offset + p * 38;
        const pName = ascii(rec, 20).replace(/\0.*$/, "").trim();
        const presetNum = view.getUint16(rec + 20, true);
        const bankNum = view.getUint16(rec + 22, true);
        const bagStart = view.getUint16(rec + 24, true);
        const bagEnd = view.getUint16(rec + 38 + 24, true);

        const presetZones = [];
        for (let b = bagStart; b < bagEnd && b + 1 < pbags.length; b++) {
          const gens = readGens(chunks.pgen, pbags[b], pbags[b + 1]);
          let pKeyLo = 0;
          let pKeyHi = 127;
          let instId = -1;

          gens.forEach((g) => {
            if (g.oper === 43) { pKeyLo = g.lo; pKeyHi = g.hi; }
            if (g.oper === 41) { instId = g.u16; }
          });

          if (instId >= 0 && instruments[instId]) {
            instruments[instId].forEach((iz) => {
              const lo = Math.max(pKeyLo, iz.keyLo);
              const hi = Math.min(pKeyHi, iz.keyHi);
              if (lo <= hi) {
                presetZones.push({
                  sampleId: iz.sampleId,
                  keyLo: lo,
                  keyHi: hi,
                  rootKey: iz.rootKey
                });
              }
            });
          }
        }

        if (presetZones.length > 0 && bankNum !== 128) {
          parsedPresets.push({
            name: `${String(presetNum + 1).padStart(3, "0")}: ${pName}`,
            bank: bankNum,
            program: presetNum,
            zones: presetZones
          });
        }
      }
    }

    const validFlatSamples = parsedSamples.filter(Boolean);
    if (validFlatSamples.length === 0) {
      throw new Error("No se encontraron muestras PCM reproducibles en el archivo .SF2.");
    }

    const finalPresets =
      parsedPresets.length > 0
        ? parsedPresets
        : validFlatSamples.map((s) => ({
            name: s.name,
            bank: 0,
            program: 0,
            zones: [{ sampleId: s.id, keyLo: 0, keyHi: 127, rootKey: s.rootKey }]
          }));

    const id = bankId || `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sizeMB = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2);

    const bankObj = {
      id,
      name: fileName,
      sizeMB,
      samples: parsedSamples,
      presets: finalPresets
    };

    this.sf2Banks = [bankObj, ...this.sf2Banks.filter((b) => b.id !== id)];
    this.activateSf2Bank(id, persist);
    this.rebuildSampleLibrary();

    if (persist) {
      await this.saveSf2ToStorage(id, fileName, arrayBuffer);
    }

    return this.sf2Info;
  }

  async loadSf2File(file) {
    const arrayBuffer = await file.arrayBuffer();
    return this.parseSf2Buffer(arrayBuffer, file.name, null, true);
  }

  async loadAudioFile(file, target = "song", padIndex = 0) {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (target === "pad") {
      this.padBuffers[padIndex] = { name: file.name, buffer: decoded };
      this.rebuildSampleLibrary();
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
    src.connect(this.getOutNode());
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
    src.connect(this.getOutNode());
    src.start(0);
    return true;
  }
}

window.AudioEngine = AudioEngine;
