/**
 * The Tool Builder (docs/plans/modular-tools.md): pick a kind, a head, a handle and a binding, see the numbers against the
 * tool in your hand, and build it from parts in the pack. Below it, Rework: swap one part of a tool you carry for another from
 * the pack (the old part comes back). Selects, so it works the same with a finger as with a mouse.
 */
import {
  BINDINGS, DEFAULT_BINDING, DEFAULT_HANDLE, HANDLES, HEADS, KIND_HEADS, KIND_LABEL, MODULAR_KINDS, partsOfItem, type ModularKind, type PartRole, type ToolBuild,
} from '../../../content/toolParts';
import type { GameBus } from '../../../core/context';
import type { PlayerState } from '../../../game';
import { buildTool, buildTraits, canBuildNow, missingForBuild, nameOfItem, partNeeds as reworkCost, previewRows, reworkTool, reworkable } from '../../../game/toolBuilder';
import { h } from '../../kit/dom';

/** The last choice, kept for the next visit. */
let last: ToolBuild = { kind: 'pickaxe', head: 'flint', handle: DEFAULT_HANDLE, binding: DEFAULT_BINDING };

const option = (value: string, text: string): HTMLOptionElement => h('option', { text, attrs: { value } });

export class ToolBuilderPanel {
  readonly el: HTMLDetailsElement;
  private readonly kind = h('select', { class: 'hw-tb__sel', attrs: { 'aria-label': 'Tool' } });
  private readonly head = h('select', { class: 'hw-tb__sel', attrs: { 'aria-label': 'Head' } });
  private readonly handle = h('select', { class: 'hw-tb__sel', attrs: { 'aria-label': 'Handle' } });
  private readonly binding = h('select', { class: 'hw-tb__sel', attrs: { 'aria-label': 'Binding' } });
  private readonly stats = h('table', { class: 'hw-tb__stats' });
  private readonly traits = h('ul', { class: 'hw-tb__traits' });
  private readonly note = h('p', { class: 'hw-tb__note' });
  private readonly buildBtn = h('button', { class: 'hw-btn', text: 'Build', attrs: { type: 'button' }, on: { click: () => this.build() } });
  private readonly tool = h('select', { class: 'hw-tb__sel', attrs: { 'aria-label': 'Tool to rework' } });
  private readonly role = h('select', { class: 'hw-tb__sel', attrs: { 'aria-label': 'Part to replace' } });
  private readonly part = h('select', { class: 'hw-tb__sel', attrs: { 'aria-label': 'Replacement part' } });
  private readonly reworkBtn = h('button', { class: 'hw-btn', text: 'Replace', attrs: { type: 'button' }, on: { click: () => this.rework() } });
  private readonly reworkNote = h('p', { class: 'hw-tb__note' });
  private sig = '';

  constructor(private readonly opts: { player: PlayerState; bus: GameBus; changed: () => void }) {
    this.kind.append(...MODULAR_KINDS.map((k) => option(k, KIND_LABEL[k])));
    for (const sel of [this.kind, this.head, this.handle, this.binding]) sel.addEventListener('change', () => this.pick());
    for (const sel of [this.tool, this.role, this.part]) sel.addEventListener('change', () => this.refreshRework());
    this.tool.addEventListener('change', () => { this.role.value = this.role.value || 'head'; });
    this.role.append(option('head', 'Head'), option('handle', 'Handle'), option('binding', 'Binding'));
    const row = (label: string, sel: HTMLElement): HTMLElement => h('label', { class: 'hw-tb__row' }, h('span', { text: label }), sel);
    this.el = h(
      'details',
      { class: 'hw-tb' },
      h('summary', { text: 'Tool builder' }),
      h(
        'div',
        { class: 'hw-tb__body' },
        row('Tool', this.kind), row('Head', this.head), row('Handle', this.handle), row('Binding', this.binding),
        this.stats, this.traits, this.note, this.buildBtn,
        h('h4', { class: 'hw-heading', text: 'Rework a tool' }),
        row('Tool', this.tool), row('Replace', this.role), row('With', this.part), this.reworkNote, this.reworkBtn,
      ),
    );
    this.refresh(true);
  }

  private current(): ToolBuild {
    const kind = (this.kind.value || last.kind) as ModularKind;
    const head = KIND_HEADS[kind].includes(this.head.value) ? this.head.value : KIND_HEADS[kind][0];
    return { kind, head, handle: this.handle.value || last.handle, binding: this.binding.value || last.binding };
  }

  private pick(): void {
    last = this.current();
    this.sig = '';
    this.refresh();
  }

  private build(): void {
    const { player, bus, changed } = this.opts;
    const b = this.current();
    const r = buildTool(player, b);
    if (!r.ok) {
      bus.emit('toast', { text: r.reason, kind: 'warn' });
      bus.emit('sfx', { name: 'error' });
    }
    this.sig = '';
    changed();
  }

