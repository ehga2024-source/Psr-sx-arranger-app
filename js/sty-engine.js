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
    this.styleName = "Cumbia Mexicana (Bronco Style)";
    this.activePresetId = "cumbia_mexicana";
    this.tempo = 100;
    this.casmDetected = false;

    this.casmConfig = {
      sourceRoot: 0,
      sourceType: 1,
      ntr: "ROOT_TRANS",
      ntt: "BASS"
    };

    this.channelPrograms = {
      11: 33, // Fingered Electric Bass
      12: 21, // Musette Accordion (Cumbia)
      13: 27, // Clean Stratocaster (XG)
      14: 48, // Stereo Strings Ensemble
      15: 61, // Brass Section (XG)
      16: 23  // Tango / Vallenato-Mex Accordion
    };

    this.sectionLengths = {
      "INTRO A": 32,
      "MAIN A": 32,
      "MAIN B": 32,
      "FILL A": 16,
      "BREAK": 16,
      "ENDING A": 32
    };

    this.library = [
      {
        id: "cumbia_mexicana",
        name: "Cumbia Mexicana (Bronco Style)",
        category: "Cumbia Mexicana",
        bpm: 100,
        description: "Bajo octavado y quinta mexicana, acordeón, güiro continuo y tarola."
      },
      {
        id: "cumbia_sonidera",
        name: "Cumbia Norteña / Sonidera",
        category: "Cumbia Mexicana",
        bpm: 102,
        description: "Groove bailable con bajo sincopado, congas, cowbell y remate SPD-20."
      },
      {
        id: "cumbia_clasica",
        name: "Cumbia Sureña Tumbado",
        category: "Cumbia Base",
        bpm: 104,
        description: "Tónica-tercera-quinta con guajeo en contratiempo y güiro largo/corto."
      },
      {
        id: "spd20_grooves",
        name: "SPD-20 Perc & Toms Studio",
        category: "SPD-20 / Toms",
        bpm: 112,
        description: "Énfasis en toms electrónicos/acústicos, rimshot, crash y bajo punch."
      }
    ];

    this.patterns = this.buildPresetPatterns("cumbia_mexicana");
    this.clipboard = null;
  }

  createEmptyMap() {
    const map = {};
    this.sections.forEach((sec) => {
      map[sec] = {};
      for (let ch = 9; ch <= 16; ch++) {
        map[sec][ch] = Array.from({ length: 64 }, () => []);
      }
    });
    return map;
  }

  buildPresetPatterns(presetId = "cumbia_mexicana") {
    const map = this.createEmptyMap();

    if (presetId === "spd20_grooves") {
      for (let bar = 0; bar < 2; bar++) {
        const off = bar * 16;
        [0, 3, 6, 8, 11, 14].forEach((s) => map["MAIN A"][10][off + s].push(36));
        [4, 12].forEach((s) => map["MAIN A"][10][off + s].push(38));
        [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => map["MAIN A"][10][off + s].push(42));
        map["MAIN A"][10][off + 13].push(50);
        map["MAIN A"][10][off + 15].push(47);

        [0, 4, 8, 12].forEach((s) => map["MAIN A"][11][off + s].push(36));
        [6, 14].forEach((s) => map["MAIN A"][11][off + s].push(43));
        [2, 6, 10, 14].forEach((s) => map["MAIN A"][12][off + s].push(60, 64, 67));
      }
    } else if (presetId === "cumbia_clasica") {
      for (let bar = 0; bar < 2; bar++) {
        const off = bar * 16;
        [0, 4, 8, 12].forEach((s) => map["MAIN A"][10][off + s].push(36, 56, 74));
        [2, 3, 6, 7, 10, 11, 14, 15].forEach((s) => map["MAIN A"][10][off + s].push(73));
        [2, 6, 10, 14].forEach((s) => map["MAIN A"][9][off + s].push(62));
        [4, 12].forEach((s) => map["MAIN A"][9][off + s].push(63));
        [7, 15].forEach((s) => map["MAIN A"][9][off + s].push(64));

        map["MAIN A"][11][off + 0].push(36);
        map["MAIN A"][11][off + 3].push(40);
        map["MAIN A"][11][off + 4].push(43);
        map["MAIN A"][11][off + 8].push(36);
        map["MAIN A"][11][off + 11].push(40);
        map["MAIN A"][11][off + 12].push(43);
        [2, 6, 10, 14].forEach((s) => map["MAIN A"][12][off + s].push(60, 64, 67));
      }
    } else {
      // CUMBIA MEXICANA (Bronco / Grupera Mexicana) y Cumbia Norteña/Sonidera
      const isNortena = presetId === "cumbia_sonidera";
      for (let bar = 0; bar < 2; bar++) {
        const off = bar * 16;

        // CH 10: Bombo en 0, 4, 8, 12; Tarola/Caja en 4, 12; Güiro mexicano constante
        [0, 4, 8, 12].forEach((s) => {
          map["MAIN A"][10][off + s].push(36);
          if (isNortena) map["MAIN A"][10][off + s].push(56);
        });
        [4, 12].forEach((s) => map["MAIN A"][10][off + s].push(38));
        for (let s = 0; s < 16; s += 2) {
          map["MAIN A"][10][off + s].push(73);
        }
        map["MAIN A"][10][off + 14].push(74);

        // CH 9: Congas y timbal característico de cumbia mexicana
        [2, 6, 10, 14].forEach((s) => map["MAIN A"][9][off + s].push(65));
        [4, 12].forEach((s) => map["MAIN A"][9][off + s].push(63));
        if (bar === 1) map["MAIN A"][9][off + 15].push(66);

        // CH 11: Bajo estilo Cumbia Mexicana (C2 -> G2 -> C3 octava -> G2)
        map["MAIN A"][11][off + 0].push(36);
        map["MAIN A"][11][off + 3].push(43);
        map["MAIN A"][11][off + 4].push(48);
        map["MAIN A"][11][off + 7].push(43);
        map["MAIN A"][11][off + 8].push(36);
        map["MAIN A"][11][off + 11].push(43);
        map["MAIN A"][11][off + 12].push(48);
        map["MAIN A"][11][off + 14].push(isNortena ? 45 : 43);

        // CH 12: Acordeón / Teclado mexicano en contratiempo y remate de compás
        [2, 6, 10, 14].forEach((s) => map["MAIN A"][12][off + s].push(60, 64, 67));
        if (bar === 1) {
          map["MAIN A"][15][off + 12].push(67);
          map["MAIN A"][15][off + 14].push(71);
          map["MAIN A"][15][off + 15].push(72);
        }
      }
    }

    // MAIN B (32 pasos): Coro / Estribillo más lleno
    for (let bar = 0; bar < 2; bar++) {
      const off = bar * 16;
      [0, 4, 8, 12].forEach((s) => map["MAIN B"][10][off + s].push(36, 56));
      [4, 12].forEach((s) => map["MAIN B"][10][off + s].push(38));
      for (let s = 0; s < 16; s += 2) map["MAIN B"][10][off + s].push(73);
      map["MAIN B"][10][off + 14].push(74);
      if (bar === 0) map["MAIN B"][10][0].push(49);

      [2, 6, 10, 14].forEach((s) => map["MAIN B"][9][off + s].push(65));
      [4, 12, 15].forEach((s) => map["MAIN B"][9][off + s].push(66));

      [0, 8].forEach((s) => map["MAIN B"][11][off + s].push(36));
      [3, 11].forEach((s) => map["MAIN B"][11][off + s].push(43));
      [4, 12].forEach((s) => map["MAIN B"][11][off + s].push(48));
      [6, 14].forEach((s) => map["MAIN B"][11][off + s].push(43));

      [2, 6, 10, 14].forEach((s) => map["MAIN B"][12][off + s].push(60, 64, 67));
      map["MAIN B"][15][off + 0].push(72);
      map["MAIN B"][15][off + 4].push(67);
      map["MAIN B"][15][off + 8].push(64);
      map["MAIN B"][15][off + 12].push(67);
    }

    // FILL A (16 pasos): Remate de toms SPD-20 y caja
    [0, 4, 8, 12].forEach((s) => map["FILL A"][10][s].push(36));
    map["FILL A"][10][4].push(38);
    map["FILL A"][10][6].push(50);
    map["FILL A"][10][8].push(47);
    map["FILL A"][10][10].push(43);
    map["FILL A"][10][12].push(41);
    map["FILL A"][10][14].push(38);
    map["FILL A"][10][15].push(49);

    // BREAK (16 pasos)
    map["BREAK"][10][0].push(36, 49);
    map["BREAK"][10][8].push(56);
    map["BREAK"][10][12].push(38, 50);
    map["BREAK"][10][14].push(43);

    // INTRO A (32 pasos)
    for (let bar = 0; bar < 2; bar++) {
      const off = bar * 16;
      [0, 4, 8, 12].forEach((s) => map["INTRO A"][10][off + s].push(36, 73));
      map["INTRO A"][11][off + 0].push(36);
      map["INTRO A"][11][off + 4].push(43);
      map["INTRO A"][11][off + 8].push(48);
      map["INTRO A"][11][off + 12].push(43);
      [2, 6, 10, 14].forEach((s) => map["INTRO A"][12][off + s].push(60, 64, 67));
    }
    map["INTRO A"][10][28].push(50);
    map["INTRO A"][10][30].push(43);
    map["INTRO A"][10][31].push(49);

    // ENDING A (32 pasos)
    [0, 4, 8, 12, 16, 24, 31].forEach((s) => map["ENDING A"][10][s].push(36));
    map["ENDING A"][10][28].push(50);
    map["ENDING A"][10][29].push(47);
    map["ENDING A"][10][30].push(43);
    map["ENDING A"][10][31].push(49);
    map["ENDING A"][11][0].push(36);
    map["ENDING A"][11][16].push(48);
    map["ENDING A"][11][31].push(36);
    map["ENDING A"][12][31].push(60, 64, 67, 72);

    return map;
  }

  selectLibraryStyle(presetId) {
    const item = this.library.find((x) => x.id === presetId);
    if (!item) return null;
    this.activePresetId = item.id;
    this.styleName = item.name;
    this.tempo = item.bpm;
    this.patterns = this.buildPresetPatterns(item.id);
    return item;
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
    this.activePresetId = `custom_${Date.now()}`;

    const foundSections = this.sections.filter((sec) =>
      asciiText.toUpperCase().includes(sec.toUpperCase())
    );

    if (foundSections.length > 0) {
      this.currentSection = foundSections.includes("MAIN A") ? "MAIN A" : foundSections[0];
    }

    if (!this.library.some((x) => x.name === this.styleName)) {
      this.library.unshift({
        id: this.activePresetId,
        name: this.styleName,
        category: "User .STY",
        bpm: this.tempo,
        description: `Estilo cargado (${infoSizeOrDefault(file.size)} KB)`
      });
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
    const stepTicks = 120;

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

    Object.entries(this.channelPrograms).forEach(([ch, prog]) => {
      const midiCh = Number(ch) - 1;
      events.push({ tick: 0, bytes: [0xc0 | midiCh, prog & 0x7f] });
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
            events.push({ tick, bytes: [0x90 | midiCh, n, 100] });
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

function infoSizeOrDefault(bytes) {
  return ((bytes || 0) / 1024).toFixed(1);
}

window.StyEngine = StyEngine;
