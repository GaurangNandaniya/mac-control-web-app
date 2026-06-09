// Static Mac keyboard layout for OnScreenKeyboard.
// Key kinds: char {label,value}; special {label,value}; mod {label,mod}. `w` = flex-grow weight.
const C = (label, value) => ({ t: "char", label, value });
const S = (label, value, w = 1) => ({ t: "special", label, value, w });
const M = (label, mod, w = 1) => ({ t: "mod", label, mod, w });

export const KEY_ROWS = [
  [S("esc", "esc", 1.2), S("F1", "f1"), S("F2", "f2"), S("F3", "f3"), S("F4", "f4"),
   S("F5", "f5"), S("F6", "f6"), S("F7", "f7"), S("F8", "f8"), S("F9", "f9"),
   S("F10", "f10"), S("F11", "f11"), S("F12", "f12")],
  [C("`", "`"), C("1", "1"), C("2", "2"), C("3", "3"), C("4", "4"), C("5", "5"),
   C("6", "6"), C("7", "7"), C("8", "8"), C("9", "9"), C("0", "0"), C("-", "-"),
   C("=", "="), S("⌫", "backspace", 1.6)],
  [S("tab", "tab", 1.5), C("Q", "q"), C("W", "w"), C("E", "e"), C("R", "r"), C("T", "t"),
   C("Y", "y"), C("U", "u"), C("I", "i"), C("O", "o"), C("P", "p"), C("[", "["),
   C("]", "]"), C("\\", "\\")],
  [S("caps", "caps", 1.7), C("A", "a"), C("S", "s"), C("D", "d"), C("F", "f"), C("G", "g"),
   C("H", "h"), C("J", "j"), C("K", "k"), C("L", "l"), C(";", ";"), C("'", "'"),
   S("return", "enter", 1.8)],
  [M("⇧", "shift", 2), C("Z", "z"), C("X", "x"), C("C", "c"), C("V", "v"), C("B", "b"),
   C("N", "n"), C("M", "m"), C(",", ","), C(".", "."), C("/", "/"), M("⇧", "shift", 2)],
  [M("⌃", "ctrl"), M("⌥", "option"), M("⌘", "cmd"), S("space", "space", 5),
   M("⌘", "cmd"), M("⌥", "option"), S("←", "left"), S("↑", "up"), S("↓", "down"), S("→", "right")],
];

export const MOD_SYMBOL = { cmd: "⌘", option: "⌥", ctrl: "⌃", shift: "⇧" };
