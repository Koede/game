import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { SCAN_GAP_S, SCAN_S } from './magic';

describe('active scanning', () => {
  const hold = (t: ReturnType<typeof setup>, x: number, secs: number): void => {
    for (let s = 0; s < secs; s += 0.25) {
      t.magic.tick(0.25);
      t.magic.use(t.at(x, 0, 0));
    }
  };

  it('fills a bar while Use is held, and only then gives lore', () => {
    const t = setup();
    t.hold('field_notebook');
    hold(t, 0, SCAN_S / 2);
    expect(t.magic.research.scanned).toEqual([]);
    expect(t.magic.scanLabel()).toMatch(/Scanning Stone \[#+\.+\] \d+%/);
    hold(t, 0, SCAN_S);
    expect(t.magic.research.scanned).toEqual(['stone']);
    expect(t.magic.scanLabel()).toBeNull();
  });

  it('letting go empties the bar; aiming elsewhere restarts it', () => {
    const t = setup();
    t.hold('field_notebook');
    hold(t, 0, SCAN_S * 0.7);
    t.magic.tick(SCAN_GAP_S + 0.2);
    hold(t, 0, SCAN_S * 0.7);
    expect(t.magic.research.scanned).toEqual([]);
    t.put(2, 0, 0, 'copper_ore');
    hold(t, 2, SCAN_S * 0.5);
    hold(t, 0, SCAN_S * 0.5);
    expect(t.magic.research.scanned).toEqual([]);
  });

  it('a scrying lens quickens it; a thing already noted reads out at once', () => {
    const t = setup();
    t.hold('field_notebook');
    t.player.inventory.add('vein_lens', 1);
    hold(t, 0, SCAN_S * 0.9);
    expect(t.magic.research.scanned).toEqual(['stone']);
    const toasts: string[] = [];
    t.bus.on('toast', (e) => toasts.push(e.text));
    t.magic.use(t.at(0, 0, 0));
    expect(toasts.join()).toContain('already in your notes');
  });
});
