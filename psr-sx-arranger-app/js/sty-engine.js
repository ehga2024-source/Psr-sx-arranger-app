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
    this.styleName = "Internal Rock Demo";
    this.tempo = 120;
    this.casmDetected = false;
    this.patterns = this.createDefaultRockPatterns();
  }

  createDefaultRockPatterns() {
    const emptySteps = () => Array.from({ length: 16 }, () => []);
    const map = {};

    this.sections.forEach((sec) => {
      map[sec] = {};
      for (let ch = 9; ch <= 16; ch++) {
        map[sec][ch] = emptySteps();
      }
    });

    // MAIN A: Groove de rock constante en 16 pasos
    [0, 3, 8, 10].forEach((s) => map["MAIN A"][10][s].push(36)); // Kick
    [4, 12].forEach((s) => map["MAIN A"][10][s].push(38)); // Snare
    [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => map["MAIN A"][10][s].push(42)); // Closed HH

    [0, 2, 4, 6, 8, 10].forEach((s) => map["MAIN A"][11][s].push(36)); // Bass C2
    [12, 14].forEach((s) => map["MAIN A"][11][s].push(43)); // Bass G2

    [0, 6, 10].forEach((s) => map["MAIN A"][12][s].push(60, 64, 67)); // Chord 1 (C E G)
    map["MAIN A"][13][0].push(48, 55); // Chord 2 / Pad anchor

    // FILL A: Redoble de caja y remate hacia MAIN B
    [0, 4, 8, 12].forEach((s) => map["FILL A"][10][s].push(36));
    [4, 8, 9, 10, 11, 12, 13, 14, 15].forEach((s) => map["FILL A"][10][s].push(38));
    map["FILL A"][10][15].push(49); // Crash al final
    [0, 4, 8].forEach((s) => map["FILL A"][11][s].push(36));
    map["FILL A"][11][12].push(43);
    map["FILL A"][11][14].push(47);

    // MAIN B: Estribillo más intenso
    [0, 2, 7, 8, 10, 15].forEach((s) => map["MAIN B"][10][s].push(36));
    [4, 12].forEach((s) => map["MAIN B"][10][s].push(38));
    [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => map["MAIN B"][10][s].push(46)); // Open HH
    map["MAIN B"][10][0].push(49); // Crash en pulso 1

    [0, 1, 2, 3, 4, 5, 6, 7].forEach((s) => map["MAIN B"][11][s].push(36));
    [8, 10].forEach((s) => map["MAIN B"][11][s].push(43));
    map["MAIN B"][11][12].push(45);
    map["MAIN B"][11][14].push(43);

    [0, 3, 6, 8, 11, 14].forEach((s) => map["MAIN B"][12][s].push(60, 67));
    map["MAIN B"][15][0].push(72);
    map["MAIN B"][15][3].push(71);
    map["MAIN B"][15][6].push(67);
    map["MAIN B"][15][8].push(69);
    map["MAIN B"][15][12].push(67);
    map["MAIN B"][15][14].push(64);

    // BREAK: Corte rítmico
    [0, 6, 12].forEach((s) => map["BREAK"][10][s].push(36));
    map["BREAK"][10][12].push(38);

    // INTRO A & ENDING A
    [0, 8].forEach((s) => map["INTRO A"][10][s].push(36));
    [4, 12].forEach((s) => map["INTRO A"][10][s].push(38));
    map["INTRO A"][11][0].push(36);
    map["INTRO A"][11][8].push(43);
    map["INTRO A"][12][0].push(60, 64, 67);

    [0, 6, 12, 14].forEach((s) => map["ENDING A"][10][s].push(36));
    map["ENDING A"][10][12].push(38);
    map["ENDING A"][10][15].push(49);
    map["ENDING A"][11][0].push(36);
    map["ENDING A"][11][12].push(43);
    map["ENDING A"][11][15].push(36);
    map["ENDING A"][12][0].push(60, 64, 67);
    map["ENDING A"][12][15].push(60, 64, 67, 72);

    return map;
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
    const { semitoneOffset, isMinor } = this.parseChord(chordSymbol);
    let transposed = midiNote + semitoneOffset;

    // Ajuste sencillo de tercera menor si el acorde base grabado era mayor (E -> Eb)
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
      if (buffer & 0x80) {
        buffer >>= 8;
      } else {
        break;
      }
    }
    return bytes;
  }

  buildCasmChunk() {
    // Bloque CASM mínimo estructurado para indicar raíz en Do (CMaj7)
    const csegBody = [
      ...new TextEncoder().encode("Sdec"),
      0x00, 0x00, 0x00, 0x04,
      0x00, 0x01, 0x00, 0x00,
      ...new TextEncoder().encode("Ctab"),
      0x00, 0x00, 0x00, 0x04,
      0x00, 0x3c, 0x00, 0x01 // C4 (60) / CMaj7 reference
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
    const stepTicks = 120; // 16 pasos en resolución 480 ppq

    // Tempo meta event (FF 51 03)
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
      // Marcador de sección (FF 06)
      const markerBytes = new TextEncoder().encode(sec);
      events.push({
        tick: currentTick,
        bytes: [0xff, 0x06, ...this.encodeVarLen(markerBytes.length), ...markerBytes]
      });

      for (let step = 0; step < 16; step++) {
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
      currentTick += 16 * stepTicks;
    }

    events.sort((a, b) => a.tick - b.tick);

    const trackData = [];
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;
      trackData.push(...this.encodeVarLen(delta), ...ev.bytes);
    }
    // End of Track
    trackData.push(0x00, 0xff, 0x2f, 0x00);

    const headerChunk = [
      ...new TextEncoder().encode("MThd"),
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00, // Format 0
      0x00, 0x01, // 1 track
      0x01, 0xe0  // 480 ticks per quarter note
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
