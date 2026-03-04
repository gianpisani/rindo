import Snd from "snd-lib";

let instance: Snd | null = null;
let loaded = false;

export async function initSounds(): Promise<void> {
  if (loaded) return;
  if (!instance) {
    instance = new Snd();
  }
  await instance.load(Snd.KITS.SND01);
  loaded = true;
}

export function getSnd(): Snd | null {
  return instance;
}
