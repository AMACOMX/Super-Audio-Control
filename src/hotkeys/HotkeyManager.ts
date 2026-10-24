import { ConfiguredApp } from '../shared/types';
import { logger } from '../logger/Logger';

export interface ShortcutConflict {
  shortcut: string;
  appName: string;
  action: 'volumeUp' | 'volumeDown' | 'volumeMute' | 'microphoneMute';
}

const MAIN_KEY_ALIASES: Record<string, string> = {
  arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right',
  esc: 'Escape', escape: 'Escape', return: 'Return', enter: 'Enter',
  ' ': 'Space', space: 'Space', pageup: 'PageUp', pagedown: 'PageDown',
  capslock: 'Capslock', printscreen: 'PrintScreen', plus: 'Plus',
  volumeup: 'VolumeUp', volumedown: 'VolumeDown', volumemute: 'VolumeMute',
  backspace: 'Backspace', delete: 'Delete', insert: 'Insert',
  numlock: 'Numlock', scrolllock: 'Scrolllock'
};

export class HotkeyManager {
  /** Normalized human-facing accelerator -> action ID. */
  private registeredShortcuts: Map<string, string> = new Map();
  /** Action ID -> currently registered human-facing accelerator. */
  private actionShortcuts: Map<string, string> = new Map();

