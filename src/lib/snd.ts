import Snd from "snd-lib";

// Los únicos tres sonidos de snd-lib que usa la app, a volumen fijo.
export type Sound = "playTap" | "playToggleOn" | "playToggleOff";

let snd: Snd | null = null;

export async function initSounds(): Promise<void> {
  if (snd) return;
  snd = new Snd();
  await snd.load(Snd.KITS.SND01);
}

export function play(sound: Sound): void {
  snd?.[sound]({ volume: 0.25 });
}
