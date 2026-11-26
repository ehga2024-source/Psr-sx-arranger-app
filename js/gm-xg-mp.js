window.GM_XG_MAP = {
  0: "Concert Grand",
  4: "Electric Piano 1",
  16: "Drawbar Organ",
  24: "Nylon Guitar",
  25: "Steel Guitar",
  29: "Overdriven Guitar",
  30: "Distortion Guitar",
  33: "Finger Bass",
  34: "Pick Bass",
  40: "Violin",
  48: "String Ensemble",
  56: "Trumpet",
  61: "Brass Section",
  80: "Square Lead",
  88: "New Age Pad"
};

window.DRUM_MAP = {
  35: "Kick",
  36: "Kick",
  38: "Snare",
  40: "Snare",
  42: "Closed HH",
  44: "Closed HH",
  46: "Open HH",
  49: "Crash / Perc",
  51: "Crash / Perc"
};

window.resolveXgVoice = function (program = 0, bankMsb = 0, bankLsb = 0) {
  const baseName = window.GM_XG_MAP[program] || `GM Voice #${program}`;
  if (bankMsb === 8) {
    return `${baseName} (MegaVoice Mapped)`;
  }
  if (bankMsb === 127 || bankLsb > 0) {
    return `${baseName} (XG Bank ${bankMsb}/${bankLsb})`;
  }
  return `${baseName} (GM/XG)`;
};