  /**
   * Canonicalize saved/UI chords. Do not put spaces around '+'; Electron's
   * globalShortcut expects accelerator syntax such as CommandOrControl+Up.
   */
  public normalizeShortcut(shortcut: string): string {
    if (!shortcut || !shortcut.trim()) return '';
    const parts = shortcut.split('+').map((part) => part.trim()).filter(Boolean);
    const modifiers = new Set<string>();
    const keys: string[] = [];

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (['ctrl', 'control', 'cmdorctrl', 'commandorcontrol'].includes(lower)) modifiers.add('Ctrl');
      else if (['alt', 'option'].includes(lower)) modifiers.add('Alt');
      else if (lower === 'shift') modifiers.add('Shift');
      else if (['win', 'windows', 'super', 'meta'].includes(lower)) modifiers.add('Win');
      else {
        const aliased = MAIN_KEY_ALIASES[lower];
        keys.push(aliased || (part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)));
      }
    }

    // A shortcut is exactly modifiers plus one main key. Invalid inputs aren't
    // retained as phantom registrations.
    if (keys.length !== 1) return '';
    const order = ['Ctrl', 'Alt', 'Shift', 'Win'];
    const normalizedModifiers = order.filter((modifier) => modifiers.has(modifier));
    return [...normalizedModifiers, keys[0]].join('+');
  }

  public detectConflict(
    newShortcut: string,
    currentAppId: string,
    currentAction: string,
    allApps: ConfiguredApp[]
  ): ShortcutConflict | null {
    const normalizedNew = this.normalizeShortcut(newShortcut);
    if (!normalizedNew) return null;

    for (const app of allApps) {
      if (!app.shortcuts) continue;
      const actions: (keyof typeof app.shortcuts)[] = ['volumeUp', 'volumeDown', 'volumeMute', 'microphoneMute'];
      for (const action of actions) {
        if (app.id === currentAppId && action === currentAction) continue;
        const existing = app.shortcuts[action];
        if (existing && this.normalizeShortcut(existing) === normalizedNew) {
          return { shortcut: normalizedNew, appName: app.displayName, action };
        }
      }
    }
    return null;
  }

  public async registerAppShortcuts(app: ConfiguredApp, onRegistrationFailed?: (message: string) => void): Promise<void> {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!api) return;

    const entries: [string, string | undefined][] = [
      [`${app.id}_vol_up`, app.shortcuts?.volumeUp],
      [`${app.id}_vol_down`, app.shortcuts?.volumeDown],
      [`${app.id}_vol_mute`, app.shortcuts?.volumeMute],
      [`${app.id}_mic_mute`, app.shortcuts?.microphoneMute]
    ];

    for (const [actionId, chord] of entries) {
      const previous = this.actionShortcuts.get(actionId);
      const normalized = chord ? this.normalizeShortcut(chord) : '';

      // Distinguish an intentionally empty shortcut from an invalid saved chord.
      if (chord && !normalized) {
        const message = `${app.displayName}: the saved shortcut for ${actionId} is invalid. Reassign it in the shortcut editor.`;
        logger.warn('hotkey', message);
        try { onRegistrationFailed?.(message); } catch { /* a UI notification must not break registration */ }
      }

      // If the user cleared or invalidated a shortcut, release the old global binding.
      if (!normalized) {
        if (previous) {
          try { await api.unregisterShortcut(previous); }
          catch (err) { logger.warn('hotkey', `Could not clear shortcut ${previous}`, { error: String(err) }); }
          if (this.registeredShortcuts.get(previous) === actionId) this.registeredShortcuts.delete(previous);
          this.actionShortcuts.delete(actionId);
        }
        continue;
      }

      if (previous === normalized && this.registeredShortcuts.get(normalized) === actionId) continue;

      const owner = this.registeredShortcuts.get(normalized);
      if (owner && owner !== actionId) {
        const message = `${app.displayName}: ${normalized} is already assigned to another configured action. Choose a different shortcut.`;
        logger.warn('hotkey', `${message} Existing owner: ${owner}.`);
        try { onRegistrationFailed?.(message); } catch { /* ignore UI callback errors */ }
        continue;
      }

      let ok = false;
      try {
        ok = await api.registerShortcut(normalized, actionId);
      } catch (err) {
        logger.warn('hotkey', `Could not register global shortcut ${normalized}`, { error: String(err) });
      }

      if (!ok) {
        const message = `${app.displayName}: Windows could not register ${normalized}. Another app may own this key combination; try a different shortcut.`;
        logger.warn('hotkey', `${message} Action: ${actionId}.`);
        try { onRegistrationFailed?.(message); } catch { /* ignore UI callback errors */ }
        continue;
      }

      // Register new chord first. Only after success do we release the old chord,
      // avoiding a lost shortcut if the requested replacement cannot be registered.
      if (previous && previous !== normalized) {
        try { await api.unregisterShortcut(previous); }
        catch (err) { logger.warn('hotkey', `Could not replace old shortcut ${previous}`, { error: String(err) }); }
        if (this.registeredShortcuts.get(previous) === actionId) this.registeredShortcuts.delete(previous);
      }

      this.actionShortcuts.set(actionId, normalized);
      this.registeredShortcuts.set(normalized, actionId);
      logger.info('hotkey', `Registered ${normalized} -> ${actionId}`);
    }
  }

  public async unregisterAppShortcuts(app: ConfiguredApp): Promise<void> {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!api) return;

    const actionIds = [
      `${app.id}_vol_up`, `${app.id}_vol_down`, `${app.id}_vol_mute`, `${app.id}_mic_mute`
    ];
    for (const actionId of actionIds) {
      const tracked = this.actionShortcuts.get(actionId);
      const field = actionId.endsWith('_vol_up') ? app.shortcuts?.volumeUp
        : actionId.endsWith('_vol_down') ? app.shortcuts?.volumeDown
        : actionId.endsWith('_vol_mute') ? app.shortcuts?.volumeMute
        : app.shortcuts?.microphoneMute;
      const normalized = tracked || (field ? this.normalizeShortcut(field) : '');
      if (!normalized) continue;
      try { await api.unregisterShortcut(normalized); }
      catch (err) { logger.warn('hotkey', `Failed to unregister shortcut ${normalized}`, { error: String(err) }); }
      if (this.registeredShortcuts.get(normalized) === actionId) this.registeredShortcuts.delete(normalized);
      this.actionShortcuts.delete(actionId);
    }
  }
}
