import type { SavePipeline } from "./savePipeline";

const live = new Set<SavePipeline>();
const finishing = new Set<Promise<void>>();

/** Adds a mounted editor's pipeline; the returned function removes it. */
export function registerPipeline(p: SavePipeline): () => void {
  live.add(p);
  return () => {
    live.delete(p);
  };
}

/**
 * For an unmounting editor: unregisters, runs one last flush that `flushAll()` waits for, then
 * disposes. If that flush failed, the pipeline keeps retrying in the background and disposes
 * itself once it has saved, so a transient failure on page leave does not lose text.
 */
export function retirePipeline(p: SavePipeline, unregister: () => void): void {
  unregister();
  const done: Promise<void> = p
    .flush()
    .then(() => {
      if (p.status() !== "error") return p.dispose();
      const off = p.onStatus((s) => {
        if (s !== "saved") return;
        off();
        p.dispose();
      });
    })
    .finally(() => finishing.delete(done));
  finishing.add(done);
}

/** Flushes every live pipeline and waits for final flushes of just-unmounted ones. */
export async function flushAll(): Promise<void> {
  await Promise.all([...[...live].map((p) => p.flush()), ...finishing]);
}
