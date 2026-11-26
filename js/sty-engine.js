class StyEngine {
  constructor() {
    this.sections = [
      "INTRO A",
      "MAIN A",
      "MAIN B",
      "FILL A",
      "BREAK",
      "ENDING A"
    ];
    this.currentSection = "MAIN A";
    this.currentChord = "Cmaj7";
    this.styleName = "PSR-SX Rock Studio";
    this.tempo = 120;
    this.casmDetected = false;

    // Configuración CASM editable
    this.casmConfig = {
      sourceRoot: 0, // 0 = C
      sourceType: 1, // 1 = Maj7
      ntr: "ROOT_TRANS", // ROOT_TRANS | ROOT_FIXED
      ntt: "MELODY"      // MELODY | CHORD | BASS
    };

    // Longitud en pasos por sección (16 = 1 compás, 32 = 2 compases, 64 = 4 compases)
    this.sectionLengths = {
      "INTRO A": 32,
      "MAIN A": 32,
      "MAIN B": 32,
      "FILL A": 16,
      "BREAK": 16,
      "ENDING A": 32
    };

    this.patterns = this.createDefaultRockPatterns();
    this.clipboard = null;
  }

  createDefaultRockPatterns() {
    const emptySteps = () => Array.from({ length: 64 }, () => []);
    const map = {};

    this.sections.forEach((sec) => {
      map[sec] = {};
      for (let ch = 9; ch <= 16; ch++) {
        map[sec][ch] = emptySteps();
      }
    });

    // MAIN A (32 pasos = 2 compases con variación en el compás 2)
    for (let bar = 0; bar < 2; bar++) {
      const off = bar * 16;
      [0, 3, 8, 10].forEach((s) => map["MAIN A"][10][off + s].push(36)); // Kick
      [4, 12].forEach((s) => map["MAIN A"][10][off + s].push(38)); // Snare
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => map["MAIN A"][10][off + s].push(42)); // Closed HH
      if (bar === 1) {
        map["MAIN A"][10][off + 14].push(46); // Open HH al final del 2º compás
        map["MAIN A"][10][off + 15].push(38); // Ghost snare
      }

      [0, 2, 4, 6, 8, 10].forEach((s) => map["MAIN A"][11][off + s].push(36));
      [12, 14].forEach((s) => map["MAIN A"][11][off + s].push(bar === 0 ? 43 : 45));

      [0, 6, 10].forEach((s) => map["MAIN A"][12][off + s].push(60, 64, 67));
      map["MAIN A"][13][off + 0].push(48, 55);
    }

    // MAIN B (32 pasos = 2 compases)
    for (let bar = 0; bar < 2; bar++) {
      const off = bar * 16;
      [0, 2, 7, 8, 10, 15].forEach((s) => map["MAIN B"][10][off + s].push(36));
      [4, 12].forEach((s) => map["MAIN B"][10][off + s].push(38));
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => map["MAIN B"][10][off + s].push(46));
      if (bar === 0) map["MAIN B"][10][0].push(49);

      [0, 1, 2, 3, 4, 5, 6, 7].forEach((s) => map["MAIN B"][11][off + s].push(36));
      [8, 10].forEach((s) => map["MAIN B"][11][off + s].push(43));
      map["MAIN B"][11][off + 12].push(45);
      map["MAIN B"][11][off + 14].push(43);

      [0, 3, 6, 8, 11, 14].forEach((s) => map["MAIN B"][12][off + s].push(60, 67));
      map["MAIN B"][15][off + 0].push(72);
      map["MAIN B"][15][off + 3].push(71);
      map["MAIN B"][15][off + 6].push(67);
      map["MAIN B"][15][off + 8].push(69);
      map["MAIN B"][15][off + 12].push(67);
    }

    // FILL A (16 pasos)
    [0, 4, 8, 12].forEach((s) => map["FILL A"][10][s].push(36));
    [4, 8, 9, 10, 11, 12, 13, 14, 15].forEach((s) => map["FILL A"][10][s].push(38));
    map["FILL A"][10][15].push(49);
    [0, 4, 8].forEach((s) => map["FILL A"][11][s].push(36));
    map["FILL A"][11][12].push(43);
    map["FILL A"][11][14].push(47);

    // BREAK (16 pasos)
    [0, 6, 12].forEach((s) => map["BREAK"][10][s].push(36));
    map["BREAK"][10][12].push(38);

    // INTRO A (32 pasos)
    [0, 8, 16, 24].forEach((s) => map["INTRO A"][10][s].push(36));
    [4, 12, 20, 28, 30, 31].forEach((s) => map["INTRO A"][10][s].push(38));
    map["INTRO A"][10][31].push(49);
    [0, 16].forEach((s) => map["INTRO A"][11][s].push(36));
    [8, 24].forEach((s) => map["INTRO A"][11][s].push(43));
    [0, 16].forEach((s) => map["INTRO A"][12][s].push(60, 64, 67));

    // ENDING A (32 pasos)
    [0, 8, 16, 22, 28, 30].forEach((s) => map["ENDING A"][10][s].push(36));
    [4, 12, 20, 28].forEach((s) => map["ENDING A"][10][s].push(38));
    map["ENDING A"][10][31].push(49);
    [0, 16, 31].forEach((s) => map["ENDING A"][11][s].push(36));
    [0, 16].forEach((s) => map["ENDING A"][12][s].push(60, 64, 67));
    map["ENDING A"][12][31].push(60, 64, 67, 72);

    return map;
  }

  getSectionLength(section = this.currentSection) {
    return this.sectionLengths[section] || 16;
  }

  setSectionBars(section, bars) {
    const validBars = [1, 2, 4].includes(Number(bars)) ? Number(bars) : 2;
    this.sectionLengths[section] = validBars * 16;
  }

  duplicateBar1ToAll(section, channel) {
    const len = this.getSectionLength(section);
    const chData = this.patterns[section]?.[channel];
    if (!chData) return;
    for (let bar = 1; bar < len / 16; bar++) {
      for (let s = 0; s < 16; s++) {
        chData[bar * 16 + s] = [...chData[s]];
      }
    }
  }

  copyChannel(section, channel) {
    const chData = this.patterns[section]?.[channel];
    if (!chData) return false;
    this.clipboard = chData.map((stepNotes) => [...stepNotes]);
    return true;
  }

  pasteChannel(section, channel) {
    if (!this.clipboard || !this.patterns[section]?.[channel]) return false;
    for (let s = 0; s < 64; s++) {
      this.patterns[section][channel][s] = [...(this.clipboard[s] || [])];
    }
    return true;
  }

  clearChannel(section, channel, barIndex = null) {
    const chData = this.patterns[section]?.[channel];
    if (!chData) return;
    if (barIndex === null) {
      for (let s = 0; s < 64; s++) chData[s] = [];
    } else {
      const start = barIndex * 16;
      for (let s = start; s < start + 16; s++) chData[s] = [];
    }
  }

  transposeChannel(section, channel, semitones) {
    const chData = this.patterns[section]?.[channel];
    if (!chData) return;
    for (let s = 0; s < 64; s++) {
      chData[s] = chData[s].map((n) => Math.max(24, Math.min(108, n + semitones)));
    }
  }

  quantizeChannel(section, channel, gridStep = 2) {
    // gridStep = 2 => corcheas (pasos pares), gridStep = 4 => negras
    const chData = this.patterns[section]?.[channel];
    if (!chData) return;
    for (let s = 0; s < 64; s++) {
      if (s % gridStep !== 0 && chData[s].length > 0) {
        const target = Math.floor(s / gridStep) * gridStep;
        chData[s].forEach((n) => {
          if (!chData[target].includes(n)) chData[target].push(n);
        });
        chData[target].sort((a, b) => a - b);
        chData[s] = [];
      }
    }
  }

  parseChord(chordSymbol) {
    const roots = {
      C: 0, "C#": 1, Db: 1,
      D: 2, "D#": 3, Eb: 3,
      E: 4,
      F: 5, "F#": 6, Gb: 6,
      G: 7, "G#": 8, Ab: 8,
      A: 9, "A#": 10, Bb: 10,
      B: 11
    };

    const match = String(chordSymbol || "Cmaj7").match(/^([A-G][#b]?)(.*)$/);
    const rootName = match ? match[1] : "C";
    const quality = match ? match[2] : "maj7";
    const semitoneOffset = roots[rootName] ?? 0;
    const isMinor = /m(?!aj)/i.test(quality);

    return { rootName, quality, semitoneOffset, isMinor };
  }

  transposeNote(midiNote, chordSymbol = this.currentChord) {
    if (this.casmConfig.ntr === "ROOT_FIXED") {
      return midiNote;
    }
    const { semitoneOffset, isMinor } = this.parseChord(chordSymbol);
    let transposed = midiNote + semitoneOffset - (this.casmConfig.sourceRoot || 0);

    if (isMinor && ((midiNote - 60) % 12 + 12) % 12 === 4) {
      transposed -= 1;
    }
    return Math.max(24, Math.min(108, transposed));
  }

  toggleStepNote(section, channel, stepIndex, midiNote) {
    const list = this.patterns[section]?.[channel]?.[stepIndex];
    if (!list) return;
    const idx = list.indexOf(midiNote);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(midiNote);
      list.sort((a, b) => a - b);
    }
  }

  recordLiveNote(section, channel, stepIndex, midiNote) {
    const list = this.patterns[section]?.[channel]?.[stepIndex];
    if (!list) return;
    if (!list.includes(midiNote)) {
      list.push(midiNote);
      list.sort((a, b) => a - b);
    }
  }

  async loadStyFile(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const asciiText = new TextDecoder("latin1").decode(bytes);

    this.casmDetected = asciiText.includes("CASM");
    this.styleName = file.name.replace(/\.sty$/i, "") || "Imported Style";

    const foundSections = this.sections.filter((sec) =>
      asciiText.toUpperCase().includes(sec.toUpperCase())
    );

    if (foundSections.length > 0) {
      this.currentSection = foundSections.includes("MAIN A") ? "MAIN A" : foundSections[0];
    }

    return {
      name: this.styleName,
      sizeKB: Number((file.size / 1024).toFixed(1)),
      casmDetected: this.casmDetected,
      detectedSections: foundSections.length ? foundSections : ["MAIN A (Fallback)"]
    };
  }

  encodeVarLen(value) {
    let buffer = value & 0x7f;
    while ((value >>= 7) > 0) {
      buffer <<= 8;
      buffer |= (value & 0x7f) | 0x80;
    }
    const bytes = [];
    while (true) {
      bytes.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return bytes;
  }

  buildCasmChunk() {
    const ntrByte = this.casmConfig.ntr === "ROOT_FIXED" ? 0x01 : 0x00;
    const nttByte = this.casmConfig.ntt === "BASS" ? 0x02 : this.casmConfig.ntt === "CHORD" ? 0x01 : 0x00;
    const srcRoot = this.casmConfig.sourceRoot & 0x0f;
    const srcType = this.casmConfig.sourceType & 0x1f;

    const csegBody = [
      ...new TextEncoder().encode("Sdec"),
      0x00, 0x00, 0x00, 0x04,
      0x00, 0x01, 0x00, 0x00,
      ...new TextEncoder().encode("Ctab"),
      0x00, 0x00, 0x00, 0x06,
      0x00, srcRoot, srcType, ntrByte, nttByte, 0x01
    ];

    const csegHeader = [
      ...new TextEncoder().encode("CSEG"),
      (csegBody.length >>> 24) & 0xff,
      (csegBody.length >>> 16) & 0xff,
      (csegBody.length >>> 8) & 0xff,
      csegBody.length & 0xff
    ];

    const casmPayload = [...csegHeader, ...csegBody];
    return [
      ...new TextEncoder().encode("CASM"),
      (casmPayload.length >>> 24) & 0xff,
      (casmPayload.length >>> 16) & 0xff,
      (casmPayload.length >>> 8) & 0xff,
      casmPayload.length & 0xff,
      ...casmPayload
    ];
  }

  exportStyBlob(bpm = this.tempo) {
    const events = [];
    const stepTicks = 120; // 480 ppq

    const usPerBeat = Math.round(60000000 / Math.max(40, Math.min(280, bpm || 120)));
    events.push({
      tick: 0,
      bytes: [
        0xff, 0x51, 0x03,
        (usPerBeat >>> 16) & 0xff,
        (usPerBeat >>> 8) & 0xff,
        usPerBeat & 0xff
      ]
    });

    let currentTick = 0;
    for (const sec of this.sections) {
      const secLen = this.getSectionLength(sec);
      const markerBytes = new TextEncoder().encode(sec);
      events.push({
        tick: currentTick,
        bytes: [0xff, 0x06, ...this.encodeVarLen(markerBytes.length), ...markerBytes]
      });

      for (let step = 0; step < secLen; step++) {
        const tick = currentTick + step * stepTicks;
        for (let ch = 9; ch <= 16; ch++) {
          const notes = this.patterns[sec][ch][step] || [];
          const midiCh = ch - 1;
          notes.forEach((n) => {
            events.push({ tick, bytes: [0x90 | midiCh, n, 96] });
            events.push({ tick: tick + stepTicks - 10, bytes: [0x80 | midiCh, n, 0] });
          });
        }
      }
      currentTick += secLen * stepTicks;
    }

    events.sort((a, b) => a.tick - b.tick);

    const trackData = [];
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;
      trackData.push(...this.encodeVarLen(delta), ...ev.bytes);
    }
    trackData.push(0x00, 0xff, 0x2f, 0x00);

    const headerChunk = [
      ...new TextEncoder().encode("MThd"),
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00,
      0x00, 0x01,
      0x01, 0xe0
    ];

    const trackChunk = [
      ...new TextEncoder().encode("MTrk"),
      (trackData.length >>> 24) & 0xff,
      (trackData.length >>> 16) & 0xff,
      (trackData.length >>> 8) & 0xff,
      trackData.length & 0xff,
      ...trackData
    ];

    const casmChunk = this.buildCasmChunk();
    const fullBytes = new Uint8Array([...headerChunk, ...trackChunk, ...casmChunk]);
    return new Blob([fullBytes], { type: "application/octet-stream" });
  }
}

window.StyEngine = StyEngine;
