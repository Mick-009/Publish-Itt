import { AvatarQuill } from "./AvatarQuill";
import { AvatarBooks } from "./AvatarBooks";
import { AvatarTypewriter } from "./AvatarTypewriter";
import { AvatarCoffee } from "./AvatarCoffee";
import { AvatarOwl } from "./AvatarOwl";
import { AvatarMoon } from "./AvatarMoon";
import { AvatarLantern } from "./AvatarLantern";
import { AvatarAnchor } from "./AvatarAnchor";

export { AvatarQuill, AvatarBooks, AvatarTypewriter, AvatarCoffee, AvatarOwl, AvatarMoon, AvatarLantern, AvatarAnchor };

export const AVATAR_COMPONENTS = {
  quill: AvatarQuill,
  books: AvatarBooks,
  typewriter: AvatarTypewriter,
  coffee: AvatarCoffee,
  owl: AvatarOwl,
  moon: AvatarMoon,
  lantern: AvatarLantern,
  anchor: AvatarAnchor,
};

export const AVATAR_OPTIONS = [
  { key: "quill",      label: "Quill" },
  { key: "books",      label: "Books" },
  { key: "typewriter", label: "Typewriter" },
  { key: "coffee",     label: "Coffee" },
  { key: "owl",        label: "Owl" },
  { key: "moon",       label: "Moon" },
  { key: "lantern",    label: "Lantern" },
  { key: "anchor",     label: "Anchor" },
];

// Resolve an avatar key to its component, with a safe fallback.
// Used wherever the app needs to render the writer's chosen avatar.
// Returns null when the key is empty, missing, or unrecognised — callers
// should fall back to initials-in-a-circle or just nothing in that case.
export function getAvatarComponent(key) {
  if (!key) return null;
  return AVATAR_COMPONENTS[key] || null;
}
