(function () {
  const audio = new window.AudioEngine();
  const sty = new window.StyEngine();

  let isPlaying = false;
  let stepTimer = null;
  let currentStep = 0;
  let activeTab = "sounds";
  let creatorChannel = 10;
  let creatorBarView = 0;
  let isRecording = false;
  let tapTimes = [];
  let libraryFilter = "ALL";
  let activeSoundFolder = "roland_xp10";
  let soundSearchQuery = "";
  let targetPadForAssign = 0;
  let padQuickAssignOpen = false;
  let padAssignMode = false;

  const BANK_COUNT = 15;
  const STORAGE_BANKS_KEY = "psr_sx_memory_banks_15_v1_cmaj";

  // Acorde inicial en C mayor ("C")
  sty.currentChord = "C";

  function makeEmptyPads() {
    return [
      { label: "PAD 1", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: null, customSoundName: "", customSoundNote: 60, customIsDrum: false },
      { label: "PAD 2", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: null, customSoundName: "", customSoundNote: 60, customIsDrum: false },
      { label: "PAD 3", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: null, customSoundName: "", customSoundNote: 60, customIsDrum: false },
      { label: "PAD 4", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: null, customSoundName: "", customSoundNote: 60, customIsDrum: false }
    ];
  }

  function defaultMemoryBanks() {
    const presets = {
      0: {
        name: "XP-10 / N364",
        styleId: sty.library[0]?.id || "",
        section: "MAIN A",
        pads: [
          { label: "PAD 1", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 21, customSoundName: "Norteño Accordion", customSoundNote: 60, customIsDrum: false },
          { label: "PAD 2", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 61, customSoundName: "XP Brass Section", customSoundNote: 60, customIsDrum: false },
          { label: "PAD 3", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 33, customSoundName: "N364 Finger Bass", customSoundNote: 36, customIsDrum: false },
          { label: "PAD 4", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 10, customSoundName: "Cumbia Güiro & Timbal", customSoundNote: 73, customIsDrum: true }
        ]
      },
      1: {
        name: "GM / XG LEADS",
        styleId: sty.library[0]?.id || "",
        section: "MAIN A",
        pads: [
          { label: "PAD 1", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 0, customSoundName: "Acoustic Grand Piano", customSoundNote: 60, customIsDrum: false },
          { label: "PAD 2", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 27, customSoundName: "Electric Guitar (Clean)", customSoundNote: 60, customIsDrum: false },
          { label: "PAD 3", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 48, customSoundName: "String Ensemble 1", customSoundNote: 60, customIsDrum: false },
          { label: "PAD 4", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 81, customSoundName: "Lead 2 (Sawtooth)", customSoundNote: 60, customIsDrum: false }
        ]
      },
      2: {
        name: "SPD-20 PERC",
        styleId: sty.library[0]?.id || "",
        section: "MAIN A",
        pads: [
          { label: "PAD 1", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 10, customSoundName: "Standard Kit (GM/XG)", customSoundNote: 36, customIsDrum: true },
          { label: "PAD 2", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 10, customSoundName: "SPD-20 Toms & Rimshot", customSoundNote: 50, customIsDrum: true },
          { label: "PAD 3", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 10, customSoundName: "Congas & Cowbell Mex", customSoundNote: 63, customIsDrum: true },
          { label: "PAD 4", sourceType: "gm", sampleUid: "", styleId: "", section: "MAIN A", customSoundProgram: 10, customSoundName: "Cumbia Güiro & Timbal", customSoundNote: 73, customIsDrum: true }
        ]
      }
    };

    const banks = [];
    for (let i = 0; i < BANK_COUNT; i++) {
      const code = `B${String(i + 1).padStart(2, "0")}`;
      const p = presets[i];
      banks.push({
        id: code,
        name: p ? p.name : `BANK ${String(i + 1).padStart(2, "0")}`,
        styleId: p ? p.styleId : "",
        section: p ? p.section : "MAIN A",
        pads: p ? p.pads : makeEmptyPads()
      });
    }
    return banks;
  }

  function normalizeBanks(rawBanks) {
    const fallback = defaultMemoryBanks();
    if (!Array.isArray(rawBanks) || rawBanks.length === 0) return fallback;
    const out = [];
    for (let i = 0; i < BANK_COUNT; i++) {
      const item = rawBanks[i];
      const base = fallback[i];
      if (item && typeof item === "object") {
        const pads = Array.isArray(item.pads) && item.pads.length === 4 ? item.pads : base.pads;
        out.push({
          id: `B${String(i + 1).padStart(2, "0")}`,
          name: (item.name || base.name).toString().slice(0, 18),
          styleId: item.styleId || "",
          section: item.section || "MAIN A",
          pads
        });
      } else {
        out.push(base);
      }
    }
    return out;
  }

  function loadSavedMemoryBanks() {
    try {
      const raw = localStorage.getItem(STORAGE_BANKS_KEY);
      if (raw) {
        return normalizeBanks(JSON.parse(raw));
      }
    } catch (_) {}
    return defaultMemoryBanks();
  }

  function saveMemoryBanks() {
    try {
      localStorage.setItem(STORAGE_BANKS_KEY, JSON.stringify(state.memoryBanks));
    } catch (_) {}
  }

  const state = {
    acmp: true,
    autoFill: true,
    syncStart: true,
    syncStop: false,
    leftHold: false,
    harmony: false,
    transpose: 0,
    pitchBendSemis: 0,
    activeMemoryBank: 0,
    memoryBanks: loadSavedMemoryBanks(),
    parts: {
      r1: { on: true, program: 21 },
      r2: { on: false, program: 61 },
      left: { on: true, program: 33 }
    },
    otsPresets: [
      { r1: 21, r2: 61, r2On: false, label: "OTS 1: Accordion" },
      { r1: 61, r2: 56, r2On: true, label: "OTS 2: Brass" },
      { r1: 0, r2: 48, r2On: true, label: "OTS 3: Piano + Strings" },
      { r1: 27, r2: 33, r2On: false, label: "OTS 4: Clean Gtr + Bass" }
    ],
    activeOts: 0,
    channelVolumes: {
      9: 98, 10: 114, 11: 116, 12: 92, 13: 86, 14: 80, 15: 96, 16: 96
    }
  };

  const el = {
    btnStartStop: document.getElementById("btnStartStop"),
    btnTapTempo: document.getElementById("btnTapTempo"),
    inputTempo: document.getElementById("inputTempo"),
    chordDisplay: document.getElementById("chordDisplay"),
    lcdStyleName: document.getElementById("lcdStyleName"),
    lcdSectionBadge: document.getElementById("lcdSectionBadge"),
    tabContent: document.getElementById("tabContent"),
    keyboard: document.getElementById("keyboard"),
    midiStatus: document.getElementById("midiStatus"),
    transposeVal: document.getElementById("transposeVal"),
    masterVolume: document.getElementById("masterVolume")
  };

  if (el.chordDisplay) el.chordDisplay.textContent = "C";
  if (el.lcdStyleName) el.lcdStyleName.textContent = sty.styleName || "C Mayor — Style Converter";
  el.inputTempo.value = sty.tempo || 100;

  function getActiveBank() {
    return state.memoryBanks[state.activeMemoryBank] || state.memoryBanks[0];
  }

  function getSampleNameByUid(uid, padCfg = null) {
    if (uid) {
      const found = audio.sampleLibrary.find((s) => s.uid === uid);
      if (found) return found.name;
      if (padCfg && padCfg.customSoundName) return padCfg.customSoundName;
      return "Sample SF2/WAV Guardado";
    }
    if (padCfg && padCfg.customSoundName) {
      return padCfg.customSoundName;
    }
    return "Sin Asignar";
  }

  function getStyleNameById(styleId) {
    if (!styleId) return "Sin Style";
    const found = sty.library.find((st) => st.id === styleId);
    return found ? found.name : sty.styleName;
  }

  function syncOtsBankUi() {
    const bank = getActiveBank();
    const screen = document.getElementById("otsBankScreen");
    if (screen && bank) {
      screen.textContent = `${bank.id} • ${bank.name}`;
    }

    document.querySelectorAll(".ots-btn").forEach((btn) => {
      const idx = Number(btn.dataset.ots);
      const padCfg = bank?.pads?.[idx];
      const soundLabel = padCfg ? getSampleNameByUid(padCfg.sampleUid, padCfg) : "";
      if (soundLabel && soundLabel !== "Sin Asignar") {
        btn.title = `OTS ${idx + 1}: ${soundLabel}`;
      }
      btn.classList.toggle("active", idx === state.activeOts);
    });
  }

  async function stepMemoryBank(delta) {
    const total = state.memoryBanks.length;
    state.activeMemoryBank = (state.activeMemoryBank + delta + total) % total;
    const bank = getActiveBank();
    if (bank?.styleId) {
      await applyLibraryStyle(bank.styleId, bank.section || "MAIN A");
    }
    syncOtsBankUi();
    if (activeTab === "main" || activeTab === "sounds" || activeTab === "files") {
      renderTab();
    }
  }

  function getStepIntervalMs() {
    const bpm = Math.max(40, Math.min(280, Number(el.inputTempo.value) || 100));
    return (60000 / bpm) / 4;
  }

  function updateBeatLeds(stepIndex) {
    const stepInBar = stepIndex % 16;
    const beat = Math.floor(stepInBar / 4);
    const isBeatStart = stepInBar % 4 === 0;
    document.querySelectorAll(".beat-dot").forEach((dot, idx) => {
      dot.classList.remove("on", "on-first");
      if (isPlaying && isBeatStart && idx === beat) {
        dot.classList.add(idx === 0 ? "on-first" : "on");
      }
    });
  }

  function playStep(stepIndex) {
    updateBeatLeds(stepIndex);

    if (stepIndex === 0 && sty.currentSection === "FILL A" && state.autoFill) {
      setSection("MAIN B", true);
    }

    const sec = sty.currentSection;
    const secData = sty.patterns[sec];
    if (!secData) return;

    [9, 10].forEach((ch) => {
      const vol = (state.channelVolumes[ch] ?? 105) / 127;
      (secData[ch]?.[stepIndex] || []).forEach((n) => audio.playDrum(n, vol));
    });

    if (!state.acmp) {
      highlightCreatorStep(stepIndex);
      return;
    }

    const bassVol = (state.channelVolumes[11] ?? 112) / 127;
    const bassProg = sty.channelPrograms[11] ?? 33;
    (secData[11]?.[stepIndex] || []).forEach((n) => {
      const transposed = sty.transposeNote(n, sty.currentChord) + state.transpose;
      audio.playNote(transposed, 0.28, bassVol, bassProg, "bass");
    });

    [12, 13, 14, 15, 16].forEach((ch) => {
      const vol = (state.channelVolumes[ch] ?? 88) / 127;
      const prog = sty.channelPrograms[ch] ?? 21;
      (secData[ch]?.[stepIndex] || []).forEach((n) => {
        const transposed = sty.transposeNote(n, sty.currentChord) + state.transpose;
        audio.playNote(transposed, 0.24, vol * 0.72, prog, "chord");
      });
    });

    highlightCreatorStep(stepIndex);
  }

  function startPlayback() {
    if (isPlaying) return;
    audio.ensureContext();
    isPlaying = true;
    currentStep = 0;
    el.btnStartStop.classList.add("active");

    const tick = () => {
      if (!isPlaying) return;
      const totalSteps = sty.getSectionLength(sty.currentSection);
      if (currentStep >= totalSteps) currentStep = 0;
      playStep(currentStep);
      currentStep = (currentStep + 1) % totalSteps;
      stepTimer = setTimeout(tick, getStepIntervalMs());
    };
    tick();
  }

  function stopPlayback() {
    isPlaying = false;
    isRecording = false;
    if (stepTimer) {
      clearTimeout(stepTimer);
      stepTimer = null;
    }
    el.btnStartStop.classList.remove("active");
    updateBeatLeds(-1);
    highlightCreatorStep(-1);
  }

  function setChord(chordSymbol) {
    sty.currentChord = chordSymbol;
    if (el.chordDisplay) el.chordDisplay.textContent = chordSymbol;
    document.querySelectorAll(".chord-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.chord === chordSymbol);
    });
    if (activeTab === "main") renderMainTab();
  }

  function setSection(sectionName, skipAutoFill = false) {
    if (!sty.sections.includes(sectionName)) return;

    if (!skipAutoFill && state.autoFill && isPlaying && sectionName === "MAIN B" && sty.currentSection === "MAIN A") {
      sty.currentSection = "FILL A";
    } else {
      sty.currentSection = sectionName;
    }

    const maxBars = sty.getSectionLength(sty.currentSection) / 16;
    if (creatorBarView >= maxBars) creatorBarView = 0;

    if (el.lcdSectionBadge) el.lcdSectionBadge.textContent = `${sty.currentSection} (${maxBars}B)`;
    document.querySelectorAll(".style-sec").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === sty.currentSection);
    });
    if (activeTab === "main" || activeTab === "creator") renderTab();
  }

  async function applyLibraryStyle(styleId, section = null) {
    if (!styleId) return;
    const item = await sty.selectLibraryStyle(styleId);
    if (!item) return;
    el.inputTempo.value = item.bpm;
    if (el.lcdStyleName) el.lcdStyleName.textContent = item.name;
    setSection(section || "MAIN A", true);
  }

  function openPadSampleSelector(padIdx) {
    targetPadForAssign = padIdx;
    padQuickAssignOpen = true;
    activeTab = "main";
    document.querySelectorAll(".tft-tab").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === "main")
    );
    renderMainTab();
  }

  async function triggerMemoryPad(padIdx) {
    audio.ensureContext();
    if (padAssignMode) {
      openPadSampleSelector(padIdx);
      return;
    }

    const bank = getActiveBank();
    const padCfg = bank.pads[padIdx];
    if (!padCfg) return;

    const chosenStyle = padCfg.styleId || bank.styleId;
    if (chosenStyle) {
      await applyLibraryStyle(chosenStyle, padCfg.section || bank.section || "MAIN A");
    }

    const note = (padCfg.customSoundNote || 60) + state.transpose;

    if (padCfg.sampleUid) {
      const ok = audio.playSampleLibraryItem(padCfg.sampleUid, note, 0.5, 0.92);
      if (!ok && padCfg.customSoundProgram !== null && padCfg.customSoundProgram !== undefined) {
        audio.playSynthInstrument(padCfg.customSoundProgram, note, 0.45, 0.9);
      }
    } else if (audio.padBuffers[padIdx]) {
      audio.triggerPad(padIdx);
    } else if (padCfg.customSoundProgram !== null && padCfg.customSoundProgram !== undefined) {
      if (padCfg.customIsDrum) audio.playDrum(padCfg.customSoundNote || 36, 0.92);
      else audio.playSynthInstrument(padCfg.customSoundProgram, note, 0.45, 0.9);
    }

    document.querySelectorAll(".pad-btn").forEach((btn, i) => {
      btn.classList.toggle("active", i === padIdx);
    });
    if (activeTab === "main") renderMainTab();
  }

  function applyPadConfigToVoice(padCfg, playPreview = true) {
    if (!padCfg) return false;
    const note = (padCfg.customSoundNote || 60) + state.transpose;

    if (padCfg.sampleUid) {
      if (padCfg.sampleUid.startsWith("sf2:")) {
        const parts = padCfg.sampleUid.split(":");
        const bankId = parts[1];
        const pIdx = Number(parts[2]);
        const bank = audio.sf2Banks.find((b) => b.id === bankId);
        if (bank) {
          audio.sf2Banks = [bank, ...audio.sf2Banks.filter((b) => b.id !== bankId)];
          audio.activeSf2BankId = bank.id;
          audio.sf2Samples = bank.samples;
          audio.sf2Presets = bank.presets;
          audio.sf2Enabled = true;
          audio.sf2Assignments.r1 = pIdx;
        }
      } else {
        audio.sf2Enabled = false;
        audio.sf2Assignments.r1 = -1;
      }

      state.parts.r1.on = true;
      document.getElementById("btnPartR1")?.classList.add("active");
      if (playPreview) {
        audio.playSampleLibraryItem(padCfg.sampleUid, note, 0.45, 0.9);
      }
      return true;
    }

    const padSlotMatch = padCfg.sampleUid?.startsWith("pad:")
      ? Number(padCfg.sampleUid.split(":")[1])
      : -1;
    if (padSlotMatch >= 0 && audio.padBuffers[padSlotMatch]) {
      audio.sf2Enabled = false;
      audio.sf2Assignments.r1 = -1;
      state.parts.r1.on = true;
      document.getElementById("btnPartR1")?.classList.add("active");
      if (playPreview) {
        audio.triggerPad(padSlotMatch);
      }
      return true;
    }

    if (padCfg.customSoundProgram !== null && padCfg.customSoundProgram !== undefined) {
      const prog = Number(padCfg.customSoundProgram);
      audio.selectGmXgProgram(prog, "r1");
      state.parts.r1.program = prog;
      state.parts.r1.on = true;
      document.getElementById("btnPartR1")?.classList.add("active");

      if (playPreview) {
        if (padCfg.customIsDrum) audio.playDrum(padCfg.customSoundNote || 36, 0.9);
        else audio.playSynthInstrument(prog, note, 0.4, 0.88);
      }
      return true;
    }

    return false;
  }

  function applyOts(index) {
    audio.ensureContext();
    const bank = getActiveBank();
    const padCfg = bank?.pads?.[index];
    state.activeOts = index;

    const hasAssignedPad = applyPadConfigToVoice(padCfg, true);

    if (!hasAssignedPad) {
      const preset = state.otsPresets[index];
      if (!preset) return;
      audio.sf2Enabled = false;
      audio.sf2Assignments.r1 = -1;
      audio.sf2Assignments.r2 = -1;
      state.parts.r1.program = preset.r1;
      state.parts.r1.on = true;
      state.parts.r2.program = preset.r2;
      state.parts.r2.on = preset.r2On;
      document.getElementById("btnPartR1")?.classList.toggle("active", state.parts.r1.on);
      document.getElementById("btnPartR2")?.classList.toggle("active", state.parts.r2.on);
      audio.playSynthInstrument(preset.r1, 60 + state.transpose, 0.38, 0.85);
    }

    syncOtsBankUi();
    if (activeTab === "main") renderMainTab();
  }

  function playLeadOrLeftNote(midiNote, velocity = 0.85) {
    audio.ensureContext();
    const finalNote = midiNote + state.transpose + state.pitchBendSemis;
    if (midiNote <= 54) {
      const chordMap = {
        48: "C", 49: "Db", 50: "Dm", 51: "Eb",
        52: "Em", 53: "F", 54: "F#"
      };
      if (chordMap[midiNote]) setChord(chordMap[midiNote]);
      if (state.syncStart && !isPlaying && state.acmp) startPlayback();
      if (state.parts.left.on) {
        audio.playNote(finalNote, state.leftHold ? 0.9 : 0.4, velocity * 0.85, state.parts.left.program, "left");
      }
      return;
    }

    if (state.parts.r1.on) {
      audio.playNote(finalNote, 0.45, velocity * 0.9, state.parts.r1.program, "r1");
    }
    if (state.parts.r2.on) {
      audio.playNote(finalNote, 0.48, velocity * 0.65, state.parts.r2.program, "r2");
    }
    if (state.harmony) {
      audio.playNote(finalNote - 5, 0.4, velocity * 0.55, state.parts.r1.program, "r1");
    }
  }

  function buildVoiceOptions(selectedProg) {
    return Object.entries(window.GM_XG_MAP || {})
      .map(
        ([prog, name]) =>
          `<option value="${prog}" ${Number(prog) === Number(selectedProg) ? "selected" : ""}>${name}</option>`
      )
      .join("");
  }

  function buildSf2PresetOptions(selectedIdx) {
    const base = `<option value="-1" ${selectedIdx < 0 ? "selected" : ""}>Internal GM/XG Engine</option>`;
    const list = audio.sf2Presets
      .map(
        (p, idx) =>
          `<option value="${idx}" ${idx === selectedIdx ? "selected" : ""}>[SF2] ${p.name}</option>`
      )
      .join("");
    return base + list;
  }

  function renderMainTab() {
    syncOtsBankUi();
    const bank = getActiveBank();
    const hasSf2 = audio.sf2Presets.length > 0;
    const editingPad = bank.pads[targetPadForAssign] || bank.pads[0];

    const bankButtons = state.memoryBanks
      .map(
        (b, idx) =>
          `<button class="hw-btn small ${
            idx === state.activeMemoryBank ? "led-amber active" : ""
          }" data-mem-bank="${idx}" style="padding:2px 5px;font-size:0.58rem;">${b.id}</button>`
      )
      .join("");

    const styleSelectOptions =
      `<option value="">-- Sin style --</option>` +
      sty.library
        .map(
          (st) =>
            `<option value="${st.id}" ${st.id === bank.styleId ? "selected" : ""}>${st.name} (${st.bpm})</option>`
        )
        .join("");

    const padSlotsHtml = bank.pads
      .map((p, idx) => {
        const sName = getSampleNameByUid(p.sampleUid, p);
        const tag = p.sampleUid?.startsWith("sf2:")
          ? "SF2"
          : p.sampleUid?.startsWith("pad:")
          ? "WAV"
          : "GM/XG";
        const isEditing = padQuickAssignOpen && targetPadForAssign === idx;
        return `
          <div style="background:${isEditing ? "#122947" : "#0a1523"};border:1px solid ${
            isEditing ? "#fbbf24" : "#234770"
          };border-radius:4px;padding:4px 6px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
            <button type="button" data-open-pad-samples="${idx}" style="all:unset;cursor:pointer;flex:1;overflow:hidden;">
              <div style="font-size:0.65rem;font-weight:800;color:#38bdf8;">${p.label} <span style="color:#fbbf24;font-size:0.54rem;">[${tag}]</span></div>
              <div style="font-size:0.6rem;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sName}</div>
            </button>
            <div style="display:flex;gap:3px;flex-shrink:0;">
              <button class="hw-btn small" data-open-pad-samples="${idx}" style="padding:2px 5px;font-size:0.56rem;">SAMPLE</button>
              <button class="hw-btn small led-red active" data-lcd-pad="${idx}" style="padding:2px 6px;font-size:0.58rem;">▶</button>
            </div>
          </div>
        `;
      })
      .join("");

    const sampleChoicesHtml = [
      `<optgroup label="GM / XG / XP-10 / N364">`,
      ...Object.entries(window.GM_XG_MAP || {}).map(
        ([prog, name]) => `<option value="gm:${prog}">${name}</option>`
      ),
      `</optgroup>`,
      ...(audio.sampleLibrary.length > 0
        ? [
            `<optgroup label="SF2 / WAV Cargados">`,
            ...audio.sampleLibrary.map(
              (item) => `<option value="lib:${item.uid}">${item.name}</option>`
            ),
            `</optgroup>`
          ]
        : [])
    ].join("");

    const quickAssignBox = padQuickAssignOpen
      ? `
        <div style="background:#0d1f36;border:1px solid #fbbf24;border-radius:5px;padding:6px;display:flex;flex-direction:column;gap:5px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:wrap;">
            <span style="font-size:0.66rem;font-weight:800;color:#fbbf24;">ASIGNAR SAMPLE → ${bank.id} / ${editingPad.label}</span>
            <button id="btnClosePadQuick" class="hw-btn small" style="padding:2px 6px;font-size:0.58rem;">✕ CERRAR</button>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
            <select id="quickPadSampleSel" style="flex:1;min-width:140px;background:#13253b;color:#fff;border:1px solid #38bdf8;border-radius:4px;padding:3px 5px;font-size:0.64rem;">
              <option value="">Selecciona sample GM / XG / SF2 / WAV...</option>
              ${sampleChoicesHtml}
            </select>
            <label style="font-size:0.6rem;color:#93c5fd;">+ SF2: <input type="file" id="quickSf2File" accept=".sf2" style="max-width:95px;font-size:0.56rem;" /></label>
            <label style="font-size:0.6rem;color:#93c5fd;">+ WAV: <input type="file" id="quickWavFile" accept=".wav,.mp3,audio/*" style="max-width:95px;font-size:0.56rem;" /></label>
          </div>
        </div>
      `
      : "";

    const r1Name =
      audio.sf2Enabled && hasSf2 && audio.sf2Assignments.r1 >= 0 && audio.sf2Presets[audio.sf2Assignments.r1]
        ? `[SF2] ${audio.sf2Presets[audio.sf2Assignments.r1].name}`
        : window.resolveXgVoice(state.parts.r1.program, 0, 112).split(" (")[0];

    const activeOtsPad = bank.pads[state.activeOts];
    const activeOtsLabel = activeOtsPad
      ? `OTS ${state.activeOts + 1} ← ${activeOtsPad.label}: ${getSampleNameByUid(activeOtsPad.sampleUid, activeOtsPad)}`
      : state.otsPresets[state.activeOts].label;

    el.tabContent.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow-y:auto;gap:5px;padding-right:2px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:wrap;background:#0a1626;padding:4px 6px;border-radius:5px;border:1px solid #264d7a;flex-shrink:0;">
          <div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:0.62rem;font-weight:800;color:#fbbf24;">${bank.id}: ${bank.name}</span>
            ${bankButtons}
          </div>
          <div style="display:flex;gap:4px;align-items:center;">
            <button id="btnTogglePadAssignMode" class="hw-btn small ${padAssignMode ? "led-blue active" : ""}" style="padding:2px 6px;font-size:0.58rem;">✎ EDIT PAD</button>
            <button id="btnSaveMemBank" class="hw-btn small led-amber active" style="padding:2px 7px;font-size:0.58rem;">💾 GUARDAR BANK</button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;background:#0a1523;padding:4px 6px;border-radius:4px;border:1px solid #1e3a5f;flex-shrink:0;">
          <span style="font-size:0.6rem;color:#93c5fd;font-weight:700;">STYLE ASIGNADO A ${bank.id}:</span>
          <select id="bankStyleSelect" style="flex:1;min-width:140px;background:#13253b;color:#fde68a;border:1px solid #2b5482;border-radius:3px;padding:2px 5px;font-size:0.62rem;">
            ${styleSelectOptions}
          </select>
          <button id="btnApplyBankStyleNow" class="hw-btn small" style="padding:2px 6px;font-size:0.58rem;">▶ USAR STYLE</button>
        </div>

        ${quickAssignBox}

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;flex-shrink:0;">
          ${padSlotsHtml}
        </div>

        <div class="sx-home-grid">
          <div class="sx-tile">
            <div class="sx-tile-header"><span>RIGHT 1 / VOICE</span><span>${activeOtsLabel}</span></div>
            <div class="voice-slot">
              <span><strong>R1:</strong> ${r1Name}</span>
              ${
                hasSf2
                  ? `<select id="selSf2R1">${buildSf2PresetOptions(audio.sf2Enabled ? audio.sf2Assignments.r1 : -1)}</select>`
                  : `<select id="selVoiceR1">${buildVoiceOptions(state.parts.r1.program)}</select>`
              }
            </div>
            <div class="sx-tile-sub">Style Bank: <strong>${getStyleNameById(bank.styleId)}</strong></div>
          </div>

          <div class="sx-tile">
            <div class="sx-tile-header"><span>AUDIO SONG</span><span>WAV / MP3</span></div>
            <div class="sx-tile-title" style="font-size:0.82rem;">${audio.songBuffer ? audio.songBuffer.name : "Sin canción cargada"}</div>
            <div style="display:flex;gap:5px;">
              <button id="btnPlaySong" class="hw-btn small">▶ PLAY</button>
              <button id="btnLoopSong" class="hw-btn small">🔁 LOOP</button>
              <button id="btnStopSong" class="hw-btn small">⏹ STOP</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll("[data-mem-bank]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        state.activeMemoryBank = Number(btn.dataset.memBank);
        const b = getActiveBank();
        if (b.styleId) await applyLibraryStyle(b.styleId, b.section || "MAIN A");
        syncOtsBankUi();
        renderMainTab();
      });
    });

    document.getElementById("bankStyleSelect")?.addEventListener("change", (e) => {
      const b = getActiveBank();
      b.styleId = e.target.value;
      saveMemoryBanks();
      renderMainTab();
    });

    document.getElementById("btnApplyBankStyleNow")?.addEventListener("click", async () => {
      const b = getActiveBank();
      if (b.styleId) await applyLibraryStyle(b.styleId, b.section || "MAIN A");
    });

    document.getElementById("btnTogglePadAssignMode")?.addEventListener("click", () => {
      padAssignMode = !padAssignMode;
      renderMainTab();
    });

    document.getElementById("btnSaveMemBank")?.addEventListener("click", () => {
      const bankObj = getActiveBank();
      const customName = prompt(`Nombre para ${bankObj.id} (1–15):`, bankObj.name);
      if (customName && customName.trim()) {
        bankObj.name = customName.trim().toUpperCase().slice(0, 18);
      }
      saveMemoryBanks();
      syncOtsBankUi();
      renderMainTab();
    });

    document.querySelectorAll("[data-open-pad-samples]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openPadSampleSelector(Number(btn.dataset.openPadSamples));
      });
    });

    document.querySelectorAll("[data-lcd-pad]").forEach((btn) => {
      btn.addEventListener("click", () => triggerMemoryPad(Number(btn.dataset.lcdPad)));
    });

    document.getElementById("btnClosePadQuick")?.addEventListener("click", () => {
      padQuickAssignOpen = false;
      renderMainTab();
    });

    document.getElementById("quickPadSampleSel")?.addEventListener("change", (e) => {
      const val = e.target.value;
      const b = getActiveBank();
      const padCfg = b.pads[targetPadForAssign];
      if (!val || !padCfg) return;

      if (val.startsWith("gm:")) {
        const prog = Number(val.slice(3));
        padCfg.sourceType = "gm";
        padCfg.sampleUid = "";
        padCfg.customSoundProgram = prog;
        padCfg.customSoundName = window.GM_XG_MAP?.[prog] || `GM ${prog}`;
        padCfg.customSoundNote = prog >= 32 && prog <= 39 ? 36 : 60;
        padCfg.customIsDrum = false;
        audio.playSynthInstrument(prog, padCfg.customSoundNote, 0.4, 0.88);
      } else if (val.startsWith("lib:")) {
        const uid = val.slice(4);
        const item = audio.sampleLibrary.find((s) => s.uid === uid);
        padCfg.sourceType = uid.startsWith("sf2:") ? "sf2" : "wav";
        padCfg.sampleUid = uid;
        padCfg.customSoundProgram = null;
        padCfg.customSoundName = item ? item.name : "Sample";
        padCfg.customSoundNote = 60;
        padCfg.customIsDrum = false;
        audio.playSampleLibraryItem(uid, 60, 0.45, 0.9);
      }
      saveMemoryBanks();
      syncOtsBankUi();
      renderMainTab();
    });

    document.getElementById("quickSf2File")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await audio.loadSf2File(file);
        const firstSf2 = audio.sampleLibrary.find((s) => s.kind === "sf2_preset");
        const b = getActiveBank();
        const padCfg = b.pads[targetPadForAssign];
        if (firstSf2 && padCfg) {
          padCfg.sourceType = "sf2";
          padCfg.sampleUid = firstSf2.uid;
          padCfg.customSoundProgram = null;
          padCfg.customSoundName = `[SF2] ${firstSf2.name}`;
          padCfg.customSoundNote = 60;
          padCfg.customIsDrum = false;
          saveMemoryBanks();
          syncOtsBankUi();
          audio.playSampleLibraryItem(firstSf2.uid, 60, 0.45, 0.9);
        }
        renderMainTab();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("quickWavFile")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = await audio.loadAudioFile(file, "pad", targetPadForAssign);
      const b = getActiveBank();
      const padCfg = b.pads[targetPadForAssign];
      if (padCfg) {
        padCfg.sourceType = "wav";
        padCfg.sampleUid = `pad:${targetPadForAssign}`;
        padCfg.customSoundName = `[WAV] ${res.name}`;
        saveMemoryBanks();
        syncOtsBankUi();
        audio.triggerPad(targetPadForAssign);
      }
      renderMainTab();
    });

    document.getElementById("selSf2R1")?.addEventListener("change", (e) => {
      const val = Number(e.target.value);
      audio.sf2Assignments.r1 = val;
      audio.sf2Enabled = val >= 0;
      renderMainTab();
    });

    document.getElementById("selVoiceR1")?.addEventListener("change", (e) => {
      const prog = Number(e.target.value);
      audio.selectGmXgProgram(prog, "r1");
      state.parts.r1.program = prog;
      renderMainTab();
    });

    document.getElementById("btnPlaySong")?.addEventListener("click", () => {
      if (!audio.playSong(false)) alert("Carga un .WAV o .MP3 en EXPANSION / FILES.");
    });
    document.getElementById("btnLoopSong")?.addEventListener("click", () => {
      if (!audio.playSong(true)) alert("Carga un .WAV o .MP3 en EXPANSION / FILES.");
    });
    document.getElementById("btnStopSong")?.addEventListener("click", () => audio.stopSong());
  }

  function renderSoundsTab() {
    syncOtsBankUi();
    const folders = window.SoundLibrary ? window.SoundLibrary.getSoundFolders() : [];
    const items = window.SoundLibrary
      ? window.SoundLibrary.getSoundsInFolder(activeSoundFolder, soundSearchQuery)
      : [];
    const bank = getActiveBank();
    const activePad = bank.pads[targetPadForAssign] || bank.pads[0];

    const sf2SampleItems = audio.sampleLibrary.filter((s) => s.kind === "sf2_preset");
    const sf2Options = sf2SampleItems
      .map((item) => `<option value="${item.uid}">${item.name}</option>`)
      .join("");

    const bankSelectOptions = state.memoryBanks
      .map(
        (b, idx) =>
          `<option value="${idx}" ${idx === state.activeMemoryBank ? "selected" : ""}>${b.id}: ${b.name}</option>`
      )
      .join("");

    const padPills = bank.pads
      .map(
        (p, idx) =>
          `<button class="hw-btn small ${
            idx === targetPadForAssign ? "led-blue active" : ""
          }" data-snd-pad-slot="${idx}" style="padding:2px 5px;font-size:0.58rem;">${p.label}</button>`
      )
      .join("");

    el.tabContent.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;gap:4px;">
        <div class="sx-tile-header" style="flex-wrap:wrap;gap:4px;flex-shrink:0;">
          <span>MULTI PAD &amp; VOICE ASSIGN — ${bank.id}</span>
          <div style="display:flex;gap:3px;align-items:center;">
            <select id="sndBankSelect" style="background:#13253b;color:#fbbf24;border:1px solid #2b5482;border-radius:3px;font-size:0.58rem;padding:2px 4px;">
              ${bankSelectOptions}
            </select>
            <button id="btnSaveSoundsBank" class="hw-btn small led-amber active" style="padding:2px 6px;font-size:0.58rem;">💾 GUARDAR</button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;background:#0a1523;padding:3px 6px;border-radius:4px;border:1px solid #244a75;flex-shrink:0;">
          <div style="display:flex;gap:3px;align-items:center;">
            <span style="font-size:0.58rem;color:#93c5fd;font-weight:800;">PAD:</span>
            ${padPills}
          </div>
          <div style="font-size:0.58rem;color:#fde68a;font-weight:700;max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${activePad.label}: ${getSampleNameByUid(activePad.sampleUid, activePad)}
          </div>
        </div>

        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;background:#0a1523;padding:3px 6px;border-radius:4px;border:1px solid #1e3a5f;flex-shrink:0;">
          <label style="font-size:0.56rem;color:#93c5fd;">+ SF2: <input type="file" id="soundsTabSf2" accept=".sf2" style="max-width:85px;font-size:0.54rem;" /></label>
          <label style="font-size:0.56rem;color:#93c5fd;">+ WAV: <input type="file" id="soundsTabWav" accept=".wav,.mp3,audio/*" style="max-width:85px;font-size:0.54rem;" /></label>
          ${
            sf2Options
              ? `<select id="soundsTabSf2Preset" style="flex:1;min-width:95px;background:#13253b;color:#fde68a;border:1px solid #2b5482;border-radius:3px;font-size:0.56rem;padding:2px 4px;">
                  <option value="">Preset .SF2...</option>
                  ${sf2Options}
                </select>
                <button id="btnAssignSf2ToPad" class="hw-btn small led-blue active" style="padding:2px 5px;font-size:0.56rem;">→${activePad.label}</button>`
              : ""
          }
        </div>

        <div style="display:grid;grid-template-columns:112px 1fr;gap:5px;flex:1;min-height:0;overflow:hidden;">
          <div style="display:flex;flex-direction:column;gap:3px;overflow-y:auto;background:#0a1523;padding:4px;border-radius:4px;border:1px solid #1e3a5f;min-height:0;">
            ${folders
              .map(
                (f) => `
                <button class="hw-btn small ${
                  f.id === activeSoundFolder ? "led-blue active" : ""
                }" data-snd-folder="${f.id}" style="justify-content:flex-start;text-align:left;padding:3px 5px;font-size:0.58rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${f.label}
                </button>`
              )
              .join("")}
          </div>

          <div style="display:flex;flex-direction:column;gap:4px;min-height:0;overflow:hidden;">
            <input id="soundFilterInput" type="text" value="${soundSearchQuery}" placeholder="Buscar sonido GM / XG / XP-10 / N364..." style="background:#0d1b2e;color:#fff;border:1px solid #2b5482;border-radius:4px;padding:3px 6px;font-size:0.62rem;flex-shrink:0;" />

            <div style="display:flex;flex-direction:column;gap:3px;overflow-y:auto;padding-right:2px;flex:1;min-height:0;">
              ${items
                .map(
                  (snd) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;background:#0a1523;border:1px solid #1e3a5f;border-radius:4px;padding:3px 5px;gap:4px;flex-shrink:0;">
                    <div style="min-width:0;flex:1;">
                      <div style="font-size:0.62rem;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        <span style="color:#38bdf8;">${snd.code}</span> ${snd.name}
                      </div>
                      <div style="font-size:0.52rem;color:#93c5fd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${snd.subLabel}</div>
                    </div>
                    <div style="display:flex;gap:2px;flex-shrink:0;">
                      <button class="hw-btn small" data-preview-prog="${snd.program}" data-preview-note="${snd.previewNote}" data-preview-drum="${snd.isDrum ? 1 : 0}" style="padding:2px 4px;font-size:0.55rem;">▶</button>
                      <button class="hw-btn small led-amber active" data-use-r1="${snd.program}" style="padding:2px 4px;font-size:0.55rem;">R1</button>
                      <button class="hw-btn small" data-use-left="${snd.program}" style="padding:2px 4px;font-size:0.55rem;">L</button>
                      <button class="hw-btn small led-blue active" data-assign-pad="${snd.program}" data-assign-name="${snd.name}" data-assign-note="${snd.previewNote}" data-assign-drum="${snd.isDrum ? 1 : 0}" style="padding:2px 4px;font-size:0.55rem;">→${activePad.label}</button>
                    </div>
                  </div>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("sndBankSelect")?.addEventListener("change", (e) => {
      state.activeMemoryBank = Number(e.target.value);
      syncOtsBankUi();
      renderSoundsTab();
    });

    document.querySelectorAll("[data-snd-pad-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        targetPadForAssign = Number(btn.dataset.sndPadSlot);
        renderSoundsTab();
      });
    });

    document.getElementById("btnSaveSoundsBank")?.addEventListener("click", () => {
      const bankObj = getActiveBank();
      const customName = prompt(`Guardar ${bankObj.id} con nombre:`, bankObj.name);
      if (customName && customName.trim()) {
        bankObj.name = customName.trim().toUpperCase().slice(0, 18);
      }
      saveMemoryBanks();
      syncOtsBankUi();
      renderSoundsTab();
    });

    document.getElementById("soundsTabSf2")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await audio.loadSf2File(file);
        audio.playSf2Preset(0, 60, 0.5, 0.9);
        renderSoundsTab();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("soundsTabWav")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = await audio.loadAudioFile(file, "pad", targetPadForAssign);
      const b = getActiveBank();
      if (b.pads[targetPadForAssign]) {
        b.pads[targetPadForAssign].sourceType = "wav";
        b.pads[targetPadForAssign].sampleUid = `pad:${targetPadForAssign}`;
        b.pads[targetPadForAssign].customSoundName = `[WAV] ${res.name}`;
        saveMemoryBanks();
        syncOtsBankUi();
      }
      renderSoundsTab();
    });

    document.getElementById("soundsTabSf2Preset")?.addEventListener("change", (e) => {
      const uid = e.target.value;
      if (uid) {
        audio.playSampleLibraryItem(uid, 60, 0.45, 0.9);
      }
    });

    document.getElementById("btnAssignSf2ToPad")?.addEventListener("click", () => {
      const sel = document.getElementById("soundsTabSf2Preset");
      const uid = sel?.value;
      if (!uid) {
        alert("Selecciona primero un preset .SF2 de la lista.");
        return;
      }
      const item = audio.sampleLibrary.find((s) => s.uid === uid);
      const b = getActiveBank();
      if (b.pads[targetPadForAssign]) {
        b.pads[targetPadForAssign].sourceType = "sf2";
        b.pads[targetPadForAssign].sampleUid = uid;
        b.pads[targetPadForAssign].customSoundProgram = null;
        b.pads[targetPadForAssign].customSoundName = item ? `[SF2] ${item.name}` : "Preset SF2";
        b.pads[targetPadForAssign].customSoundNote = 60;
        b.pads[targetPadForAssign].customIsDrum = false;
        saveMemoryBanks();
        syncOtsBankUi();
        audio.playSampleLibraryItem(uid, 60, 0.45, 0.9);
        renderSoundsTab();
      }
    });

    document.querySelectorAll("[data-snd-folder]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeSoundFolder = btn.dataset.sndFolder;
        renderSoundsTab();
      });
    });

    document.getElementById("soundFilterInput")?.addEventListener("input", (e) => {
      soundSearchQuery = e.target.value;
      renderSoundsTab();
    });

    document.querySelectorAll("[data-preview-prog]").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.ensureContext();
        const prog = Number(btn.dataset.previewProg);
        const note = Number(btn.dataset.previewNote) || 60;
        const isDrum = btn.dataset.previewDrum === "1";
        if (isDrum) audio.playDrum(note, 0.9);
        else audio.playSynthInstrument(prog, note, 0.4, 0.88);
      });
    });

    document.querySelectorAll("[data-use-r1]").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.ensureContext();
        const prog = Number(btn.dataset.useR1);
        audio.selectGmXgProgram(prog, "r1");
        state.parts.r1.program = prog;
        state.parts.r1.on = true;
        document.getElementById("btnPartR1")?.classList.add("active");
        audio.playSynthInstrument(prog, 60, 0.35, 0.85);
      });
    });

    document.querySelectorAll("[data-use-left]").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.ensureContext();
        const prog = Number(btn.dataset.useLeft);
        audio.selectGmXgProgram(prog, "left");
        state.parts.left.program = prog;
        state.parts.left.on = true;
        document.getElementById("btnPartLeft")?.classList.add("active");
        audio.playSynthInstrument(prog, 36, 0.35, 0.85);
      });
    });

    document.querySelectorAll("[data-assign-pad]").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.ensureContext();
        const prog = Number(btn.dataset.assignPad);
        const labelName = btn.dataset.assignName;
        const note = Number(btn.dataset.assignNote) || 60;
        const isDrum = btn.dataset.assignDrum === "1";
        const b = getActiveBank();
        if (b.pads[targetPadForAssign]) {
          b.pads[targetPadForAssign].sourceType = "gm";
          b.pads[targetPadForAssign].sampleUid = "";
          b.pads[targetPadForAssign].customSoundProgram = prog;
          b.pads[targetPadForAssign].customSoundName = labelName;
          b.pads[targetPadForAssign].customSoundNote = note;
          b.pads[targetPadForAssign].customIsDrum = isDrum;
          saveMemoryBanks();
          syncOtsBankUi();
          if (isDrum) audio.playDrum(note, 0.88);
          else audio.playSynthInstrument(prog, note, 0.35, 0.85);
          renderSoundsTab();
        }
      });
    });
  }

  function renderMixerTab() {
    const labels = {
      9: "PERC", 10: "DRUM", 11: "BASS", 12: "CHD1",
      13: "CHD2", 14: "PAD", 15: "PHR1", 16: "PHR2"
    };
    const strips = [9, 10, 11, 12, 13, 14, 15, 16]
      .map(
        (ch) => `
        <div class="mixer-strip">
          <span class="mixer-ch-name">${labels[ch]}</span>
          <input type="range" min="0" max="127" value="${state.channelVolumes[ch]}" data-mix-ch="${ch}" />
          <span class="mixer-val" id="mixVal_${ch}">${state.channelVolumes[ch]}</span>
        </div>`
      )
      .join("");

    el.tabContent.innerHTML = `
      <div class="sx-tile-header"><span>STYLE MIXER / CHANNEL VOLUME</span><span>CH 9 – CH 16</span></div>
      <div class="mixer-grid">${strips}</div>
    `;

    document.querySelectorAll("[data-mix-ch]").forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const ch = Number(e.target.dataset.mixCh);
        const val = Number(e.target.value);
        state.channelVolumes[ch] = val;
        const lbl = document.getElementById(`mixVal_${ch}`);
        if (lbl) lbl.textContent = val;
      });
    });
  }

  function renderFilesTab() {
    syncOtsBankUi();
    const bank = getActiveBank();
    const categories = ["ALL", "Cumbia Mexicana", "Cumbia Base", "SPD-20 / Toms", "User .STY"];
    const filteredStyles =
      libraryFilter === "ALL"
        ? sty.library
        : sty.library.filter((s) => s.category === libraryFilter);

    const unifiedOptions = [
      `<option value="">-- Mantener actual --</option>`,
      `<optgroup label="GM / XG / XP-10 / N364">`,
      ...Object.entries(window.GM_XG_MAP || {}).map(
        ([prog, name]) => `<option value="gm:${prog}">${name}</option>`
      ),
      `</optgroup>`,
      ...(audio.sampleLibrary.length > 0
        ? [
            `<optgroup label="SF2 / WAV Cargados">`,
            ...audio.sampleLibrary.map(
              (item) => `<option value="lib:${item.uid}">${item.name}</option>`
            ),
            `</optgroup>`
          ]
        : [])
    ].join("");

    const bankOptions = state.memoryBanks
      .map(
        (b, i) =>
          `<option value="${i}" ${i === state.activeMemoryBank ? "selected" : ""}>${b.id}: ${b.name}</option>`
      )
      .join("");

    const styleSelectForBank =
      `<option value="">-- Sin style --</option>` +
      sty.library
        .map(
          (st) =>
            `<option value="${st.id}" ${st.id === bank.styleId ? "selected" : ""}>${st.name} (${st.bpm})</option>`
        )
        .join("");

    const sf2BanksOptions =
      audio.sf2Banks.length > 0
        ? audio.sf2Banks
            .map(
              (b) =>
                `<option value="${b.id}" ${b.id === audio.activeSf2BankId ? "selected" : ""}>${b.name} (${
                  b.presets.length
                } presets • ${b.sizeMB} MB)</option>`
            )
            .join("")
        : `<option value="">Sin bancos .SF2 guardados aún</option>`;

    const styleLibraryRows = filteredStyles
      .map(
        (st) => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#0a1523;border:1px solid ${
          st.id === sty.activePresetId ? "#38bdf8" : "#1e3a5f"
        };border-radius:4px;padding:4px 7px;gap:6px;">
          <div style="overflow:hidden;">
            <div style="font-size:0.72rem;font-weight:800;color:#f8fafc;">${st.name} <span style="color:#fbbf24;">(${st.bpm} BPM)</span></div>
            <div style="font-size:0.62rem;color:#93c5fd;">${st.category} — ${st.description}</div>
          </div>
          <button class="hw-btn small ${
            st.id === sty.activePresetId ? "led-blue active" : ""
          }" data-load-lib-style="${st.id}" style="padding:3px 8px;">USAR</button>
        </div>`
      )
      .join("");

    el.tabContent.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;gap:4px;">
        <div class="sx-tile-header" style="flex-shrink:0;">
          <span>SAMPLES • STYLES • 15 BANKS (B01–B15)</span>
          <span>${bank.id}: ${bank.name}</span>
        </div>

        <div style="display:grid;grid-template-columns:1.05fr 0.95fr;gap:8px;flex:1;min-height:0;overflow-y:auto;">
          <div style="display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
              ${categories
                .map(
                  (cat) =>
                    `<button class="hw-btn small ${
                      libraryFilter === cat ? "led-amber active" : ""
                    }" data-lib-cat="${cat}" style="padding:2px 6px;font-size:0.6rem;">${cat}</button>`
                )
                .join("")}
            </div>

            <div style="display:flex;flex-direction:column;gap:4px;max-height:105px;overflow-y:auto;">
              ${styleLibraryRows}
            </div>

            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:#0a1523;padding:4px 6px;border-radius:4px;border:1px solid #1e3a5f;">
              <label style="font-size:0.62rem;color:#93c5fd;">+ SF2: <input type="file" id="fileSf2" accept=".sf2" style="max-width:115px;font-size:0.6rem;" /></label>
              <label style="font-size:0.62rem;color:#93c5fd;">+ STY: <input type="file" id="fileSty" accept=".sty,.mid" style="max-width:105px;font-size:0.6rem;" /></label>
              <label style="font-size:0.62rem;color:#93c5fd;">+ WAV: <input type="file" id="filePad" accept=".wav,.mp3,audio/*" style="max-width:105px;font-size:0.6rem;" /></label>
            </div>

            <div style="display:flex;gap:6px;align-items:center;background:#0a1523;padding:4px 6px;border-radius:4px;border:1px solid #1e3a5f;">
              <span style="font-size:0.62rem;font-weight:700;color:#38bdf8;">SF2:</span>
              <select id="selActiveSf2Bank" style="flex:1;background:#13253b;color:#fff;border:1px solid #2b5482;font-size:0.64rem;padding:2px 4px;border-radius:3px;">
                ${sf2BanksOptions}
              </select>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:4px;background:#0a1523;padding:6px;border-radius:5px;border:1px solid #234770;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
              <select id="filesBankSelect" style="flex:1;background:#13253b;color:#fbbf24;border:1px solid #2b5482;font-size:0.62rem;padding:2px 4px;border-radius:3px;">
                ${bankOptions}
              </select>
              <button id="btnRenameBankFiles" class="hw-btn small" style="padding:2px 6px;font-size:0.58rem;">NOMBRE</button>
              <button id="btnSavePadAssign" class="hw-btn small led-blue active" style="padding:2px 7px;font-size:0.58rem;">💾 GUARDAR</button>
            </div>

            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:0.58rem;color:#93c5fd;font-weight:700;">STYLE:</span>
              <select id="filesBankStyleSel" style="flex:1;background:#13253b;color:#fde68a;border:1px solid #2b5482;font-size:0.6rem;padding:2px 4px;border-radius:3px;">
                ${styleSelectForBank}
              </select>
            </div>

            ${bank.pads
              .map(
                (p, idx) => `
                <div style="background:#0e1e33;border:1px solid #1e3a5f;border-radius:4px;padding:3px 4px;">
                  <div style="display:flex;justify-content:space-between;font-size:0.6rem;font-weight:800;color:#38bdf8;margin-bottom:2px;">
                    <span>${p.label}</span>
                    <span style="color:#fde68a;max-width:135px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${getSampleNameByUid(p.sampleUid, p)}</span>
                  </div>
                  <select data-pad-unified-sel="${idx}" style="width:100%;background:#13253b;color:#fff;border:1px solid #2b5482;font-size:0.6rem;padding:2px;">
                    ${unifiedOptions}
                  </select>
                </div>`
              )
              .join("")}
          </div>
        </div>
      </div>
    `;

    document.getElementById("filesBankSelect")?.addEventListener("change", (e) => {
      state.activeMemoryBank = Number(e.target.value);
      syncOtsBankUi();
      renderFilesTab();
    });

    document.getElementById("filesBankStyleSel")?.addEventListener("change", (e) => {
      getActiveBank().styleId = e.target.value;
      saveMemoryBanks();
      renderFilesTab();
    });

    document.getElementById("btnRenameBankFiles")?.addEventListener("click", () => {
      const b = getActiveBank();
      const customName = prompt(`Nombre para ${b.id}:`, b.name);
      if (customName && customName.trim()) {
        b.name = customName.trim().toUpperCase().slice(0, 18);
        saveMemoryBanks();
        syncOtsBankUi();
        renderFilesTab();
      }
    });

    document.querySelectorAll("[data-lib-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        libraryFilter = btn.dataset.libCat;
        renderFilesTab();
      });
    });

    document.querySelectorAll("[data-load-lib-style]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await applyLibraryStyle(btn.dataset.loadLibStyle, "MAIN A");
        renderFilesTab();
      });
    });

    document.getElementById("selActiveSf2Bank")?.addEventListener("change", (e) => {
      if (e.target.value) {
        audio.activateSf2Bank(e.target.value, false);
        audio.playSf2Preset(0, 60, 0.45, 0.85);
        renderFilesTab();
      }
    });

    document.getElementById("fileSf2")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await audio.loadSf2File(file);
        audio.playSf2Preset(0, 60, 0.5, 0.9);
        renderFilesTab();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("fileSty")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await sty.loadStyFile(file);
      if (el.lcdStyleName) el.lcdStyleName.textContent = sty.styleName;
      setSection(sty.currentSection, true);
      renderFilesTab();
    });

    document.getElementById("filePad")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await audio.loadAudioFile(file, "pad", 0);
      renderFilesTab();
    });

    document.querySelectorAll("[data-pad-unified-sel]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const idx = Number(sel.dataset.padUnifiedSel);
        const val = sel.value;
        const b = getActiveBank();
        if (!val || !b.pads[idx]) return;

        if (val.startsWith("gm:")) {
          const prog = Number(val.slice(3));
          b.pads[idx].sourceType = "gm";
          b.pads[idx].sampleUid = "";
          b.pads[idx].customSoundProgram = prog;
          b.pads[idx].customSoundName = window.GM_XG_MAP?.[prog] || `GM ${prog}`;
          b.pads[idx].customSoundNote = prog >= 32 && prog <= 39 ? 36 : 60;
          b.pads[idx].customIsDrum = false;
          audio.playSynthInstrument(prog, b.pads[idx].customSoundNote, 0.35, 0.85);
        } else if (val.startsWith("lib:")) {
          const uid = val.slice(4);
          const item = audio.sampleLibrary.find((s) => s.uid === uid);
          b.pads[idx].sourceType = uid.startsWith("sf2:") ? "sf2" : "wav";
          b.pads[idx].sampleUid = uid;
          b.pads[idx].customSoundProgram = null;
          b.pads[idx].customSoundName = item ? item.name : "Sample";
          b.pads[idx].customSoundNote = 60;
          b.pads[idx].customIsDrum = false;
          audio.playSampleLibraryItem(uid, 60, 0.4, 0.88);
        }
        saveMemoryBanks();
        syncOtsBankUi();
        renderFilesTab();
      });
    });

    document.getElementById("btnSavePadAssign")?.addEventListener("click", () => {
      saveMemoryBanks();
      syncOtsBankUi();
      alert(`Guardado en ${getActiveBank().id} (${getActiveBank().name}).`);
    });
  }

  function getRowsForChannel(ch) {
    if (ch === 9 || ch === 10) {
      return (window.GM_PERCUSSION_NOTES || []).map((item) => ({
        label: item.short,
        note: item.note
      }));
    }
    if (ch === 11) {
      return [
        { label: "G3 (55)", note: 55 },
        { label: "E3 (52)", note: 52 },
        { label: "C3 (48)", note: 48 },
        { label: "B2 (47)", note: 47 },
        { label: "A2 (45)", note: 45 },
        { label: "G2 (43)", note: 43 },
        { label: "F2 (41)", note: 41 },
        { label: "E2 (40)", note: 40 },
        { label: "D2 (38)", note: 38 },
        { label: "C2 (36)", note: 36 }
      ];
    }
    return [
      { label: "C5 (72)", note: 72 },
      { label: "B4 (71)", note: 71 },
      { label: "A4 (69)", note: 69 },
      { label: "G4 (67)", note: 67 },
      { label: "F4 (65)", note: 65 },
      { label: "E4 (64)", note: 64 },
      { label: "D4 (62)", note: 62 },
      { label: "C4 (60)", note: 60 },
      { label: "G3 (55)", note: 55 },
      { label: "C3 (48)", note: 48 }
    ];
  }

  function highlightCreatorStep(stepIndex) {
    const startStep = creatorBarView * 16;
    const endStep = startStep + 16;
    document.querySelectorAll("[data-step-col]").forEach((cell) => {
      const col = Number(cell.dataset.stepCol);
      const active = stepIndex >= startStep && stepIndex < endStep && col === stepIndex;
      cell.style.outline = active ? "2px solid #38bdf8" : "none";
    });
  }

  function renderCreatorTab() {
    const sec = sty.currentSection;
    const totalSteps = sty.getSectionLength(sec);
    const totalBars = totalSteps / 16;
    if (creatorBarView >= totalBars) creatorBarView = 0;

    const rows = getRowsForChannel(creatorChannel);
    const startStep = creatorBarView * 16;

    const channelOptions = [9, 10, 11, 12, 13, 14, 15, 16]
      .map(
        (ch) =>
          `<option value="${ch}" ${ch === creatorChannel ? "selected" : ""}>CH ${ch} (${
            ch === 9
              ? "LATIN PERC"
              : ch === 10
              ? "DRUM/SPD20"
              : ch === 11
              ? "MEX BASS"
              : ch <= 14
              ? "ACC/CHD"
              : "PHRASE"
          })</option>`
      )
      .join("");

    const chVoiceSelector =
      creatorChannel >= 11
        ? `<select id="creatorChVoice" style="background:#13253b;color:#fbbf24;border:1px solid #2b5482;padding:3px 5px;border-radius:4px;font-size:0.7rem;max-width:165px;">
            ${buildVoiceOptions(sty.channelPrograms[creatorChannel] ?? 21)}
          </select>`
        : `<span style="font-size:0.7rem;color:#38bdf8;font-weight:700;">Kit: GM/XG + SPD-20</span>`;

    const barTabs = Array.from({ length: totalBars }, (_, b) => {
      return `<button class="hw-btn small ${b === creatorBarView ? "led-blue active" : ""}" data-bar-idx="${b}" style="padding:3px 7px;">Compás ${
        b + 1
      }</button>`;
    }).join("");

    const gridRowsHtml = rows
      .map((r) => {
        const cells = Array.from({ length: 16 }, (_, localStep) => {
          const absStep = startStep + localStep;
          const hasNote = (sty.patterns[sec]?.[creatorChannel]?.[absStep] || []).includes(r.note);
          const isBeat = localStep % 4 === 0;
          return `<button
            type="button"
            data-step-col="${absStep}"
            data-grid-step="${absStep}"
            data-grid-note="${r.note}"
            style="
              height:18px;
              border:1px solid ${isBeat ? "#3b82f6" : "#1e3a5f"};
              border-radius:2px;
              background:${hasNote ? "#38bdf8" : isBeat ? "#132944" : "#0b1624"};
              cursor:pointer;
            "
            title="Paso ${absStep + 1} - ${r.label}"
          ></button>`;
        }).join("");

        return `
          <div style="display:grid;grid-template-columns:74px repeat(16,1fr);gap:2px;align-items:center;">
            <span style="font-size:0.62rem;color:#93c5fd;font-weight:700;white-space:nowrap;">${r.label}</span>
            ${cells}
          </div>
        `;
      })
      .join("");

    el.tabContent.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;gap:4px;">
        <div class="sx-tile-header" style="flex-shrink:0;">
          <span>STYLE CONVERTER / CREATOR — ${sty.styleName} (${sec})</span>
          <span>${totalBars} COMPASES / ${totalSteps} PASOS</span>
        </div>

        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;flex-shrink:0;">
          <select id="creatorCh" style="background:#13253b;color:#fff;border:1px solid #2b5482;padding:3px 6px;border-radius:4px;font-size:0.72rem;">
            ${channelOptions}
          </select>

          ${chVoiceSelector}

          <select id="creatorBarsLen" style="background:#13253b;color:#fff;border:1px solid #2b5482;padding:3px 6px;border-radius:4px;font-size:0.72rem;">
            <option value="1" ${totalBars === 1 ? "selected" : ""}>1 Compás (16)</option>
            <option value="2" ${totalBars === 2 ? "selected" : ""}>2 Compases (32)</option>
            <option value="4" ${totalBars === 4 ? "selected" : ""}>4 Compases (64)</option>
          </select>

          ${barTabs}

          <button id="btnRecLive" class="hw-btn led-red small ${isRecording ? "active" : ""}" style="padding:3px 8px;">● REC</button>
          <button id="btnExportSty" class="hw-btn led-amber small active" style="padding:3px 8px;">💾 EXPORT .STY</button>
        </div>

        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;background:#0b1523;padding:4px 6px;border-radius:4px;border:1px solid #1e3a5f;flex-shrink:0;">
          <button id="btnDupBar" class="hw-btn small" style="padding:3px 6px;">Dup C1→Todos</button>
          <button id="btnCopyCh" class="hw-btn small" style="padding:3px 6px;">Copiar CH</button>
          <button id="btnPasteCh" class="hw-btn small" style="padding:3px 6px;">Pegar CH</button>
          <button id="btnQuantize" class="hw-btn small" style="padding:3px 6px;">Quant 1/8</button>
          <button id="btnChOctDown" class="hw-btn small" style="padding:3px 6px;">-8va</button>
          <button id="btnChOctUp" class="hw-btn small" style="padding:3px 6px;">+8va</button>
          <button id="btnClearBar" class="hw-btn small" style="padding:3px 6px;">Borrar C${creatorBarView + 1}</button>
          <select id="casmNtrSel" style="background:#13253b;color:#93c5fd;border:1px solid #2b5482;padding:2px 4px;border-radius:3px;font-size:0.68rem;">
            <option value="ROOT_TRANS" ${sty.casmConfig.ntr === "ROOT_TRANS" ? "selected" : ""}>NTR: Root Trans</option>
            <option value="ROOT_FIXED" ${sty.casmConfig.ntr === "ROOT_FIXED" ? "selected" : ""}>NTR: Root Fixed</option>
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-height:0;overflow-y:auto;padding-right:2px;">
          ${gridRowsHtml}
        </div>
      </div>
    `;

    document.getElementById("creatorCh")?.addEventListener("change", (e) => {
      creatorChannel = Number(e.target.value);
      renderCreatorTab();
    });

    document.getElementById("creatorChVoice")?.addEventListener("change", (e) => {
      sty.channelPrograms[creatorChannel] = Number(e.target.value);
      audio.playNote(60, 0.35, 0.85, sty.channelPrograms[creatorChannel], creatorChannel === 11 ? "bass" : "chord");
    });

    document.getElementById("creatorBarsLen")?.addEventListener("change", (e) => {
      sty.setSectionBars(sec, Number(e.target.value));
      creatorBarView = 0;
      setSection(sec, true);
      renderCreatorTab();
    });

    document.querySelectorAll("[data-bar-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        creatorBarView = Number(btn.dataset.barIdx);
        renderCreatorTab();
      });
    });

    document.getElementById("btnDupBar")?.addEventListener("click", () => {
      sty.duplicateBar1ToAll(sec, creatorChannel);
      renderCreatorTab();
    });

    document.getElementById("btnCopyCh")?.addEventListener("click", () => {
      sty.copyChannel(sec, creatorChannel);
      alert(`Canal CH ${creatorChannel} (${sec}) copiado.`);
    });

    document.getElementById("btnPasteCh")?.addEventListener("click", () => {
      if (!sty.pasteChannel(sec, creatorChannel)) {
        alert("Primero copia un canal con 'Copiar CH'.");
        return;
      }
      renderCreatorTab();
    });

    document.getElementById("btnQuantize")?.addEventListener("click", () => {
      sty.quantizeChannel(sec, creatorChannel, 2);
      renderCreatorTab();
    });

    document.getElementById("btnChOctDown")?.addEventListener("click", () => {
      sty.transposeChannel(sec, creatorChannel, -12);
      renderCreatorTab();
    });

    document.getElementById("btnChOctUp")?.addEventListener("click", () => {
      sty.transposeChannel(sec, creatorChannel, 12);
      renderCreatorTab();
    });

    document.getElementById("btnClearBar")?.addEventListener("click", () => {
      sty.clearChannel(sec, creatorChannel, creatorBarView);
      renderCreatorTab();
    });

    document.getElementById("casmNtrSel")?.addEventListener("change", (e) => {
      sty.casmConfig.ntr = e.target.value;
      renderCreatorTab();
    });

    document.getElementById("btnRecLive")?.addEventListener("click", () => {
      isRecording = !isRecording;
      if (isRecording && !isPlaying) startPlayback();
      renderCreatorTab();
    });

    document.getElementById("btnExportSty")?.addEventListener("click", () => {
      const blob = sty.exportStyBlob(Number(el.inputTempo.value) || 100);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sty.styleName.toLowerCase().replace(/[^a-z0-9]+/gi, "_") || "style_c_major"}.sty`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.querySelectorAll("[data-grid-step]").forEach((cell) => {
      cell.addEventListener("click", () => {
        const s = Number(cell.dataset.gridStep);
        const note = Number(cell.dataset.gridNote);
        sty.toggleStepNote(sec, creatorChannel, s, note);
        if (creatorChannel === 9 || creatorChannel === 10) {
          audio.playDrum(note, 0.9);
        } else {
          const prog = sty.channelPrograms[creatorChannel] ?? 21;
          audio.playNote(
            sty.transposeNote(note, sty.currentChord),
            0.25,
            0.85,
            prog,
            creatorChannel === 11 ? "bass" : "chord"
          );
        }
        renderCreatorTab();
      });
    });
  }

  function renderLatencyTab() {
    const m = audio.getLatencyMetrics();
    el.tabContent.innerHTML = `
      <div class="sx-tile-header"><span>UTILITY — AUDIO BUFFER &amp; ANDROID OBOE/AAUDIO</span><span>${m.sampleRate} Hz</span></div>
      <div class="sx-tile">
        <div>
          <label>Buffer Size:
            <select id="bufferSelect">
              ${[128, 256, 512, 1024]
                .map((sz) => `<option value="${sz}" ${sz === audio.bufferSize ? "selected" : ""}>${sz} samples</option>`)
                .join("")}
            </select>
          </label>
        </div>
        <div class="sx-tile-sub">Salida buffer: <strong>${m.outputMs} ms</strong> | Cable / USB OTG: <strong>~${m.totalWiredMs} ms</strong> | Bluetooth: <strong>~${m.estimatedBluetoothMs} ms</strong></div>
      </div>
    `;

    document.getElementById("bufferSelect")?.addEventListener("change", (e) => {
      audio.setBufferSize(Number(e.target.value));
      renderLatencyTab();
    });
  }

  function renderTab() {
    if (activeTab === "mixer") return renderMixerTab();
    if (activeTab === "sounds") return renderSoundsTab();
    if (activeTab === "files") return renderFilesTab();
    if (activeTab === "creator") return renderCreatorTab();
    if (activeTab === "latency") return renderLatencyTab();
    return renderMainTab();
  }

  function buildFsb61Keyboard() {
    const whiteNotes = [0, 2, 4, 5, 7, 9, 11];
    const whiteNames = ["C", "D", "E", "F", "G", "A", "B"];
    const blackMap = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 };
    el.keyboard.innerHTML = "";

    let whiteIndex = 0;
    const totalWhites = 36;

    for (let oct = 2; oct <= 7; oct++) {
      for (let i = 0; i < 7; i++) {
        if (oct === 7 && i > 0) break;
        const midi = (oct + 1) * 12 + whiteNotes[i];
        const wKey = document.createElement("div");
        wKey.className = `key-white ${midi <= 54 ? "split-zone" : ""}`;
        wKey.textContent = i === 0 ? `C${oct - 1}` : whiteNames[i];

        const pressWhite = (e) => {
          e.preventDefault();
          wKey.classList.add("active");
          playLeadOrLeftNote(midi, 0.88);
          if (isRecording) sty.recordLiveNote(sty.currentSection, creatorChannel, currentStep, midi);
        };
        const releaseWhite = () => {
          wKey.classList.remove("active");
          if (state.syncStop && midi <= 54 && isPlaying) stopPlayback();
        };

        wKey.addEventListener("pointerdown", pressWhite);
        wKey.addEventListener("pointerup", releaseWhite);
        wKey.addEventListener("pointerleave", releaseWhite);
        el.keyboard.appendChild(wKey);

        if (!(oct === 7) && blackMap[whiteNotes[i]] !== undefined) {
          const bMidi = (oct + 1) * 12 + blackMap[whiteNotes[i]];
          const bKey = document.createElement("div");
          bKey.className = "key-black";
          bKey.style.left = `${((whiteIndex + 0.68) / totalWhites) * 100}%`;

          const pressBlack = (e) => {
            e.stopPropagation();
            e.preventDefault();
            bKey.classList.add("active");
            playLeadOrLeftNote(bMidi, 0.92);
            if (isRecording) sty.recordLiveNote(sty.currentSection, creatorChannel, currentStep, bMidi);
          };
          const releaseBlack = () => bKey.classList.remove("active");

          bKey.addEventListener("pointerdown", pressBlack);
          bKey.addEventListener("pointerup", releaseBlack);
          bKey.addEventListener("pointerleave", releaseBlack);
          el.keyboard.appendChild(bKey);
        }

        whiteIndex++;
      }
    }
  }

  function initJoystick() {
    const pad = document.getElementById("joystickPad");
    const stick = document.getElementById("joystickStick");
    if (!pad || !stick) return;
    let dragging = false;

    const updateStick = (clientX, clientY) => {
      const rect = pad.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
      const dy = Math.max(-1, Math.min(1, (clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
      stick.style.transform = `translate(calc(-50% + ${dx * 18}px), calc(-50% + ${dy * 18}px))`;
      state.pitchBendSemis = Math.round(dx * 2);
    };

    pad.addEventListener("pointerdown", (e) => {
      dragging = true;
      pad.setPointerCapture(e.pointerId);
      updateStick(e.clientX, e.clientY);
    });
    pad.addEventListener("pointermove", (e) => {
      if (dragging) updateStick(e.clientX, e.clientY);
    });
    const resetStick = () => {
      dragging = false;
      stick.style.transform = "translate(-50%, -50%)";
      state.pitchBendSemis = 0;
    };
    pad.addEventListener("pointerup", resetStick);
    pad.addEventListener("pointercancel", resetStick);
  }

  function initWebMidi() {
    if (!navigator.requestMIDIAccess) {
      el.midiStatus.textContent = "MIDI: Sin WebMIDI";
      return;
    }
    navigator.requestMIDIAccess().then(
      (access) => {
        const inputs = Array.from(access.inputs.values());
        el.midiStatus.textContent = inputs.length ? `MIDI: ${inputs[0].name.slice(0, 14)}` : "MIDI: USB OTG Ready";
        inputs.forEach((input) => {
          input.onmidimessage = (msg) => {
            const [status, data1, data2] = msg.data;
            if ((status & 0xf0) === 0x90 && data2 > 0) {
              playLeadOrLeftNote(data1, data2 / 127);
              if (isRecording) sty.recordLiveNote(sty.currentSection, creatorChannel, currentStep, data1);
            }
          };
        });
      },
      () => {
        el.midiStatus.textContent = "MIDI: Bloqueado";
      }
    );
  }

  function bindEvents() {
    el.btnStartStop.addEventListener("click", () => (isPlaying ? stopPlayback() : startPlayback()));

    el.masterVolume?.addEventListener("input", (e) => {
      audio.ensureContext();
      if (audio.masterGain) audio.masterGain.gain.value = Number(e.target.value);
    });

    const toggleHw = (id, key) => {
      const btn = document.getElementById(id);
      btn?.addEventListener("click", () => {
        state[key] = !state[key];
        btn.classList.toggle("active", state[key]);
      });
    };

    toggleHw("btnAcmp", "acmp");
    toggleHw("btnAutoFill", "autoFill");
    toggleHw("btnSyncStart", "syncStart");
    toggleHw("btnSyncStop", "syncStop");
    toggleHw("btnLeftHold", "leftHold");
    toggleHw("btnHarmony", "harmony");

    document.getElementById("btnPartR1")?.addEventListener("click", (e) => {
      state.parts.r1.on = !state.parts.r1.on;
      e.currentTarget.classList.toggle("active", state.parts.r1.on);
    });
    document.getElementById("btnPartR2")?.addEventListener("click", (e) => {
      state.parts.r2.on = !state.parts.r2.on;
      e.currentTarget.classList.toggle("active", state.parts.r2.on);
    });
    document.getElementById("btnPartLeft")?.addEventListener("click", (e) => {
      state.parts.left.on = !state.parts.left.on;
      e.currentTarget.classList.toggle("active", state.parts.left.on);
    });

    document.getElementById("btnTempoDown")?.addEventListener("click", () => {
      el.inputTempo.value = Math.max(40, Number(el.inputTempo.value) - 1);
      if (activeTab === "main") renderMainTab();
    });
    document.getElementById("btnTempoUp")?.addEventListener("click", () => {
      el.inputTempo.value = Math.min(280, Number(el.inputTempo.value) + 1);
      if (activeTab === "main") renderMainTab();
    });

    document.getElementById("btnTransDown")?.addEventListener("click", () => {
      state.transpose = Math.max(-12, state.transpose - 1);
      el.transposeVal.textContent = state.transpose > 0 ? `+${state.transpose}` : state.transpose;
    });
    document.getElementById("btnTransUp")?.addEventListener("click", () => {
      state.transpose = Math.min(12, state.transpose + 1);
      el.transposeVal.textContent = state.transpose > 0 ? `+${state.transpose}` : state.transpose;
    });

    el.btnTapTempo.addEventListener("click", () => {
      const now = performance.now();
      tapTimes = tapTimes.filter((t) => now - t < 2500);
      tapTimes.push(now);
      if (tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i - 1]);
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        el.inputTempo.value = Math.max(40, Math.min(280, Math.round(60000 / avgMs)));
        if (activeTab === "main") renderMainTab();
      }
    });

    document.getElementById("btnOtsBankPrev")?.addEventListener("click", () => stepMemoryBank(-1));
    document.getElementById("btnOtsBankNext")?.addEventListener("click", () => stepMemoryBank(1));

    document.querySelectorAll(".style-sec").forEach((btn) =>
      btn.addEventListener("click", () => setSection(btn.dataset.section))
    );
    document.querySelectorAll(".ots-btn").forEach((btn) =>
      btn.addEventListener("click", () => applyOts(Number(btn.dataset.ots)))
    );
    document.querySelectorAll(".chord-btn").forEach((btn) =>
      btn.addEventListener("click", () => setChord(btn.dataset.chord))
    );
    document.querySelectorAll(".tft-tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll(".tft-tab").forEach((b) =>
          b.classList.toggle("active", b.dataset.tab === activeTab)
        );
        renderTab();
      })
    );

    document.querySelectorAll(".pad-btn").forEach((btn) =>
      btn.addEventListener("click", () => triggerMemoryPad(Number(btn.dataset.pad)))
    );
    document.getElementById("btnPadStop")?.addEventListener("click", () => audio.stopSong());
  }

  buildFsb61Keyboard();
  initJoystick();
  bindEvents();
  initWebMidi();
  renderTab();

  audio.restoreSavedSf2Banks().then((banks) => {
    if (banks.length > 0) {
      audio.rebuildSampleLibrary();
      renderTab();
    }
  });
})();
