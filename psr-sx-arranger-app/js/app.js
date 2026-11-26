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

  const el = {
    btnStartStop: document.getElementById("btnStartStop"),
    btnTapTempo: document.getElementById("btnTapTempo"),
    inputTempo: document.getElementById("inputTempo"),
    chordDisplay: document.getElementById("chordDisplay"),
    tabContent: document.getElementById("tabContent"),
    voiceRight1: document.getElementById("voiceRight1"),
    activeStyleName: document.getElementById("activeStyleName"),
    activeBankName: document.getElementById("activeBankName"),
    keyboard: document.getElementById("keyboard"),
    midiStatus: document.getElementById("midiStatus")
  };

  function getStepIntervalMs() {
    const bpm = Math.max(40, Math.min(280, Number(el.inputTempo.value) || 120));
    // 16 pasos por compás de 4/4 => cada paso es una semicorchea (1/4 de negra)
    return (60000 / bpm) / 4;
  }

  function playStep(stepIndex) {
    const sec = sty.currentSection;
    const secData = sty.patterns[sec];
    if (!secData) return;

    // Batería y percusión (CH 9 y CH 10)
    [9, 10].forEach((ch) => {
      const notes = secData[ch]?.[stepIndex] || [];
      notes.forEach((n) => audio.playDrum(n, 0.85));
    });

    // Bajo (CH 11)
    (secData[11]?.[stepIndex] || []).forEach((n) => {
      const transposed = sty.transposeNote(n - 12, sty.currentChord);
      audio.playNote(transposed, 0.22, 0.7, "triangle");
    });

    // Acordes y frases (CH 12 a CH 16)
    [12, 13, 14, 15, 16].forEach((ch) => {
      const notes = secData[ch]?.[stepIndex] || [];
      notes.forEach((n) => {
        const transposed = sty.transposeNote(n, sty.currentChord);
        const wave = ch === 14 ? "sine" : ch >= 15 ? "sawtooth" : "triangle";
        audio.playNote(transposed, 0.24, 0.45, wave);
      });
    });

    highlightCreatorStep(stepIndex);
  }

  function startPlayback() {
    if (isPlaying) return;
    audio.ensureContext();
    isPlaying = true;
    currentStep = 0;
    el.btnStartStop.classList.add("playing");
    el.btnStartStop.textContent = "STOP";

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
    el.btnStartStop.classList.remove("playing");
    el.btnStartStop.textContent = "START / STOP";
    highlightCreatorStep(-1);
  }

  function setChord(chordSymbol) {
    sty.currentChord = chordSymbol;
    el.chordDisplay.textContent = `ACORDE: ${chordSymbol}`;
    document.querySelectorAll(".chord-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.chord === chordSymbol);
    });
  }

  function setSection(sectionName) {
    if (!sty.sections.includes(sectionName)) return;
    sty.currentSection = sectionName;
    document.querySelectorAll(".style-sec").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === sectionName);
    });
    if (activeTab === "creator") {
      renderTab();
    }
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
        Number(cell.dataset.stepCol) === stepIndex ? "2px solid #58a6ff" : "none";
    });
  }

  function renderMainTab() {
    const metrics = audio.getLatencyMetrics();
    el.tabContent.innerHTML = `
      <h3>Estado del Sistema Arranger</h3>
      <p><strong>Estilo activo:</strong> ${sty.styleName} | <strong>Sección:</strong> ${sty.currentSection}</p>
      <p><strong>Bloque CASM:</strong> ${sty.casmDetected ? "Detectado en .STY" : "Modo GM/XG / Motor interno"}</p>
      <p><strong>Latencia estimada (cable):</strong> ~${metrics.totalWiredMs} ms (Buffer ${metrics.bufferSize} @ ${metrics.sampleRate} Hz)</p>
      <hr style="margin:10px 0;border-color:#1e2733" />
      <h4>Reproductor de Canción (.WAV / .MP3)</h4>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button id="btnPlaySong" class="btn">▶ Play Song</button>
        <button id="btnLoopSong" class="btn">🔁 Loop Song</button>
        <button id="btnStopSong" class="btn">⏹ Stop Song</button>
        <span id="songLabel" style="align-self:center;color:#9ba3b0;">${
          audio.songBuffer ? audio.songBuffer.name : "Sin pista cargada"
        }</span>
      </div>
    `;

    document.getElementById("btnPlaySong")?.addEventListener("click", () => {
      if (!audio.playSong(false)) {
        alert("Carga primero un archivo .WAV o .MP3 en la pestaña 2. ARCHIVOS.");
      }
    });
    document.getElementById("btnLoopSong")?.addEventListener("click", () => {
      if (!audio.playSong(true)) {
        alert("Carga primero un archivo .WAV o .MP3 en la pestaña 2. ARCHIVOS.");
      }
    });
    document.getElementById("btnStopSong")?.addEventListener("click", () => audio.stopSong());
  }

  function renderFilesTab() {
    el.tabContent.innerHTML = `
      <h3>Carga de Archivos (.STY, .SF2, .WAV, .MP3)</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:10px;">
        <div style="background:#11161d;padding:10px;border-radius:6px;border:1px solid #262f3d;">
          <strong>1. Estilo Yamaha (.STY)</strong><br/>
          <input type="file" id="fileSty" accept=".sty,.mid" style="margin-top:8px;width:100%;" />
          <div id="styStatus" style="margin-top:6px;font-size:0.78rem;color:#8b949e;">Estilo actual: ${sty.styleName}</div>
        </div>
        <div style="background:#11161d;padding:10px;border-radius:6px;border:1px solid #262f3d;">
          <strong>2. Banco SoundFont (.SF2)</strong><br/>
          <input type="file" id="fileSf2" accept=".sf2,.sf3" style="margin-top:8px;width:100%;" />
          <div id="sf2Status" style="margin-top:6px;font-size:0.78rem;color:#8b949e;">${
            audio.sf2Info ? `${audio.sf2Info.name} (${audio.sf2Info.sizeMB} MB)` : "Sin .SF2 externo"
          }</div>
        </div>
        <div style="background:#11161d;padding:10px;border-radius:6px;border:1px solid #262f3d;">
          <strong>3. Pista WAV / MP3</strong><br/>
          <input type="file" id="fileAudio" accept=".wav,.mp3,audio/*" style="margin-top:8px;width:100%;" />
          <div id="audioStatus" style="margin-top:6px;font-size:0.78rem;color:#8b949e;">${
            audio.songBuffer ? audio.songBuffer.name : "Sin audio cargado"
          }</div>
        </div>
      </div>
      <div style="margin-top:12px;">
        <strong>Asignar WAV/MP3 a Multi Pad:</strong>
        <select id="padSelect" style="background:#171c24;color:#e6edf3;border:1px solid #303b4d;padding:4px 8px;border-radius:4px;">
          <option value="0">PAD 1</option>
          <option value="1">PAD 2</option>
          <option value="2">PAD 3</option>
          <option value="3">PAD 4</option>
        </select>
        <input type="file" id="filePad" accept=".wav,.mp3,audio/*" style="margin-left:8px;" />
      </div>
    `;

    document.getElementById("fileSty")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const info = await sty.loadStyFile(file);
      el.activeStyleName.textContent = info.name;
      setSection(sty.currentSection);
      document.getElementById("styStatus").textContent =
        `Cargado: ${info.name} | Secciones: ${info.detectedSections.join(", ")}`;
    });

    document.getElementById("fileSf2")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const info = await audio.loadSf2File(file);
        el.activeBankName.textContent = info.name;
        el.voiceRight1.textContent = window.resolveXgVoice(0, 0, 112);
        document.getElementById("sf2Status").textContent = `Cargado: ${info.name} (${info.sizeMB} MB)`;
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("fileAudio")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const info = await audio.loadAudioFile(file, "song");
      document.getElementById("audioStatus").textContent = `Canción lista: ${info.name}`;
    });

    document.getElementById("filePad")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      const padIdx = Number(document.getElementById("padSelect")?.value || 0);
      if (!file) return;
      const info = await audio.loadAudioFile(file, "pad", padIdx);
      const padBtn = document.querySelector(`.pad-btn[data-pad="${padIdx}"]`);
      if (padBtn) padBtn.textContent = `PAD ${padIdx + 1}: ${info.name.slice(0, 8)}`;
    });
  }

  function renderCreatorTab() {
    const rows = getRowsForChannel(creatorChannel);
    if (!rows.some((r) => r.note === creatorRowNote)) {
      creatorRowNote = rows[0].note;
    }

    const channelOptions = [9, 10, 11, 12, 13, 14, 15, 16]
      .map(
        (ch) =>
          `<option value="${ch}" ${ch === creatorChannel ? "selected" : ""}>CH ${ch} (${
            ch === 9
              ? "Sub-Rhythm"
              : ch === 10
              ? "Rhythm"
              : ch === 11
              ? "Bass"
              : ch <= 14
              ? "Chord/Pad"
              : "Phrase"
          })</option>`
      )
      .join("");

    const rowOptions = rows
      .map(
        (r) =>
          `<option value="${r.note}" ${r.note === creatorRowNote ? "selected" : ""}>${r.label}</option>`
      )
      .join("");

    const stepCells = Array.from({ length: 16 }, (_, s) => {
      const activeNotes = sty.patterns[sty.currentSection]?.[creatorChannel]?.[s] || [];
      const hasNote = activeNotes.includes(creatorRowNote);
      return `<button class="btn ${hasNote ? "active" : ""}" data-step-col="${s}" data-toggle-step="${s}" style="padding:6px 4px;font-size:0.75rem;">${
        s + 1
      }</button>`;
    }).join("");

    el.tabContent.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">
        <strong>Sección: ${sty.currentSection}</strong>
        <select id="creatorCh" style="background:#171c24;color:#e6edf3;border:1px solid #303b4d;padding:4px 8px;border-radius:4px;">
          ${channelOptions}
        </select>
        <select id="creatorNote" style="background:#171c24;color:#e6edf3;border:1px solid #303b4d;padding:4px 8px;border-radius:4px;">
          ${rowOptions}
        </select>
        <button id="btnRecLive" class="btn ${isRecording ? "active" : ""}">● REC</button>
        <button id="btnExportSty" class="btn btn-primary">💾 EXPORTAR .STY</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(16,1fr);gap:4px;">
        ${stepCells}
      </div>
      <p style="margin-top:8px;font-size:0.78rem;color:#8b949e;">
        Graba notas melódicas sobre Do Mayor (C, E, G) para que el motor las transporte según el acorde activo.
      </p>
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
      a.download = `${sty.styleName.toLowerCase().replace(/[^a-z0-9]+/gi, "_") || "custom_style"}.sty`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.querySelectorAll("[data-toggle-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = Number(btn.dataset.toggleStep);
        sty.toggleStepNote(sty.currentSection, creatorChannel, s, creatorRowNote);
        if (creatorChannel === 9 || creatorChannel === 10) {
          audio.playDrum(creatorRowNote, 0.8);
        } else {
          audio.playNote(sty.transposeNote(creatorRowNote, sty.currentChord), 0.2, 0.65);
        }
        renderCreatorTab();
      });
    });
  }

  function renderLatencyTab() {
    const m = audio.getLatencyMetrics();
    el.tabContent.innerHTML = `
      <h3>Buffer y Latencia en Web / Android</h3>
      <label>
        Tamaño de Buffer:
        <select id="bufferSelect" style="background:#171c24;color:#e6edf3;border:1px solid #303b4d;padding:4px 8px;border-radius:4px;margin-left:6px;">
          ${[128, 256, 512, 1024]
            .map(
              (sz) =>
                `<option value="${sz}" ${sz === audio.bufferSize ? "selected" : ""}>${sz} muestras</option>`
            )
            .join("")}
        </select>
      </label>
      <ul style="margin:10px 0 10px 18px;font-size:0.84rem;">
        <li><strong>Sample Rate:</strong> ${m.sampleRate} Hz</li>
        <li><strong>Salida estimada de buffer:</strong> ${m.outputMs} ms</li>
        <li><strong>Total estimado por cable / USB OTG:</strong> ~${m.totalWiredMs} ms</li>
        <li><strong>Retardo extra aproximado con Bluetooth:</strong> ~${m.estimatedBluetoothMs} ms</li>
      </ul>
      <p style="font-size:0.8rem;color:#9ba3b0;">
        Para probar o tocar en directo en Android, usa auriculares o salida por cable y teclado por USB OTG evitando Bluetooth.
      </p>
    `;

    document.getElementById("bufferSelect")?.addEventListener("change", (e) => {
      audio.setBufferSize(Number(e.target.value));
      renderLatencyTab();
    });
  }

  function renderTab() {
    if (activeTab === "files") return renderFilesTab();
    if (activeTab === "creator") return renderCreatorTab();
    if (activeTab === "latency") return renderLatencyTab();
    return renderMainTab();
  }

  function buildKeyboard() {
    const noteNames = ["C", "D", "E", "F", "G", "A", "B"];
    const scaleOffsets = [0, 2, 4, 5, 7, 9, 11];
    el.keyboard.innerHTML = "";

    // Dos octavas de teclas blancas: C3 (48) a B4 (71)
    for (let oct = 3; oct <= 4; oct++) {
      for (let i = 0; i < 7; i++) {
        const midi = (oct + 1) * 12 + scaleOffsets[i];
        const keyEl = document.createElement("button");
        keyEl.type = "button";
        keyEl.className = `white-key ${midi <= 59 ? "split-left" : ""}`;
        keyEl.textContent = `${noteNames[i]}${oct}`;

        keyEl.addEventListener("pointerdown", () => {
          keyEl.classList.add("active");
          if (midi <= 59) {
            // Zona izquierda: acorde mayor/menor rápido según tecla pulsada
            const chordMap = {
              48: "Cmaj7", 50: "Dm7", 52: "Em7", 53: "Fmaj7",
              55: "G7", 57: "Am7", 59: "G7"
            };
            if (chordMap[midi]) setChord(chordMap[midi]);
            audio.playNote(midi, 0.3, 0.6, "triangle");
          } else {
            audio.playNote(midi, 0.35, 0.75, "triangle");
          }

          if (isRecording) {
            sty.recordLiveNote(sty.currentSection, creatorChannel, currentStep, midi);
          }
        });

        const releaseKey = () => keyEl.classList.remove("active");
        keyEl.addEventListener("pointerup", releaseKey);
        keyEl.addEventListener("pointerleave", releaseKey);

        el.keyboard.appendChild(keyEl);
      }
    }
  }

  function initWebMidi() {
    if (!navigator.requestMIDIAccess) {
      el.midiStatus.textContent = "MIDI: WebMIDI no disponible en este navegador";
      return;
    }
    navigator.requestMIDIAccess().then(
      (access) => {
        const inputs = Array.from(access.inputs.values());
        el.midiStatus.textContent = inputs.length
          ? `MIDI conectado: ${inputs[0].name}`
          : "MIDI: Conecta un teclado USB / OTG";

        inputs.forEach((input) => {
          input.onmidimessage = (msg) => {
            const [status, data1, data2] = msg.data;
            const cmd = status & 0xf0;
            if (cmd === 0x90 && data2 > 0) {
              audio.playNote(data1, 0.35, data2 / 127, "triangle");
              if (isRecording) {
                sty.recordLiveNote(sty.currentSection, creatorChannel, currentStep, data1);
              }
            }
          };
        });
      },
      () => {
        el.midiStatus.textContent = "MIDI: Permiso denegado o sin soporte";
      }
    );
  }

  function bindEvents() {
    el.btnStartStop.addEventListener("click", () => {
      if (isPlaying) stopPlayback();
      else startPlayback();
    });

    el.btnTapTempo.addEventListener("click", () => {
      const now = performance.now();
      tapTimes = tapTimes.filter((t) => now - t < 2500);
      tapTimes.push(now);
      if (tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
          intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        el.inputTempo.value = Math.max(40, Math.min(280, Math.round(60000 / avgMs)));
      }
    });

    document.querySelectorAll(".style-sec").forEach((btn) => {
      btn.addEventListener("click", () => setSection(btn.dataset.section));
    });

    document.querySelectorAll(".chord-btn").forEach((btn) => {
      btn.addEventListener("click", () => setChord(btn.dataset.chord));
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach((b) =>
          b.classList.toggle("active", b.dataset.tab === activeTab)
        );
        renderTab();
      });
    });

    document.querySelectorAll(".pad-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.pad);
        if (!audio.triggerPad(idx)) {
          alert(`PAD ${idx + 1} vacío. Cárga un .WAV o .MP3 en la pestaña 2. ARCHIVOS.`);
        }
      });
    });
  }

  // Inicialización
  buildKeyboard();
  bindEvents();
  initWebMidi();
  renderTab();
})();
