(function () {
  const audio = new window.AudioEngine();
  const sty = new window.StyEngine();

  let isPlaying = false;
  let stepTimer = null;
  let currentStep = 0;
  let activeTab = "main";
  let creatorChannel = 10;
  let creatorRowNote = 36;
  let isRecording = false;
  let tapTimes = [];

  // Estado estilo PSR-SX
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
      r1: { on: true, program: 0, wave: "triangle" },
      r2: { on: false, program: 48, wave: "sine" },
      left: { on: true, program: 4, wave: "triangle" }
    },
    otsPresets: [
      { r1: 0, r2: 48, r2On: false, label: "OTS 1: Concert Grand" },
      { r1: 4, r2: 88, r2On: true, label: "OTS 2: Stage EP + Pad" },
      { r1: 29, r2: 61, r2On: false, label: "OTS 3: Overdrive Guitar" },
      { r1: 61, r2: 48, r2On: true, label: "OTS 4: Brass & Strings" }
    ],
    activeOts: 0,
    channelVolumes: {
      9: 90, 10: 105, 11: 100, 12: 88, 13: 84, 14: 80, 15: 92, 16: 92
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

  function getStepIntervalMs() {
    const bpm = Math.max(40, Math.min(280, Number(el.inputTempo.value) || 120));
    return (60000 / bpm) / 4;
  }

  function updateBeatLeds(stepIndex) {
    const beat = Math.floor(stepIndex / 4);
    const isBeatStart = stepIndex % 4 === 0;
    document.querySelectorAll(".beat-dot").forEach((dot, idx) => {
      dot.classList.remove("on", "on-first");
      if (isPlaying && isBeatStart && idx === beat) {
        dot.classList.add(idx === 0 ? "on-first" : "on");
      }
    });
  }

  function playStep(stepIndex) {
    updateBeatLeds(stepIndex);

    // Si terminó un compás de FILL A y AUTO FILL está activo, pasa a MAIN B
    if (stepIndex === 0 && sty.currentSection === "FILL A" && state.autoFill) {
      setSection("MAIN B", true);
    }

    const sec = sty.currentSection;
    const secData = sty.patterns[sec];
    if (!secData) return;

    // Batería (CH 9 y CH 10) siempre suena aunque ACMP esté apagado
    [9, 10].forEach((ch) => {
      const vol = (state.channelVolumes[ch] ?? 100) / 127;
      (secData[ch]?.[stepIndex] || []).forEach((n) => audio.playDrum(n, vol));
    });

    if (!state.acmp) {
      highlightCreatorStep(stepIndex);
      return;
    }

    // Bajo (CH 11)
    const bassVol = (state.channelVolumes[11] ?? 100) / 127;
    (secData[11]?.[stepIndex] || []).forEach((n) => {
      const transposed = sty.transposeNote(n - 12, sty.currentChord) + state.transpose;
      audio.playNote(transposed, 0.22, bassVol * 0.85, "triangle");
    });

    // Acordes y frases (CH 12 a CH 16)
    [12, 13, 14, 15, 16].forEach((ch) => {
      const vol = (state.channelVolumes[ch] ?? 85) / 127;
      (secData[ch]?.[stepIndex] || []).forEach((n) => {
        const transposed = sty.transposeNote(n, sty.currentChord) + state.transpose;
        const wave = ch === 14 ? "sine" : ch >= 15 ? "sawtooth" : "triangle";
        audio.playNote(transposed, 0.24, vol * 0.55, wave);
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
      playStep(currentStep);
      currentStep = (currentStep + 1) % 16;
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

    el.lcdSectionBadge.textContent = sty.currentSection;
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

  function playLeadOrLeftNote(midiNote, velocity = 0.75) {
    const finalNote = midiNote + state.transpose + state.pitchBendSemis;
    // Zona izquierda <= F#2 (42 en teclado 61 teclas C1..C6)
    if (midiNote <= 54) {
      const chordMap = {
        48: "Cmaj7", 49: "Dbmaj7", 50: "Dm7", 51: "Ebmaj7",
        52: "Em7", 53: "Fmaj7", 54: "F#m7"
      };
      if (chordMap[midiNote]) setChord(chordMap[midiNote]);
      if (state.syncStart && !isPlaying && state.acmp) startPlayback();
      if (state.parts.left.on) {
        audio.playNote(finalNote, state.leftHold ? 0.9 : 0.35, velocity * 0.65, "triangle");
      }
      return;
    }

    // Zona derecha: RIGHT 1 + RIGHT 2 + HARMONY
    if (state.parts.r1.on) {
      const wave1 = state.parts.r1.program >= 29 ? "sawtooth" : "triangle";
      audio.playNote(finalNote, 0.38, velocity * 0.8, wave1);
    }
    if (state.parts.r2.on) {
      audio.playNote(finalNote + 12, 0.42, velocity * 0.45, "sine");
    }
    if (state.harmony) {
      audio.playNote(finalNote - 5, 0.35, velocity * 0.45, "triangle");
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

  function renderMainTab() {
    const r1Name = window.resolveXgVoice(state.parts.r1.program, 0, 112);
    const r2Name = window.resolveXgVoice(state.parts.r2.program, 0, 112);
    const leftName = window.resolveXgVoice(state.parts.left.program, 0, 112);

    el.tabContent.innerHTML = `
      <div class="sx-home-grid">
        <div class="sx-tile">
          <div>
            <div class="sx-tile-header"><span>STYLE</span><span>4/4 • ${el.inputTempo.value} BPM</span></div>
            <div class="sx-tile-title">${sty.styleName}</div>
            <div class="sx-tile-sub">Sección: <strong>${sty.currentSection}</strong> | ${
              sty.casmDetected ? "CASM Activo" : "GM/XG Engine"
            }</div>
          </div>
          <div class="sx-tile-sub">Bank: ${audio.sf2Info ? audio.sf2Info.name : "Internal PSR-XG"}</div>
        </div>

        <div class="sx-tile">
          <div class="sx-tile-header"><span>PART VOICE SELECT</span><span>${state.otsPresets[state.activeOts].label}</span></div>
          <div class="voice-slot-list">
            <div class="voice-slot">
              <span><strong>R1:</strong> ${r1Name.split(" (")[0]}</span>
              <select id="selVoiceR1">${buildVoiceOptions(state.parts.r1.program)}</select>
            </div>
            <div class="voice-slot">
              <span><strong>R2:</strong> ${r2Name.split(" (")[0]}</span>
              <select id="selVoiceR2">${buildVoiceOptions(state.parts.r2.program)}</select>
            </div>
            <div class="voice-slot">
              <span><strong>LEFT:</strong> ${leftName.split(" (")[0]}</span>
              <select id="selVoiceLeft">${buildVoiceOptions(state.parts.left.program)}</select>
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
      9: "RHY1", 10: "RHY2", 11: "BASS", 12: "CHD1",
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
          <input type="file" id="fileSf2" accept=".sf2,.sf3" />
          <div class="sx-tile-sub" id="sf2Status">${
            audio.sf2Info ? `${audio.sf2Info.name} (${audio.sf2Info.sizeMB} MB)` : "Built-in XG Synth"
          }</div>
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
        const info = await audio.loadSf2File(file);
        document.getElementById("sf2Status").textContent = `${info.name} (${info.sizeMB} MB)`;
      } catch (err) {
        alert(err.message);
      }
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
      return [
        { label: "Kick (36)", note: 36 },
        { label: "Snare (38)", note: 38 },
        { label: "Closed HH (42)", note: 42 },
        { label: "Open HH (46)", note: 46 },
        { label: "Crash (49)", note: 49 }
      ];
    }
    return [
      { label: "C+ (72)", note: 72 },
      { label: "B (71)", note: 71 },
      { label: "A (69)", note: 69 },
      { label: "G (67)", note: 67 },
      { label: "E (64)", note: 64 },
      { label: "D (62)", note: 62 },
      { label: "C (60)", note: 60 }
    ];
  }

  function highlightCreatorStep(stepIndex) {
    document.querySelectorAll("[data-step-col]").forEach((cell) => {
      cell.style.outline =
        Number(cell.dataset.stepCol) === stepIndex ? "2px solid #38bdf8" : "none";
    });
  }

  function renderCreatorTab() {
    const rows = getRowsForChannel(creatorChannel);
    if (!rows.some((r) => r.note === creatorRowNote)) creatorRowNote = rows[0].note;

    const channelOptions = [9, 10, 11, 12, 13, 14, 15, 16]
      .map((ch) => `<option value="${ch}" ${ch === creatorChannel ? "selected" : ""}>CH ${ch}</option>`)
      .join("");

    const rowOptions = rows
      .map((r) => `<option value="${r.note}" ${r.note === creatorRowNote ? "selected" : ""}>${r.label}</option>`)
      .join("");

    const stepCells = Array.from({ length: 16 }, (_, s) => {
      const hasNote = (sty.patterns[sty.currentSection]?.[creatorChannel]?.[s] || []).includes(creatorRowNote);
      return `<button class="hw-btn led-blue ${hasNote ? "active" : ""}" data-step-col="${s}" data-toggle-step="${s}"><span class="led"></span>${
        s + 1
      }</button>`;
    }).join("");

    el.tabContent.innerHTML = `
      <div class="sx-tile-header"><span>STYLE CREATOR — STEP REC / CASM EXPORT</span><span>${sty.currentSection}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        <select id="creatorCh">${channelOptions}</select>
        <select id="creatorNote">${rowOptions}</select>
        <button id="btnRecLive" class="hw-btn led-red small ${isRecording ? "active" : ""}"><span class="led"></span>REC</button>
        <button id="btnExportSty" class="hw-btn led-amber small active"><span class="led"></span>EXPORT .STY</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(16,1fr);gap:4px;">${stepCells}</div>
      <div class="sx-tile-sub">Graba sobre Do Mayor (C, E, G) para que la tabla CASM transponga al acorde tocado.</div>
    `;

    document.getElementById("creatorCh")?.addEventListener("change", (e) => {
      creatorChannel = Number(e.target.value);
      creatorRowNote = getRowsForChannel(creatorChannel)[0].note;
      renderCreatorTab();
    });
    document.getElementById("creatorNote")?.addEventListener("change", (e) => {
      creatorRowNote = Number(e.target.value);
      renderCreatorTab();
    });
    document.getElementById("btnRecLive")?.addEventListener("click", () => {
      isRecording = !isRecording;
      if (isRecording && !isPlaying) startPlayback();
      renderCreatorTab();
    });
    document.getElementById("btnExportSty")?.addEventListener("click", () => {
      const blob = sty.exportStyBlob(Number(el.inputTempo.value) || 120);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sty.styleName.toLowerCase().replace(/[^a-z0-9]+/gi, "_") || "psr_sx_style"}.sty`;
      a.click();
      URL.revokeObjectURL(url);
    });
    document.querySelectorAll("[data-toggle-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = Number(btn.dataset.toggleStep);
        sty.toggleStepNote(sty.currentSection, creatorChannel, s, creatorRowNote);
        if (creatorChannel === 9 || creatorChannel === 10) audio.playDrum(creatorRowNote, 0.8);
        else audio.playNote(sty.transposeNote(creatorRowNote, sty.currentChord), 0.2, 0.65);
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
    // 61 teclas: C2 (36) a C7 (96) -> 36 teclas blancas + 25 negras
    const whiteNotes = [0, 2, 4, 5, 7, 9, 11];
    const whiteNames = ["C", "D", "E", "F", "G", "A", "B"];
    const blackMap = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 }; // Semitono negro a la derecha de la blanca
    el.keyboard.innerHTML = "";

    let whiteIndex = 0;
    const totalWhites = 36;

    for (let oct = 2; oct <= 7; oct++) {
      for (let i = 0; i < 7; i++) {
        if (oct === 7 && i > 0) break; // Termina en C7
        const midi = (oct + 1) * 12 + whiteNotes[i];
        const wKey = document.createElement("div");
        wKey.className = `key-white ${midi <= 54 ? "split-zone" : ""}`;
        wKey.textContent = i === 0 ? `C${oct - 1}` : whiteNames[i];

        const pressWhite = (e) => {
          e.preventDefault();
          wKey.classList.add("active");
          playLeadOrLeftNote(midi, 0.8);
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

        // Tecla negra correspondiente
        if (!(oct === 7) && blackMap[whiteNotes[i]] !== undefined) {
          const bMidi = (oct + 1) * 12 + blackMap[whiteNotes[i]];
          const bKey = document.createElement("div");
          bKey.className = "key-black";
          bKey.style.left = `${((whiteIndex + 0.68) / totalWhites) * 100}%`;

          const pressBlack = (e) => {
            e.stopPropagation();
            e.preventDefault();
            bKey.classList.add("active");
            playLeadOrLeftNote(bMidi, 0.85);
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
