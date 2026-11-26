(function () {
  const audio = new window.AudioEngine();
  const sty = new window.StyEngine();

  let isPlaying = false;
  let stepTimer = null;
  let currentStep = 0;
  let activeTab = "main";
  let creatorChannel = 10;
  let creatorBarView = 0;
  let isRecording = false;
  let tapTimes = [];

  const state = {
    acmp: true,
    autoFill: true,
    syncStart: true,
    syncStop: false,
    leftHold: false,
    harmony: false,
    transpose: 0,
    pitchBendSemis: 0,
    parts: {
      r1: { on: true, program: 21 },   // Musette Accordion (Cumbia)
      r2: { on: false, program: 61 },  // Brass Section (XG)
      left: { on: true, program: 33 }  // Fingered Electric Bass (Cumbia)
    },
    otsPresets: [
      { r1: 21, r2: 61, r2On: false, label: "OTS 1: Cumbia Accordion" },
      { r1: 61, r2: 56, r2On: true, label: "OTS 2: Latin Brass Section" },
      { r1: 0, r2: 48, r2On: true, label: "OTS 3: Concert Grand + Strings" },
      { r1: 27, r2: 12, r2On: true, label: "OTS 4: Clean Strat + Marimba" }
    ],
    activeOts: 0,
    channelVolumes: {
      9: 96, 10: 112, 11: 115, 12: 90, 13: 85, 14: 80, 15: 95, 16: 95
    }
  };

  const el = {
    btnStartStop: document.getElementById("btnStartStop"),
    btnTapTempo: document.getElementById("btnTapTempo"),
    inputTempo: document.getElementById("inputTempo"),
    chordDisplay: document.getElementById("chordDisplay"),
    lcdSectionBadge: document.getElementById("lcdSectionBadge"),
    tabContent: document.getElementById("tabContent"),
    keyboard: document.getElementById("keyboard"),
    midiStatus: document.getElementById("midiStatus"),
    transposeVal: document.getElementById("transposeVal"),
    masterVolume: document.getElementById("masterVolume")
  };

  // Tempo inicial de Cumbia (104 BPM)
  el.inputTempo.value = sty.tempo;

  function getStepIntervalMs() {
    const bpm = Math.max(40, Math.min(280, Number(el.inputTempo.value) || 104));
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

    // CH 9 (Congas/Timbales) y CH 10 (Bombo, Caja, Güiro, Cowbell, Toms SPD-20)
    [9, 10].forEach((ch) => {
      const vol = (state.channelVolumes[ch] ?? 105) / 127;
      (secData[ch]?.[stepIndex] || []).forEach((n) => audio.playDrum(n, vol));
    });

    if (!state.acmp) {
      highlightCreatorStep(stepIndex);
      return;
    }

    // CH 11: Bajo de Cumbia / Bajo del Estilo
    const bassVol = (state.channelVolumes[11] ?? 112) / 127;
    const bassProg = sty.channelPrograms[11] ?? 33;
    (secData[11]?.[stepIndex] || []).forEach((n) => {
      const transposed = sty.transposeNote(n, sty.currentChord) + state.transpose;
      audio.playNote(transposed, 0.28, bassVol, bassProg, "bass");
    });

    // CH 12..16: Acordes, Guitarra, Pad y Frases
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
    el.chordDisplay.textContent = chordSymbol;
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

    el.lcdSectionBadge.textContent = `${sty.currentSection} (${maxBars}B)`;
    document.querySelectorAll(".style-sec").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === sty.currentSection);
    });
    if (activeTab === "main" || activeTab === "creator") renderTab();
  }

  function applyOts(index) {
    const preset = state.otsPresets[index];
    if (!preset) return;
    state.activeOts = index;
    state.parts.r1.program = preset.r1;
    state.parts.r1.on = true;
    state.parts.r2.program = preset.r2;
    state.parts.r2.on = preset.r2On;

    document.getElementById("btnPartR1")?.classList.toggle("active", state.parts.r1.on);
    document.getElementById("btnPartR2")?.classList.toggle("active", state.parts.r2.on);
    document.querySelectorAll(".ots-btn").forEach((b) =>
      b.classList.toggle("active", Number(b.dataset.ots) === index)
    );
    if (activeTab === "main") renderMainTab();
  }

  function playLeadOrLeftNote(midiNote, velocity = 0.85) {
    const finalNote = midiNote + state.transpose + state.pitchBendSemis;
    if (midiNote <= 54) {
      const chordMap = {
        48: "Cmaj7", 49: "Dbmaj7", 50: "Dm7", 51: "Ebmaj7",
        52: "Em7", 53: "Fmaj7", 54: "F#m7"
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
    const hasSf2 = audio.sf2Presets.length > 0;
    const r1Name =
      hasSf2 && audio.sf2Assignments.r1 >= 0 && audio.sf2Presets[audio.sf2Assignments.r1]
        ? `[SF2] ${audio.sf2Presets[audio.sf2Assignments.r1].name}`
        : window.resolveXgVoice(state.parts.r1.program, 0, 112).split(" (")[0];

    const r2Name =
      hasSf2 && audio.sf2Assignments.r2 >= 0 && audio.sf2Presets[audio.sf2Assignments.r2]
        ? `[SF2] ${audio.sf2Presets[audio.sf2Assignments.r2].name}`
        : window.resolveXgVoice(state.parts.r2.program, 0, 112).split(" (")[0];

    const leftName =
      hasSf2 && audio.sf2Assignments.left >= 0 && audio.sf2Presets[audio.sf2Assignments.left]
        ? `[SF2] ${audio.sf2Presets[audio.sf2Assignments.left].name}`
        : window.resolveXgVoice(state.parts.left.program, 0, 112).split(" (")[0];

    el.tabContent.innerHTML = `
      <div class="sx-home-grid">
        <div class="sx-tile">
          <div>
            <div class="sx-tile-header"><span>STYLE</span><span>${sty.getSectionLength(sty.currentSection) / 16} BARS • ${el.inputTempo.value} BPM</span></div>
            <div class="sx-tile-title">${sty.styleName}</div>
            <div class="sx-tile-sub">Sección: <strong>${sty.currentSection}</strong> (${sty.getSectionLength(sty.currentSection)} pasos)</div>
          </div>
          <div class="sx-tile-sub">SoundFont: <strong>${
            audio.sf2Info
              ? `${audio.sf2Info.name} (${audio.sf2Info.presetCount} presets)`
              : "GM/XG + SPD-20 Studio"
          }</strong></div>
        </div>

        <div class="sx-tile">
          <div class="sx-tile-header"><span>PART VOICE / SF2 PRESET</span><span>${state.otsPresets[state.activeOts].label}</span></div>
          <div class="voice-slot-list">
            <div class="voice-slot">
              <span><strong>R1:</strong> ${r1Name}</span>
              ${
                hasSf2
                  ? `<select id="selSf2R1">${buildSf2PresetOptions(audio.sf2Assignments.r1)}</select>`
                  : `<select id="selVoiceR1">${buildVoiceOptions(state.parts.r1.program)}</select>`
              }
            </div>
            <div class="voice-slot">
              <span><strong>R2:</strong> ${r2Name}</span>
              ${
                hasSf2
                  ? `<select id="selSf2R2">${buildSf2PresetOptions(audio.sf2Assignments.r2)}</select>`
                  : `<select id="selVoiceR2">${buildVoiceOptions(state.parts.r2.program)}</select>`
              }
            </div>
            <div class="voice-slot">
              <span><strong>LEFT:</strong> ${leftName}</span>
              ${
                hasSf2
                  ? `<select id="selSf2Left">${buildSf2PresetOptions(audio.sf2Assignments.left)}</select>`
                  : `<select id="selVoiceLeft">${buildVoiceOptions(state.parts.left.program)}</select>`
              }
            </div>
          </div>
        </div>

        <div class="sx-tile">
          <div class="sx-tile-header"><span>MULTI PAD BANK</span><span>AUDIO / SYNC</span></div>
          <div class="sx-tile-title">Custom Audio Pads (1–4)</div>
          <div class="sx-tile-sub">
            ${audio.padBuffers.map((p, i) => `P${i + 1}: ${p ? p.name.slice(0, 10) : "---"}`).join(" | ")}
          </div>
        </div>

        <div class="sx-tile">
          <div class="sx-tile-header"><span>AUDIO SONG PLAYER</span><span>WAV / MP3</span></div>
          <div class="sx-tile-title">${audio.songBuffer ? audio.songBuffer.name : "No Song Loaded"}</div>
          <div style="display:flex;gap:6px;">
            <button id="btnPlaySong" class="hw-btn small">▶ PLAY</button>
            <button id="btnLoopSong" class="hw-btn small">🔁 LOOP</button>
            <button id="btnStopSong" class="hw-btn small">⏹ STOP</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("selVoiceR1")?.addEventListener("change", (e) => {
      state.parts.r1.program = Number(e.target.value);
      renderMainTab();
    });
    document.getElementById("selVoiceR2")?.addEventListener("change", (e) => {
      state.parts.r2.program = Number(e.target.value);
      renderMainTab();
    });
    document.getElementById("selVoiceLeft")?.addEventListener("change", (e) => {
      state.parts.left.program = Number(e.target.value);
      renderMainTab();
    });

    document.getElementById("selSf2R1")?.addEventListener("change", (e) => {
      audio.sf2Assignments.r1 = Number(e.target.value);
      audio.sf2Enabled = audio.sf2Assignments.r1 >= 0 || audio.sf2Assignments.r2 >= 0;
      renderMainTab();
    });
    document.getElementById("selSf2R2")?.addEventListener("change", (e) => {
      audio.sf2Assignments.r2 = Number(e.target.value);
      audio.sf2Enabled = audio.sf2Assignments.r1 >= 0 || audio.sf2Assignments.r2 >= 0;
      renderMainTab();
    });
    document.getElementById("selSf2Left")?.addEventListener("change", (e) => {
      audio.sf2Assignments.left = Number(e.target.value);
      audio.sf2Enabled = true;
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
    const sf2PresetBar =
      audio.sf2Presets.length > 0
        ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
            <select id="sf2TestPreset" style="max-width:155px;">
              ${audio.sf2Presets
                .map((p, idx) => `<option value="${idx}">${p.name} (${p.zones.length}z)</option>`)
                .join("")}
            </select>
            <button id="btnAuditionSf2" class="hw-btn small">🔊 PROBAR PRESET</button>
          </div>`
        : "";

    el.tabContent.innerHTML = `
      <div class="sx-tile-header"><span>EXPANSION &amp; USER FILES</span><span>.STY / .SF2 / .WAV / .MP3</span></div>
      <div class="sx-home-grid">
        <div class="sx-tile">
          <div class="sx-tile-title">1. Yamaha Style (.STY)</div>
          <input type="file" id="fileSty" accept=".sty,.mid" />
          <div class="sx-tile-sub" id="styStatus">Actual: ${sty.styleName}</div>
        </div>
        <div class="sx-tile">
          <div class="sx-tile-title">2. SoundFont Bank (.SF2)</div>
          <input type="file" id="fileSf2" accept=".sf2" />
          <div class="sx-tile-sub" id="sf2Status">${
            audio.sf2Info
              ? `Activo: ${audio.sf2Info.name} (${audio.sf2Info.presetCount} presets / ${audio.sf2Info.sampleCount} muestras)`
              : "Built-in GM/XG + SPD-20"
          }</div>
          ${sf2PresetBar}
        </div>
        <div class="sx-tile">
          <div class="sx-tile-title">3. Audio Song (.WAV/.MP3)</div>
          <input type="file" id="fileAudio" accept=".wav,.mp3,audio/*" />
          <div class="sx-tile-sub" id="audioStatus">${
            audio.songBuffer ? audio.songBuffer.name : "Sin canción"
          }</div>
        </div>
        <div class="sx-tile">
          <div class="sx-tile-title">4. Asignar Multi Pad</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <select id="padSelect">
              <option value="0">PAD 1</option>
              <option value="1">PAD 2</option>
              <option value="2">PAD 3</option>
              <option value="3">PAD 4</option>
            </select>
            <input type="file" id="filePad" accept=".wav,.mp3,audio/*" />
          </div>
        </div>
      </div>
    `;

    document.getElementById("fileSty")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const info = await sty.loadStyFile(file);
      setSection(sty.currentSection, true);
      document.getElementById("styStatus").textContent = `${info.name} (${info.detectedSections.join(", ")})`;
    });

    document.getElementById("fileSf2")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await audio.loadSf2File(file);
        audio.playSf2Preset(0, 60, 0.55, 0.9);
        renderFilesTab();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("btnAuditionSf2")?.addEventListener("click", () => {
      const idx = Number(document.getElementById("sf2TestPreset")?.value || 0);
      audio.sf2Assignments.r1 = idx;
      audio.sf2Enabled = true;
      audio.playSf2Preset(idx, 60, 0.65, 0.92);
    });

    document.getElementById("fileAudio")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const info = await audio.loadAudioFile(file, "song");
      document.getElementById("audioStatus").textContent = `Listo: ${info.name}`;
    });

    document.getElementById("filePad")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      const padIdx = Number(document.getElementById("padSelect")?.value || 0);
      if (!file) return;
      await audio.loadAudioFile(file, "pad", padIdx);
      document.querySelector(`.pad-btn[data-pad="${padIdx}"]`)?.classList.add("active");
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
      // Escala de Bajo de Cumbia y grave (C2 a G3)
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
              ? "CUMBIA BASS"
              : ch <= 14
              ? "CHD/PAD"
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
      <div class="sx-tile-header">
        <span>STYLE CREATOR / CONVERTER — ${sec} (${totalBars} COMPASES / ${totalSteps} PASOS)</span>
        <span>CASM: ${sty.casmConfig.ntr}</span>
      </div>

      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
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

      <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;background:#0b1523;padding:4px 6px;border-radius:4px;border:1px solid #1e3a5f;">
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

      <div style="display:flex;flex-direction:column;gap:2px;max-height:165px;overflow-y:auto;padding-right:2px;">
        ${gridRowsHtml}
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
      const blob = sty.exportStyBlob(Number(el.inputTempo.value) || 104);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sty.styleName.toLowerCase().replace(/[^a-z0-9]+/gi, "_") || "cumbia_spd20"}.sty`;
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
        <div class="sx-tile-sub">En Android nativo se recomienda salida por cable y teclado MIDI por USB OTG.</div>
      </div>
    `;

    document.getElementById("bufferSelect")?.addEventListener("change", (e) => {
      audio.setBufferSize(Number(e.target.value));
      renderLatencyTab();
    });
  }

  function renderTab() {
    if (activeTab === "mixer") return renderMixerTab();
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
      stick.style.transform = `translate(calc(-50% + ${dx * 18}px), -50%)`;
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
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.pad);
        if (!audio.triggerPad(idx)) {
          alert(`PAD ${idx + 1} vacío. Carga un .WAV o .MP3 en EXPANSION / FILES.`);
        }
      })
    );
    document.getElementById("btnPadStop")?.addEventListener("click", () => audio.stopSong());
  }

  buildFsb61Keyboard();
  initJoystick();
  bindEvents();
  initWebMidi();
  renderTab();
})();
