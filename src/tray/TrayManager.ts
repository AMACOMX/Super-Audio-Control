import { Tray, Menu, nativeImage, NativeImage, app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';

export class TrayManager {
  private tray: Tray | null = null;
  private shortcutsPaused: boolean = false;

  constructor(
    private mainWindow: BrowserWindow,
    private onRescanApps: () => void,
    private onRescanDevices: () => void,
    private onOpenSettings: () => void,
    private onToggleShortcuts: (paused: boolean) => void
  ) {}

  public init(): void {
    const icon = this.resolveTrayIcon();

    try {
      this.tray = new Tray(icon);
      this.tray.setToolTip('Super Audio Control • WASAPI Audio Router');
      this.updateContextMenu();

      // Single-click toggles the dashboard (standard Windows behavior like Volume Mixer / EarTrumpet)
      this.tray.on('click', () => {
        this.toggleMainWindow();
      });

      this.tray.on('double-click', () => {
        this.showMainWindow();
      });
    } catch (err) {
      console.warn('[TrayManager] Failed to create system tray icon:', err);
    }
  }

  private resolveTrayIcon(): NativeImage {
    const candidates = [
      path.join(__dirname, '../../assets/icons/tray.png'),
      path.join(__dirname, '../assets/icons/tray.png'),
      path.join(__dirname, 'assets/icons/tray.png'),
      path.join(process.cwd(), 'assets/icons/tray.png'),
      process.resourcesPath ? path.join(process.resourcesPath, 'assets/icons/tray.png') : '',
      process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked/assets/icons/tray.png') : ''
    ].filter(Boolean);

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const img = nativeImage.createFromPath(p);
          if (!img.isEmpty()) {
            return img.resize({ width: 16, height: 16 });
          }
        } catch {}
      }
    }

    // High quality bitmap fallback
    return this.createFallbackIcon();
  }

  public updateContextMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Super Audio Control',
        click: () => this.showMainWindow()
      },
      {
        label: 'Hide to System Tray',
        click: () => {
          if (this.mainWindow) this.mainWindow.hide();
        }
      },
      { type: 'separator' },
      {
        label: this.shortcutsPaused ? 'Resume Global Shortcuts' : 'Pause Global Shortcuts',
        click: () => {
          this.shortcutsPaused = !this.shortcutsPaused;
          this.onToggleShortcuts(this.shortcutsPaused);
          this.updateContextMenu();
        }
      },
      {
        label: '↻ Scan Active Applications',
        click: () => {
          this.showMainWindow();
          this.onRescanApps();
        }
      },
      {
        label: '↻ Scan Audio Devices',
        click: () => {
          this.showMainWindow();
          this.onRescanDevices();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.showMainWindow();
          this.onOpenSettings();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Super Audio Control',
        click: () => {
          (app as any).isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public toggleMainWindow(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isVisible() && !this.mainWindow.isMinimized() && this.mainWindow.isFocused()) {
      this.mainWindow.hide();
    } else {
      this.showMainWindow();
    }
  }

  public showMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore();
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /**
   * Programmatic 16x16 electric cyan audio speaker icon bitmap fallback.
   */
  private createFallbackIcon(): NativeImage {
    const size = 16;
    const buf = Buffer.alloc(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        let r = 0, g = 0, b = 0, a = 0;

        // Speaker box (x=2..5, y=5..10)
        if (x >= 2 && x <= 5 && y >= 5 && y <= 10) {
          r = 0; g = 229; b = 255; a = 255;
        }
        // Speaker cone (x=6..9, expanding from y=5..10 to y=2..13)
        else if (x >= 6 && x <= 9) {
          const prog = (x - 6) / 3.0;
          const minY = 5 - Math.round(prog * 3);
          const maxY = 10 + Math.round(prog * 3);
          if (y >= minY && y <= maxY) {
            r = 0; g = 210; b = 255; a = 255;
          }
        }
        // Sound waves (x=11..14)
        else if (x >= 11 && x <= 14) {
          const dy = y - 7.5;
          const dx = x - 7;
          const dist2 = dx * dx + dy * dy;
          if (dist2 >= 18 && dist2 <= 28) {
            r = 56; g = 189; b = 248; a = 240;
          } else if (dist2 >= 38 && dist2 <= 50) {
            r = 129; g = 140; b = 248; a = 200;
          }
        }

        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = a;
      }
    }

    return nativeImage.createFromBitmap(buf, { width: size, height: size });
  }
}
