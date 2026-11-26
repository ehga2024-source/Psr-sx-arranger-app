window.GM_XG_MAP = {
  0: "001: Concert Grand Piano (XG)",
  1: "002: Bright Yamaha Grand",
  2: "003: Electric Grand CP80",
  4: "005: Stage Rhodes EP (XG)",
  5: "006: DX7 FM Crystal EP",
  8: "009: Celesta",
  11: "012: Vibraphone",
  12: "013: Marimba (Latin)",
  16: "017: Drawbar Organ",
  18: "019: Rock Organ (XG)",
  21: "022: Musette Accordion (Cumbia)",
  22: "023: Harmonica",
  23: "024: Tango / Vallenato Accordion",
  24: "025: Nylon Spanish Guitar",
  25: "026: Steel Folk Guitar",
  26: "027: Jazz Clean Guitar",
  27: "028: Clean Stratocaster (XG)",
  28: "029: Muted Funk/Cumbia Guitar",
  29: "030: Overdrive Guitar",
  30: "031: Distortion Lead Guitar",
  32: "033: Acoustic Upright Bass",
  33: "034: Fingered Electric Bass (Cumbia)",
  34: "035: Picked Bass",
  35: "036: Fretless Bass",
  36: "037: Slap Bass 1 (XG)",
  38: "039: Synth Bass 1 (Sub Cumbia)",
  39: "040: Synth Bass 2 (Punch)",
  40: "041: Solo Violin",
  48: "049: Stereo Strings Ensemble",
  49: "050: Slow Warm Strings",
  50: "051: Synth Strings 1",
  52: "053: Choir Aahs",
  55: "056: Orchestra Hit (XG)",
  56: "057: Solo Trumpet (Latin)",
  57: "058: Trombone (Salsa/Cumbia)",
  59: "060: Muted Trumpet",
  60: "061: French Horns",
  61: "062: Brass Section (XG)",
  62: "063: Synth Brass 1",
  65: "066: Alto Sax",
  66: "067: Tenor Sax",
  71: "072: Clarinet",
  73: "074: Flute",
  75: "076: Pan Flute (Andean/Cumbia)",
  80: "081: Square Lead",
  81: "082: Sawtooth Lead",
  88: "089: Fantasia New Age Pad",
  89: "090: Warm Analog Pad",
  90: "091: Polysynth Pad",
  98: "099: Crystal Bell Pad",
  104: "105: Sitar",
  114: "115: Steel Drums"
};

window.XG_DRUM_KITS = {
  0: "Standard Kit 1 (PSR-SX)",
  1: "Standard Kit 2 (Studio)",
  8: "Room Kit",
  16: "Power Rock Kit",
  24: "Electronic / SPD-20 Kit",
  25: "Analog TR-808/909 Kit",
  32: "Jazz Brush Kit",
  40: "Latin / Cumbia Percussion Kit"
};

window.GM_PERCUSSION_NOTES = [
  { note: 36, name: "Kick Punch (36)", short: "Kick 36" },
  { note: 38, name: "Snare Studio (38)", short: "Snare 38" },
  { note: 37, name: "Side Stick / Rim (37)", short: "Rim 37" },
  { note: 42, name: "Closed Hi-Hat (42)", short: "ClosHH 42" },
  { note: 46, name: "Open Hi-Hat (46)", short: "OpenHH 46" },
  { note: 49, name: "Crash Cymbal (49)", short: "Crash 49" },
  { note: 51, name: "Ride Cymbal (51)", short: "Ride 51" },
  { note: 50, name: "SPD-20 Tom High (50)", short: "SPD TomHi" },
  { note: 47, name: "SPD-20 Tom Mid (47)", short: "SPD TomMd" },
  { note: 43, name: "SPD-20 Tom Low (43)", short: "SPD TomLo" },
  { note: 41, name: "SPD-20 Floor Tom (41)", short: "SPD FlTom" },
  { note: 56, name: "Cowbell / Cencerro (56)", short: "Cowbell 56" },
  { note: 73, name: "Short Guiro (73)", short: "GuiroSh 73" },
  { note: 74, name: "Long Guiro (74)", short: "GuiroLg 74" },
  { note: 62, name: "Mute High Conga (62)", short: "CongaMt 62" },
  { note: 63, name: "Open High Conga (63)", short: "CongaHi 63" },
  { note: 64, name: "Low Conga / Tumba (64)", short: "CongaLo 64" },
  { note: 65, name: "High Timbale (65)", short: "TimbHi 65" },
  { note: 66, name: "Low Timbale (66)", short: "TimbLo 66" },
  { note: 75, name: "Claves (75)", short: "Claves 75" },
  { note: 82, name: "Shaker / Maraca (82)", short: "Shaker 82" }
];

window.resolveXgVoice = function (program = 0, bankMsb = 0, bankLsb = 112) {
  if (bankMsb === 127) {
    return window.XG_DRUM_KITS[program] || `Drum Kit #${program + 1}`;
  }
  const baseName = window.GM_XG_MAP[program] || `GM Voice #${program + 1}`;
  return bankLsb === 112 ? `${baseName} [XG]` : baseName;
};