  private rework(): void {
    const { player, bus, changed } = this.opts;
    const slot = Number(this.tool.value);
    const r = reworkTool(player.inventory, slot, this.role.value as PartRole, this.part.value);
    if (r.ok) {
      bus.emit('toast', { text: `Rebuilt as ${nameOfItem(r.item)}`, kind: 'good', item: r.item });
      bus.emit('sfx', { name: 'craft' });
    } else {
      bus.emit('toast', { text: r.reason, kind: 'warn' });
      bus.emit('sfx', { name: 'error' });
    }
    this.sig = '';
    changed();
  }

  /** What is in hand, as a build to compare with (any tool made of parts), or null. */
  private held(): ToolBuild | null {
    const s = this.opts.player.heldStack();
    return s ? partsOfItem(s.item) : null;
  }

  private fill(sel: HTMLSelectElement, items: Array<[string, string]>, keep: string): void {
    sel.replaceChildren(...items.map(([v, t]) => option(v, t)));
    sel.value = items.some(([v]) => v === keep) ? keep : items[0]?.[0] ?? '';
  }

  refresh(force = false): void {
    const inv = this.opts.player.inventory;
    const pack = inv.slots.map((s) => (s ? `${s.item}:${s.count}:${s.durability ?? ''}` : '')).join(',');
    const held = this.opts.player.heldStack()?.item ?? '';
    const sig = `${pack}|${held}|${this.kind.value}|${this.head.value}|${this.handle.value}|${this.binding.value}`;
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const kind = (this.kind.value || last.kind) as ModularKind;
    this.kind.value = kind;
    const owns = (b: ToolBuild): boolean => missingForBuild(b, inv).length === 0;
    const mark = (ok: boolean): string => (ok ? ' ✓' : '');
    const base = { kind, head: last.head, handle: last.handle, binding: last.binding };
    this.fill(this.head, KIND_HEADS[kind].map((m) => [m, `${HEADS[m].name}${mark(owns({ ...base, head: m, handle: DEFAULT_HANDLE, binding: DEFAULT_BINDING }) || inv.count(`${m}_${kind}_head`) > 0)}`]), KIND_HEADS[kind].includes(last.head) ? last.head : KIND_HEADS[kind][0]);
    this.fill(this.handle, Object.values(HANDLES).map((m) => [m.key, `${m.name}${mark(m.key === DEFAULT_HANDLE ? inv.count('stick') >= 2 : inv.count(`${m.key}_handle`) > 0)}`]), last.handle);
    this.fill(this.binding, Object.values(BINDINGS).map((m) => [m.key, `${m.name}${mark(inv.count(m.item) > 0)}`]), last.binding);
    const b = this.current();
    const rows = previewRows(b, this.held());
    this.stats.replaceChildren(
      ...rows.map((r) =>
        h('tr', null,
          h('th', { text: r.label }),
          h('td', { text: String(r.value) }),
          h('td', { class: r.delta === null || r.delta === 0 ? 'hw-tb__same' : r.delta > 0 ? 'hw-tb__up' : 'hw-tb__down', text: r.delta === null ? '' : r.delta === 0 ? '=' : `${r.delta > 0 ? '+' : ''}${r.delta}` }),
        ),
      ),
    );
    this.traits.replaceChildren(...buildTraits(b).map((t) => h('li', { text: t })));
    const missing = missingForBuild(b, inv);
    const can = canBuildNow(b, inv);
    this.note.textContent = can ? 'You have the parts.' : missing.length > 0 ? `Missing ${missing.map((n) => `${n.count} ${nameOfItem(n.item)}`).join(', ')}` : 'No room for it: free a slot';
    this.buildBtn.disabled = !can;
    this.refreshRework();
  }

  private refreshRework(): void {
    const inv = this.opts.player.inventory;
    const tools = reworkable(inv);
    this.fill(this.tool, tools.map((t) => [String(t.slot), nameOfItem(t.item)]), this.tool.value);
    const entry = tools.find((t) => String(t.slot) === this.tool.value);
    if (!entry) {
      this.part.replaceChildren();
      this.reworkBtn.disabled = true;
      this.reworkNote.textContent = 'Carry a tool made of parts to rework it.';
      return;
    }
    const role = (this.role.value || 'head') as PartRole;
    const b = entry.build;
    const choices: Array<[string, string]> =
      role === 'head' ? KIND_HEADS[b.kind].map((m) => [m, HEADS[m].name]) : role === 'handle' ? Object.values(HANDLES).map((m) => [m.key, m.name]) : Object.values(BINDINGS).map((m) => [m.key, m.name]);
    this.fill(this.part, choices.filter(([m]) => m !== b[role]), this.part.value);
    const have = this.part.value !== '' && reworkCost(b, role, this.part.value).every((n) => inv.count(n.item) >= n.count);
    this.reworkBtn.disabled = !have;
    this.reworkNote.textContent = this.part.value === '' ? 'Nothing else fits.' : have ? 'The old part comes back to your pack.' : `Needs ${reworkCost(b, role, this.part.value).map((n) => `${n.count} ${nameOfItem(n.item)}`).join(', ')}`;
  }
}

