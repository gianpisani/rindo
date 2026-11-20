import Snd from "snd-lib";

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
