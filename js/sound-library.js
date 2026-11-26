(function () {
  const GM_128 = [
    "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano",
    "Electric Piano 1 (Rhodes)", "Electric Piano 2 (DX)", "Harpsichord", "Clavi",
    "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
    "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
    "Acoustic Guitar (Nylon)", "Acoustic Guitar (Steel)", "Electric Guitar (Jazz)", "Electric Guitar (Clean)",
    "Electric Guitar (Muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
    "Acoustic Bass", "Finger Electric Bass", "Picked Electric Bass", "Fretless Bass",
    "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
    "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
    "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2",
    "Choir Aahs", "Voice Oohs", "Synth Choir", "Orchestra Hit",
    "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2",
    "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
    "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
    "Lead 1 (Square)", "Lead 2 (Sawtooth)", "Lead 3 (Calliope)", "Lead 4 (Chiff)",
    "Lead 5 (Charang)", "Lead 6 (Voice)", "Lead 7 (Fifths)", "Lead 8 (Bass + Lead)",
    "Pad 1 (New Age)", "Pad 2 (Warm)", "Pad 3 (Polysynth)", "Pad 4 (Choir)",
    "Pad 5 (Bowed)", "Pad 6 (Metallic)", "Pad 7 (Halo)", "Pad 8 (Sweep)",
    "FX 1 (Rain)", "FX 2 (Soundtrack)", "FX 3 (Crystal)", "FX 4 (Atmosphere)",
    "FX 5 (Brightness)", "FX 6 (Goblins)", "FX 7 (Echoes)", "FX 8 (Sci-Fi)",
    "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bagpipe", "Fiddle", "Shanai",
    "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
    "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot"
  ];

  const GM_XG_FOLDERS = [
    { id: "gm_piano", label: "Piano (GM/XG)", range: [0, 7] },
    { id: "gm_chrom", label: "Chromatic (GM/XG)", range: [8, 15] },
    { id: "gm_organ", label: "Organ / Acord (GM/XG)", range: [16, 23] },
    { id: "gm_guitar", label: "Guitar (GM/XG)", range: [24, 31] },
    { id: "gm_bass", label: "Bass (GM/XG)", range: [32, 39] },
    { id: "gm_strings", label: "Strings (GM/XG)", range: [40, 47] },
    { id: "gm_ensemble", label: "Ensemble (GM/XG)", range: [48, 55] },
    { id: "gm_brass", label: "Brass (GM/XG)", range: [56, 63] },
    { id: "gm_reed", label: "Sax / Reed (GM/XG)", range: [64, 71] },
    { id: "gm_pipe", label: "Flute / Pipe (GM/XG)", range: [72, 79] },
    { id: "gm_lead", label: "Synth Lead (GM/XG)", range: [80, 87] },
    { id: "gm_pad", label: "Synth Pad (GM/XG)", range: [88, 95] },
    { id: "gm_fx", label: "Synth FX (GM/XG)", range: [96, 103] },
    { id: "gm_ethnic", label: "Ethnic (GM/XG)", range: [104, 111] },
    { id: "gm_perc", label: "Percussive (GM/XG)", range: [112, 119] },
    { id: "gm_sfx", label: "Sound FX (GM/XG)", range: [120, 127] }
  ];

  const ROLAND_XP10_ITEMS = [
    { code: "XP-001", name: "64Voice Piano", section: "XP-10 Piano", program: 0, note: 60 },
    { code: "XP-002", name: "Bright XP Piano", section: "XP-10 Piano", program: 1, note: 60 },
    { code: "XP-003", name: "Stage EP / Rhodes", section: "XP-10 E.Piano", program: 4, note: 60 },
    { code: "XP-004", name: "FM Crystal EP", section: "XP-10 E.Piano", program: 5, note: 60 },
    { code: "XP-005", name: "XP Jazz Organ", section: "XP-10 Organ", program: 16, note: 60 },
    { code: "XP-006", name: "Rock Rotary Organ", section: "XP-10 Organ", program: 18, note: 60 },
    { code: "XP-007", name: "Norteño Accordion", section: "XP-10 Organ", program: 21, note: 60 },
    { code: "XP-008", name: "Clean Strat / Cumbia", section: "XP-10 Guitar", program: 27, note: 60 },
    { code: "XP-009", name: "Overdrive Lead Gtr", section: "XP-10 Guitar", program: 29, note: 60 },
    { code: "XP-010", name: "XP Finger Bass", section: "XP-10 Bass", program: 33, note: 36 },
    { code: "XP-011", name: "Slap Bass XP", section: "XP-10 Bass", program: 36, note: 36 },
    { code: "XP-012", name: "JV Synth Bass", section: "XP-10 Bass", program: 38, note: 36 },
    { code: "XP-013", name: "Warm Strings XP", section: "XP-10 Strings", program: 48, note: 60 },
    { code: "XP-014", name: "XP Brass Section", section: "XP-10 Brass", program: 61, note: 60 },
    { code: "XP-015", name: "JV Synth Brass", section: "XP-10 Brass", program: 62, note: 60 },
    { code: "XP-016", name: "D-50 Fantasia Pad", section: "XP-10 Pad/Lead", program: 88, note: 60 },
    { code: "XP-017", name: "XP Sawtooth Lead", section: "XP-10 Pad/Lead", program: 81, note: 60 },
    { code: "XP-018", name: "XP Rhythm / Perc Kit", section: "XP-10 Drums", program: 10, isDrum: true, note: 36 }
  ];

  const KORG_N364_ITEMS = [
    { code: "N364-01", name: "AI2 Grand Piano", section: "N364 Piano", program: 0, note: 60 },
    { code: "N364-02", name: "Classic Tine EP", section: "N364 E.Piano", program: 4, note: 60 },
    { code: "N364-03", name: "DWGS Clavi Funk", section: "N364 E.Piano", program: 7, note: 60 },
    { code: "N364-04", name: "N364 Drawbar Organ", section: "N364 Organ", program: 17, note: 60 },
    { code: "N364-05", name: "Bandoneon / Acordeón", section: "N364 Organ", program: 23, note: 60 },
    { code: "N364-06", name: "AI2 Nylon Guitar", section: "N364 Guitar", program: 24, note: 60 },
    { code: "N364-07", name: "Chorus Clean Guitar", section: "N364 Guitar", program: 27, note: 60 },
    { code: "N364-08", name: "N364 Finger Bass", section: "N364 Bass", program: 33, note: 36 },
    { code: "N364-09", name: "AI2 Synth Bass", section: "N364 Bass", program: 39, note: 36 },
    { code: "N364-10", name: "Lush AI2 Strings", section: "N364 Strings", program: 49, note: 60 },
    { code: "N364-11", name: "N364 Brass Hit", section: "N364 Brass", program: 61, note: 60 },
    { code: "N364-12", name: "Tenor Sax AI2", section: "N364 Brass", program: 66, note: 60 },
    { code: "N364-13", name: "N364 Analog Lead", section: "N364 Synth", program: 80, note: 60 },
    { code: "N364-14", name: "AI2 Sweep Pad", section: "N364 Synth", program: 95, note: 60 },
    { code: "N364-15", name: "N364 Drum / Perc Kit", section: "N364 Drums", program: 10, isDrum: true, note: 38 }
  ];

  const DRUM_KITS_LIST = [
    { code: "DRUM-01", name: "Standard Kit (GM/XG)", note: 36 },
    { code: "DRUM-02", name: "Cumbia Güiro & Timbal", note: 73 },
    { code: "DRUM-03", name: "SPD-20 Toms & Rimshot", note: 50 },
    { code: "DRUM-04", name: "Congas & Cowbell Mex", note: 63 }
  ];

  function getSoundFolders() {
    return [
      { id: "roland_xp10", label: "Roland XP-10", group: "Hardware Banks" },
      { id: "korg_n364", label: "Korg N364", group: "Hardware Banks" },
      { id: "drum_kits", label: "Batería / Perc Kits", group: "Drums" },
      ...GM_XG_FOLDERS.map((f) => ({ ...f, group: "GM / XG" }))
    ];
  }

  function getSoundsInFolder(folderId, query = "") {
    const q = (query || "").trim().toLowerCase();
    let list = [];

    if (folderId === "roland_xp10") {
      list = ROLAND_XP10_ITEMS.map((item, i) => ({
        id: `xp10_${i}`,
        code: item.code,
        name: item.name,
        subLabel: item.section,
        program: item.program,
        isDrum: Boolean(item.isDrum),
        previewNote: item.note
      }));
    } else if (folderId === "korg_n364") {
      list = KORG_N364_ITEMS.map((item, i) => ({
        id: `n364_${i}`,
        code: item.code,
        name: item.name,
        subLabel: item.section,
        program: item.program,
        isDrum: Boolean(item.isDrum),
        previewNote: item.note
      }));
    } else if (folderId === "drum_kits") {
      list = DRUM_KITS_LIST.map((d, i) => ({
        id: `drum_${i}`,
        code: d.code,
        name: d.name,
        subLabel: "GM/XG Percussion",
        program: 10,
        isDrum: true,
        previewNote: d.note
      }));
    } else {
      const folder = GM_XG_FOLDERS.find((f) => f.id === folderId) || GM_XG_FOLDERS[0];
      const [start, end] = folder.range;
      for (let prog = start; prog <= end; prog++) {
        list.push({
          id: `gm_${prog}`,
          code: `GM ${String(prog + 1).padStart(3, "0")}`,
          name: GM_128[prog] || `Voice ${prog + 1}`,
          subLabel: `${folder.label} (XG)`,
          program: prog,
          isDrum: false,
          previewNote: prog >= 32 && prog <= 39 ? 36 : 60
        });
      }
    }

    if (!q) return list;
    return list.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.code.toLowerCase().includes(q) ||
        x.subLabel.toLowerCase().includes(q)
    );
  }

  window.SoundLibrary = {
    getSoundFolders,
    getSoundsInFolder
  };
})();
