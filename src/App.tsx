import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ConfiguredApp,
  AppSettings,
  AudioDevice,
  ProcessInfo,
  AppCategory,
  ScanStatus
} from './shared/types';
import { SettingsManager, DEFAULT_SETTINGS } from './settings/SettingsManager';
import { DeviceManager } from './audio/DeviceManager';
import { AudioManager } from './audio/AudioManager';
import { ProcessManager } from './process/ProcessManager';
import { MicrophoneManager } from './microphone/MicrophoneManager';
import { HotkeyManager } from './hotkeys/HotkeyManager';
import { logger } from './logger/Logger';

import { TopToolbar } from './renderer/components/TopToolbar';
import { AppCard } from './renderer/components/AppCard';
import { AddRunningAppModal } from './renderer/components/AddRunningAppModal';
import { HotkeyModal } from './renderer/components/HotkeyModal';
import { AppDetailsModal } from './renderer/components/AppDetailsModal';
import { SettingsModal } from './renderer/components/SettingsModal';
import { StatusBanner } from './renderer/components/StatusBanner';
import { MicDriverPromptModal } from './renderer/components/MicDriverPromptModal';

const CATEGORIES: AppCategory[] = [
  'All Apps',
  'Media',
  'Voice & Chat',
  'Games',
  'Browsers',
  'System'
];

export default function App() {
  const [apps, setApps] = useState<ConfiguredApp[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [playbackDevices, setPlaybackDevices] = useState<AudioDevice[]>([]);
  const [recordingDevices, setRecordingDevices] = useState<AudioDevice[]>([]);
  const [micRouteAvailable, setMicRouteAvailable] = useState(false);
  const [micRouteName, setMicRouteName] = useState('');
  const [micDriverInstallPending, setMicDriverInstallPending] = useState(false);
  const [micDriverPromptAppName, setMicDriverPromptAppName] = useState<string | null>(null);
  const [runningProcesses, setRunningProcesses] = useState<ProcessInfo[]>([]);

  // Navigation & Search
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('All Apps');
  const [searchQuery, setSearchQuery] = useState('');

  // Status & Scanning
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectingApp, setInspectingApp] = useState<ConfiguredApp | null>(null);
  const [hotkeyModalApp, setHotkeyModalApp] = useState<ConfiguredApp | null>(null);
  const [hotkeyAction, setHotkeyAction] = useState<'volumeUp' | 'volumeDown' | 'volumeMute' | 'microphoneMute' | null>(null);

  // Service Singletons
  const deviceManager = useMemo(() => new DeviceManager(), []);
  const audioManager = useMemo(() => new AudioManager(), []);
  const processManager = useMemo(() => new ProcessManager(), []);
  const micManager = useMemo(() => new MicrophoneManager(), []);
  const hotkeyManager = useMemo(() => new HotkeyManager(), []);
  // Global shortcuts are registered once at startup. Keep the latest configured
  // applications available to those long-lived callbacks.
  const appsRef = useRef<ConfiguredApp[]>(apps);
  appsRef.current = apps;
  const micToggleRequestRef = useRef<(appId: string) => void>(() => {});
  const shortcutHandlerRef = useRef<(actionId: string) => void>(() => {});

  // Keep at most one auto-dismiss timer so stale notifications cannot clear newer ones.
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setStatusMessage = (type: ScanStatus['status'], message: string) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = null;

    const timestamp = Date.now();
    setScanStatus({ status: type, message, timestamp });

    if (type === 'ready' || type === 'idle') {
      statusTimerRef.current = setTimeout(() => {
        setScanStatus((previous) => previous?.timestamp === timestamp ? null : previous);
        statusTimerRef.current = null;
      }, 4000);
    }
  };

  useEffect(() => () => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
  }, []);

  // 1. Startup Scanning Sequence (Section 3)
  useEffect(() => {
    let mounted = true;

    async function runStartupSequence() {
      setIsScanning(true);
      logger.info('system', 'Initializing Super Audio Control system scan sequence...');
      try {
        if (window.electronAPI?.getAudioEngineStatus) {
          const engine = await window.electronAPI.getAudioEngineStatus();
          logger.info('system', `Native audio engine: ${engine.available ? 'ONLINE' : 'OFFLINE'}${engine.path ? ` • ${engine.path}` : ''}`);
          if (!engine.available) setStatusMessage('error', 'Native Windows audio engine is unavailable. Rebuild/reinstall the application.');
        }
      } catch (err) {
        logger.error('system', 'Could not query native audio engine status', { error: String(err) });
      }

      // Step 1: Detect Audio Devices
      setStatusMessage('scanning_devices', 'Scanning audio devices...');
      const devs = await deviceManager.scanDevices();
      if (!mounted) return;
      setPlaybackDevices(devs.playback);
      setRecordingDevices(devs.recording);

      try {
        const micStatus = await micManager.getStatus();
        setMicRouteAvailable(!!micStatus.virtualDriverInstalled);
        setMicRouteName(micStatus.silentEndpointName || '');
      } catch (err) {
        logger.warn('microphone', 'Could not determine silent microphone route status', { error: String(err) });
      }

      const defaultPlayback = devs.playback.find((d) => d.isDefault) || devs.playback[0];
      const defaultRecording = devs.recording.find((d) => d.isDefault) || devs.recording[0];

      // Step 2: Scan Running Applications
      setStatusMessage('scanning_apps', 'Scanning running applications...');
      const procs = await processManager.scanProcesses();
      if (!mounted) return;
      setRunningProcesses(procs);

      // Step 3: Load Configuration & Settings & Live Audio Sessions
      setStatusMessage('scanning_sessions', 'Detecting live audio sessions...');
      const [savedApps, loadedSettings, liveSessions] = await Promise.all([
        SettingsManager.loadApps(),
        SettingsManager.loadSettings(),
        audioManager.getSessions()
      ]);
      if (!mounted) return;

      setSettings(loadedSettings);

      // Step 4: Purge dummy applications and match real running processes
      const cleanSavedApps = savedApps.filter(
        (a) =>
          a.id !== 'app_discord_voice_video' &&
          a.id !== 'app_google_chrome' &&
          a.id !== 'app_spotify_music' &&
          a.id !== 'app_counter_strike_2' &&
          a.id !== 'app_obs_studio' &&
          a.id !== 'app_vlc_media_player' &&
          !a.executablePath?.includes('app-1.0.9015\\Discord.exe') &&
          !a.outputDeviceId?.includes('realtek_speakers_guid')
      );

      const reconciled = processManager.matchSavedApps(cleanSavedApps, procs).map((app) => {
        const liveSession = liveSessions.find(
          (s) =>
            (app.pid && s.pid === app.pid) ||
            (s.processName && s.processName.toLowerCase() === app.executable.toLowerCase())
        );

        let outDev = app.outputDeviceId;
        if (!outDev || outDev.includes('realtek_speakers_guid') || !devs.playback.some((d) => d.id === outDev)) {
          outDev = defaultPlayback?.id || outDev;
        }
        if (!app.outputDeviceId && liveSession?.deviceId && devs.playback.some((d) => d.id === liveSession.deviceId)) {
          outDev = liveSession.deviceId;
        }

        let inDev = app.inputDeviceId;
        if (!inDev || inDev.includes('realtek_mic_guid') || !devs.recording.some((d) => d.id === inDev)) {
          inDev = defaultRecording?.id || inDev;
        }

        return {
          ...app,
          volume: liveSession ? liveSession.volume : app.volume,
          isMuted: liveSession ? liveSession.isMuted : app.isMuted,
          outputDeviceId: outDev,
          inputDeviceId: inDev
        };
      });

      // Only restore applications the user previously configured.
      // Do NOT auto-add every live Windows audio session on startup.
      const configuredApps = reconciled;

      setApps(configuredApps);
      setIsConfigLoaded(true);

      // Register shortcuts and keep registration failures visible. A chord rendered
      // on a card is not proof that Windows accepted the global registration.
      const shortcutRegistrationFailures: string[] = [];
      await Promise.all(reconciled.map((app) => hotkeyManager.registerAppShortcuts(app, (message) => {
        shortcutRegistrationFailures.push(message);
      })));

      setIsScanning(false);
      if (shortcutRegistrationFailures.length > 0) {
        setStatusMessage('error', shortcutRegistrationFailures[0]);
      } else {
        setStatusMessage('ready', `Ready • ${devs.playback.length} playback devices, ${procs.length} processes detected`);
      }
      logger.info('system', 'Startup sequence complete. Dashboard active.');
    }

    runStartupSequence();

    return () => {
      mounted = false;
    };
  }, []);

  // Save apps whenever state changes
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isConfigLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      SettingsManager.saveApps(apps);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [apps, isConfigLoaded]);

  // Handle the main-process globalShortcut IPC event. All operations are confirmed
  // against the native audio session before the UI updates its displayed state.
  const handleShortcutTriggered = async (actionId: string) => {
    logger.info('hotkey', `Global shortcut fired: ${actionId}`);
    const suffixes = ['_mic_mute', '_vol_up', '_vol_down', '_vol_mute'] as const;
    const suffix = suffixes.find((candidate) => actionId.endsWith(candidate));
    if (!suffix) {
      logger.warn('hotkey', `Ignoring unrecognized shortcut action: ${actionId}`);
      return;
    }
    const appId = actionId.slice(0, -suffix.length);
    const target = appsRef.current.find((candidate) => candidate.id === appId);
    if (!target) {
      logger.warn('hotkey', `Shortcut target is not on the dashboard: ${appId}`);
      setStatusMessage('error', `Shortcut fired, but its configured application is no longer on the dashboard (${appId}).`);
      return;
    }

    const actionLabel = suffix === '_mic_mute' ? 'microphone mute'
      : suffix === '_vol_up' ? 'volume up'
      : suffix === '_vol_down' ? 'volume down'
      : 'volume mute';
    setStatusMessage('ready', `${target.displayName}: ${actionLabel} shortcut triggered.`);

    if (suffix === '_mic_mute') {
      micToggleRequestRef.current(appId);
      return;
    }
    if (!target.pid) {
      setStatusMessage('error', `Shortcut failed: ${target.displayName} has no active process ID.`);
      return;
    }

    if (suffix === '_vol_up' || suffix === '_vol_down') {
      const step = target.volumeStep || 5;
      const newVol = suffix === '_vol_up'
        ? Math.min(100, target.volume + step)
        : Math.max(0, target.volume - step);
      const ok = await audioManager.setVolume(target.pid, newVol, target.executable);
      if (!ok) {
        logger.warn('hotkey', `Volume shortcut could not control ${target.displayName}; no matching active audio session was found.`);
        setStatusMessage('error', `${target.displayName}: shortcut could not change volume because Windows did not expose a controllable audio session.`);
        return;
      }
      setApps((current) => current.map((candidate) => candidate.id === appId
        ? { ...candidate, volume: newVol, isMuted: false }
        : candidate));
      return;
    }

    const nextMuted = !target.isMuted;
    const muteOk = await audioManager.setMute(target.pid, nextMuted, target.executable);
    if (!muteOk) {
      logger.warn('hotkey', `Mute shortcut could not control ${target.displayName}; no matching active audio session was found.`);
      setStatusMessage('error', `${target.displayName}: shortcut could not change mute because Windows did not expose a controllable audio session.`);
      return;
    }
    setApps((current) => current.map((candidate) => candidate.id === appId
      ? { ...candidate, isMuted: nextMuted }
      : candidate));
  };

  shortcutHandlerRef.current = (actionId: string) => { void handleShortcutTriggered(actionId); };
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onShortcutTriggered((actionId) => {
      shortcutHandlerRef.current(actionId);
    });
    return () => { unsubscribe?.(); };
  }, []);

  // Section 5: [ ↻ Audio Devices ] Rescan
  const handleRescanAudioDevices = async () => {
    setIsScanning(true);
    setStatusMessage('scanning_devices', 'Refreshing playback and microphone devices...');
    const result = await deviceManager.scanDevices();
    setPlaybackDevices(result.playback);
    setRecordingDevices(result.recording);
    try {
      const micStatus = await micManager.getStatus();
      setMicRouteAvailable(!!micStatus.virtualDriverInstalled);
      setMicRouteName(micStatus.silentEndpointName || '');
      if (micStatus.virtualDriverInstalled) setMicDriverInstallPending(false);
    } catch (err) {
      logger.warn('microphone', 'Could not refresh silent microphone route status', { error: String(err) });
    }
    setIsScanning(false);
    setStatusMessage('ready', `Audio devices refreshed • ${result.playback.length} playback, ${result.recording.length} capture`);
  };

  // Section 6: [ ↻ Scan Apps ] Rescan
  const handleRescanApps = async () => {
    setIsScanning(true);
    setStatusMessage('scanning_apps', 'Scanning currently running applications and live audio sessions...');
    const [procs, liveSessions] = await Promise.all([
      processManager.scanProcesses(),
      audioManager.getSessions()
    ]);
    setRunningProcesses(procs);

    const defaultPlayback = playbackDevices.find((d) => d.isDefault) || playbackDevices[0];
    const defaultRecording = recordingDevices.find((d) => d.isDefault) || recordingDevices[0];

    // Reconcile PID changes and live audio levels, filtering out any legacy dummy apps
    setApps((prev) => {
      const cleanPrev = prev.filter(
        (a) =>
          a.id !== 'app_discord_voice_video' &&
          a.id !== 'app_google_chrome' &&
          a.id !== 'app_spotify_music' &&
          a.id !== 'app_counter_strike_2' &&
          a.id !== 'app_obs_studio' &&
          a.id !== 'app_vlc_media_player' &&
          !a.executablePath?.includes('app-1.0.9015\\Discord.exe') &&
          !a.outputDeviceId?.includes('realtek_speakers_guid')
      );

      const reconciled = processManager.matchSavedApps(cleanPrev, procs).map((app) => {
        const liveSession = liveSessions.find(
          (s) =>
            (app.pid && s.pid === app.pid) ||
            (s.processName && s.processName.toLowerCase() === app.executable.toLowerCase())
        );

        let outDev = app.outputDeviceId;
        if (!outDev || outDev.includes('realtek_speakers_guid') || !playbackDevices.some((d) => d.id === outDev)) {
          outDev = defaultPlayback?.id || outDev;
        }
        // Keep a user-selected per-app route. The live session device can lag behind
        // the persisted AudioPolicyConfig preference until the app creates/reopens a
        // stream, so blindly replacing the selection here makes the dropdown appear
        // unable to retain changes.
        if (!app.outputDeviceId && liveSession?.deviceId && playbackDevices.some((d) => d.id === liveSession.deviceId)) {
          outDev = liveSession.deviceId;
        }

        let inDev = app.inputDeviceId;
        if (!inDev || inDev.includes('realtek_mic_guid') || !recordingDevices.some((d) => d.id === inDev)) {
          inDev = defaultRecording?.id || inDev;
        }

        return {
          ...app,
          volume: liveSession ? liveSession.volume : app.volume,
          isMuted: liveSession ? liveSession.isMuted : app.isMuted,
          outputDeviceId: outDev,
          inputDeviceId: inDev
        };
      });

      // Scanning refreshes the available process/session data and reconnects
      // applications that are already on the dashboard. It never auto-adds new apps.
      return reconciled;
    });
    setIsScanning(false);
    setStatusMessage('ready', `Applications refreshed • ${procs.length} running processes`);
  };

  // Refresh one card without changing saved device preferences unless Windows
  // reports a live playback session for this exact application.
  const handleRefreshApp = async (target: ConfiguredApp) => {
    const [processes, sessions, devices] = await Promise.all([
      processManager.scanProcesses(),
      audioManager.getSessions(),
      deviceManager.scanDevices()
    ]);
    setRunningProcesses(processes);
    setPlaybackDevices(devices.playback);
    setRecordingDevices(devices.recording);

    const matchingProcess = processes.find((p) =>
      p.executablePath?.toLowerCase() === target.executablePath?.toLowerCase()
    ) || processes.find((p) => p.name.toLowerCase() === target.executable.toLowerCase());
    const pid = matchingProcess?.pid ?? target.pid;
    const session = sessions.find((item) =>
      (pid != null && item.pid === pid) ||
      item.processName?.toLowerCase() === target.executable.toLowerCase() ||
      item.executablePath?.toLowerCase() === target.executablePath?.toLowerCase()
    );

    setApps((prev) => prev.map((app) => {
      if (app.id !== target.id) return app;
      const outputIsValid = devices.playback.some((device) => device.id === app.outputDeviceId);
      const inputIsValid = devices.recording.some((device) => device.id === app.inputDeviceId);
      return {
        ...app,
        pid: matchingProcess?.pid ?? (matchingProcess ? app.pid : null),
        isRunning: !!matchingProcess,
        hasAudioSession: !!session,
        ...(session ? { volume: session.volume, isMuted: session.isMuted } : {}),
        // Session deviceId is the best available live playback evidence. Never
        // infer a microphone device from a playback session.
        outputDeviceId: (session && devices.playback.some((device) => device.id === session.deviceId))
          ? session.deviceId : (outputIsValid ? app.outputDeviceId : (devices.playback.find((device) => device.isDefault)?.id || app.outputDeviceId)),
        inputDeviceId: inputIsValid ? app.inputDeviceId : (devices.recording.find((device) => device.isDefault)?.id || app.inputDeviceId)
      };
    }));

    if (session) {
      setStatusMessage('ready', `${target.displayName}: refreshed live audio session${session.state === 'active' ? ' (active)' : ' (inactive)'}. Playback endpoint refreshed where reported; microphone endpoint is not exposed by this session query.`);
    } else if (!matchingProcess) {
      setStatusMessage('ready', `${target.displayName}: process is not currently running. Device list refreshed; saved preferences were retained.`);
    } else {
      setStatusMessage('ready', `${target.displayName}: running, but no live playback session was found. Saved device preferences were retained. Start audio or join a call, then refresh again.`);
    }
  };

  // Section 7: [ + Add Running App ]
  const handleAddProcess = (proc: ProcessInfo) => {
    const defaultOutput = settings.audio.defaultOutputDeviceId || playbackDevices[0]?.id || '';
    const defaultInput = settings.audio.defaultInputDeviceId || recordingDevices[0]?.id || '';
    const newApp = processManager.createConfiguredAppFromProcess(proc, defaultOutput, defaultInput);

    setApps((prev) => [...prev, newApp]);
    logger.info('process', `Added ${newApp.displayName} (PID ${newApp.pid}) to Super Audio Control.`);
  };

  // Section 17 & 18: Output Volume & Mute
  const handleVolumeChange = async (appId: string, volume: number) => {
    const target = apps.find((a) => a.id === appId);
    if (!target?.pid) return;

    const ok = await audioManager.setVolume(target.pid, volume, target.executable);
    if (!ok) {
      logger.error('session', `Windows rejected volume change for ${target.displayName} (PID ${target.pid})`);
      return;
    }

    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, volume, isMuted: false } : a))
    );
  };

  const handleVolumeStepChange = (appId: string, step: number) => {
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, volumeStep: step } : a))
    );
  };

  const handleToggleMute = async (appId: string) => {
    const target = apps.find((a) => a.id === appId);
    if (!target?.pid) return;

    const nextMuted = !target.isMuted;
    const ok = await audioManager.setMute(target.pid, nextMuted, target.executable);
    if (!ok) {
      logger.error('session', `Windows rejected mute change for ${target.displayName} (PID ${target.pid})`);
      return;
    }

    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, isMuted: nextMuted } : a))
    );
  };

  // Section 16: Audio Device Routing
  const handleOutputDeviceChange = async (appId: string, deviceId: string) => {
    const target = apps.find((a) => a.id === appId);
    if (!target?.pid) return;

    const ok = await audioManager.routeOutputDevice(target.pid, target.executablePath, deviceId);
    if (!ok) {
      let detail = '';
      try { detail = await window.electronAPI?.getLastEndpointRoutingError() || ''; } catch {}
      logger.error('session', `Windows rejected output routing for ${target.displayName} (PID ${target.pid})`, { detail });
      setStatusMessage('error', `${target.displayName}: Windows rejected output-device routing. ${detail || 'See the diagnostic log for details.'}`);
      return;
    }

    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, outputDeviceId: deviceId } : a));
  };

  const handleInputDeviceChange = async (appId: string, deviceId: string) => {
    const target = apps.find((a) => a.id === appId);
    if (!target?.pid) return;

    if (!target.micEnabled) {
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, inputDeviceId: deviceId } : a));
      // Keep the app muted by re-applying its silent route. The selected device becomes
      // the device restored when the user unmutes.
      const keptMuted = await micManager.setAppMicrophone(target.pid, target.executablePath, false, deviceId);
      if (!keptMuted) {
        logger.warn('microphone', `Saved ${target.displayName} input device, but could not re-apply silent route.`);
      }
      return;
    }

    const ok = await audioManager.routeInputDevice(target.pid, target.executablePath, deviceId);
    if (!ok) {
      let detail = '';
      try { detail = await window.electronAPI?.getLastEndpointRoutingError() || ''; } catch {}
      logger.error('microphone', `Windows rejected input routing for ${target.displayName} (PID ${target.pid})`, { detail });
      setStatusMessage('error', `${target.displayName}: Windows rejected input-device routing. ${detail || 'Choose the microphone in that app’s own audio settings.'}`);
      return;
    }

    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, inputDeviceId: deviceId } : a));
  };

  // Section 19, 20 & 21: Per-App Microphone Control
  const handleToggleMic = async (appId: string) => {
    const target = appsRef.current.find((a) => a.id === appId);
    if (!target) return;
    if (!target.pid || !target.isRunning) {
      setStatusMessage('ready', `${target.displayName}: start the application before changing microphone routing.`);
      return;
    }

    const nextState = !target.micEnabled;
    const ok = await micManager.setAppMicrophone(target.pid, target.executablePath, nextState, target.inputDeviceId);
    if (!ok) {
      const [micStatus, nativeError] = await Promise.all([micManager.getStatus(), micManager.getLastError()]);
      const missingSilentEndpoint = !nextState && !micStatus.virtualDriverInstalled;
      const detail = !micStatus.engineReady
        ? 'The native audio bridge is unavailable; rebuild the application.'
        : missingSilentEndpoint
          ? 'Windows did not expose a muteable capture session and no silent VB-CABLE endpoint was detected. Restart Windows if you just installed VB-CABLE, then click Audio Devices and confirm CABLE Output appears under Recording devices.'
          : (nativeError || 'Windows rejected the per-app microphone route.');
      if (missingSilentEndpoint) setMicDriverPromptAppName(target.displayName);
      logger.error('microphone', `Microphone routing failed for ${target.displayName}: ${detail}. The physical microphone was not globally muted.`);
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, micStatusMessage: `Mic change failed: ${detail}` } : a));
      setStatusMessage('ready', `${target.displayName}: ${detail}`);
      return;
    }

    setApps((prev) =>
      prev.map((a) => {
        if (a.id === appId) {
          return {
            ...a,
            micEnabled: nextState,
            micState: nextState ? 'active' : 'muted',
            micStatusMessage: nextState
              ? 'Per-app microphone mute cleared. If this app had ended its capture session, its next session starts normally.'
              : "Per-app microphone mute applied to this app's capture session when available; otherwise the silent-endpoint route was used. Reapply after the app restarts its capture stream."
          };
        }
        return a;
      })
    );
  };

  // Bind the long-lived global-hotkey callback to the newest React closure.
  micToggleRequestRef.current = (appId: string) => { void handleToggleMic(appId); };

  const handleInstallMicDriver = async (skipConfirmation = false) => {
    if (!window.electronAPI?.installSilentMicDriver) {
      setStatusMessage('error', 'Driver installer is unavailable. Rebuild the portable application.');
      return;
    }
    if (!skipConfirmation) {
      const accepted = window.confirm(
        'Super Audio Control will extract the official VB-Audio VB-CABLE driver and launch its installer. Windows will ask for administrator approval. The installer may require a restart. VB-CABLE is donationware; details: https://vb-audio.com/Services/licensing.htm. Continue?'
      );
      if (!accepted) return;
    }

    setIsScanning(true);
    setStatusMessage('scanning_devices', 'Launching the VB-Audio driver installer...');
    try {
      const result = await window.electronAPI.installSilentMicDriver();
      if (result.success) {
        setMicDriverInstallPending(true);
        setStatusMessage('ready', result.message);
        logger.info('microphone', 'VB-CABLE installer finished. A Windows restart may be required before the endpoint is available.');
      } else {
        setStatusMessage('error', result.message);
        logger.error('microphone', `VB-CABLE installation did not complete: ${result.message}`);
      }
    } catch (err) {
      const message = `Could not launch VB-CABLE setup: ${String(err)}`;
      setStatusMessage('error', message);
      logger.error('microphone', message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleVisitMicDriverDownloadPage = async () => {
    setMicDriverPromptAppName(null);
    try {
      const opened = await window.electronAPI?.openMicDriverDownloadPage();
      if (opened) {
        setStatusMessage('ready', 'Opened the official VB-Audio VB-CABLE download page in your browser.');
      } else {
        setStatusMessage('error', 'Could not open the browser. Visit https://vb-audio.com/Cable/');
      }
    } catch (err) {
      setStatusMessage('error', `Could not open the VB-CABLE download page: ${String(err)}`);
    }
  };

  // Remove App from Dashboard
  const handleRemoveApp = (appId: string) => {
    const target = apps.find((a) => a.id === appId);
    if (target) {
      hotkeyManager.unregisterAppShortcuts(target);
      setApps((prev) => prev.filter((a) => a.id !== appId));
      logger.info('process', `Removed ${target.displayName} from dashboard.`);
    }
  };

  // Remove all configured applications from the dashboard and release their global shortcuts.
  const handleRemoveAllApps = async () => {
    if (apps.length === 0) return;

    const removedCount = apps.length;
    for (const app of apps) {
      await hotkeyManager.unregisterAppShortcuts(app);
    }

    setApps([]);
    setInspectingApp(null);
    setHotkeyModalApp(null);
    setHotkeyAction(null);
    await SettingsManager.saveApps([]);
    logger.info('process', `Removed all ${removedCount} applications from dashboard.`);
    setStatusMessage('ready', `Removed all ${removedCount} applications from dashboard.`);
  };

  // Open Hotkey Config Modal
  const handleOpenHotkeyModal = (
    app: ConfiguredApp,
    action: 'volumeUp' | 'volumeDown' | 'volumeMute' | 'microphoneMute'
  ) => {
    setHotkeyModalApp(app);
    setHotkeyAction(action);
  };

  const handleSaveShortcut = (
    appId: string,
    action: 'volumeUp' | 'volumeDown' | 'volumeMute' | 'microphoneMute',
    chord?: string
  ) => {
    const current = appsRef.current.find((candidate) => candidate.id === appId);
    if (!current) return;

    const updatedApp = {
      ...current,
      shortcuts: { ...current.shortcuts, [action]: chord }
    };
    // Update the ref immediately so a key pressed during the state render gap
    // resolves against the newest configured action.
    appsRef.current = appsRef.current.map((candidate) => candidate.id === appId ? updatedApp : candidate);
    setApps((prev) => prev.map((candidate) => candidate.id === appId ? updatedApp : candidate));
    void hotkeyManager.registerAppShortcuts(updatedApp, (message) => {
      setStatusMessage('error', message);
    });
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<AppCategory, number> = {
      'All Apps': apps.length,
      Media: 0,
      'Voice & Chat': 0,
      Games: 0,
      Browsers: 0,
      System: 0
    };

    apps.forEach((a) => {
      if (counts[a.category] !== undefined) {
        counts[a.category]++;
      }
    });
    return counts;
  }, [apps]);

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return apps.filter((a) => {
      const matchesCategory =
        selectedCategory === 'All Apps' || a.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.displayName.toLowerCase().includes(q) ||
        a.executable.toLowerCase().includes(q) ||
        (a.pid && String(a.pid).includes(q)) ||
        a.category.toLowerCase().includes(q);

      const matchesInactiveVisibility =
        settings.interface.showInactiveApps || a.isRunning;

      return matchesCategory && matchesSearch && matchesInactiveVisibility;
    });
  }, [apps, selectedCategory, searchQuery, settings.interface.showInactiveApps]);

  return (
    <div className="min-h-screen bg-[#0d0f11] text-[#e2e8f0] flex flex-col font-sans select-none antialiased">
      {/* Top Application Window Bar */}
      <div className="bg-[#090b0d] border-b border-[#181c22] px-6 py-2 flex items-center justify-between text-xs text-[#8c96a5]">
        <div className="flex items-center gap-2">
          <img
            src="./icon.png"
            alt="Super Audio Control logo"
            draggable={false}
            className="w-6 h-6 object-contain drop-shadow-[0_0_6px_rgba(0,153,255,0.35)]"
          />
          <span className="font-bold tracking-wider text-white uppercase text-[11px]">
            Super Audio Control
          </span>
          <span className="text-[#4b5563] text-[10px]">•</span>
          <span className="text-[11px] text-[#00b4d8]">WASAPI & Core Audio Router</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#6b7280]">
            <span>Virtual Mic Endpoint:</span>
            <span className={micRouteAvailable ? 'text-[#10b981] font-semibold' : 'text-[#f59e0b] font-semibold'}>{micRouteAvailable ? `${micRouteName || 'Detected'}` : 'Not Detected'}</span>
          </div>
          {typeof window !== 'undefined' && window.electronAPI && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => window.electronAPI?.minimizeWindow()}
                className="w-6 h-6 rounded hover:bg-[#1f2633] flex items-center justify-center text-white"
              >
                ─
              </button>
              <button
                onClick={() => window.electronAPI?.maximizeWindow()}
                className="w-6 h-6 rounded hover:bg-[#1f2633] flex items-center justify-center text-white"
              >
                □
              </button>
              <button
                onClick={() => window.electronAPI?.closeWindow()}
                className="w-6 h-6 rounded hover:bg-red-600 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TOP TOOLBAR: Category Tabs, Search, Scan Apps, Audio Devices, Add Running App */}
      <TopToolbar
        categories={CATEGORIES}
        activeCategory={selectedCategory}
        categoryCounts={categoryCounts}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onScanApps={handleRescanApps}
        onScanDevices={handleRescanAudioDevices}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onRemoveAllApps={handleRemoveAllApps}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenKoFi={async () => {
          const opened = await window.electronAPI?.openKoFiPage();
          if (opened === false) setStatusMessage('error', 'Could not open Ko-fi. Please visit https://ko-fi.com/amacomx in your browser.');
        }}
        isScanning={isScanning}
      />

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
        {filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#161a22] border border-[#232b38] flex items-center justify-center mb-4 text-[#4b5563]">
              <span className="text-2xl">🎧</span>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No Applications Configured</h3>
            <p className="text-xs text-[#8c96a5] max-w-sm mb-5 leading-relaxed">
              {searchQuery
                ? `No applications matched "${searchQuery}". Clear your search or add a running app.`
                : 'No applications are configured yet. Click "+ Add Running App" to choose the Windows processes you want to control. Scanning only refreshes the available list.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#0099ff] hover:bg-[#0088ee] text-white text-xs font-semibold rounded-xl shadow-lg shadow-[#0099ff]/20 transition-all cursor-pointer"
            >
              + Add Running App
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                playbackDevices={playbackDevices}
                recordingDevices={recordingDevices}
                onVolumeChange={handleVolumeChange}
                onVolumeStepChange={handleVolumeStepChange}
                onToggleMute={handleToggleMute}
                onOutputDeviceChange={handleOutputDeviceChange}
                onInputDeviceChange={handleInputDeviceChange}
                onToggleMic={handleToggleMic}
                onRemoveApp={handleRemoveApp}
                onShowDetails={setInspectingApp}
                onRefreshApp={handleRefreshApp}
                onOpenHotkeyModal={handleOpenHotkeyModal}
              />
            ))}
          </div>
        )}
      </main>

      {/* MODALS */}
      <AddRunningAppModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        processes={runningProcesses}
        alreadyAddedExeNames={apps.map((a) => a.executable.toLowerCase())}
        onAddProcess={handleAddProcess}
        onRescanProcesses={handleRescanApps}
      />

      <HotkeyModal
        isOpen={hotkeyModalApp !== null && hotkeyAction !== null}
        onClose={() => {
          setHotkeyModalApp(null);
          setHotkeyAction(null);
        }}
        app={hotkeyModalApp}
        action={hotkeyAction}
        allApps={apps}
        onSaveShortcut={handleSaveShortcut}
      />

      <AppDetailsModal
        isOpen={inspectingApp !== null}
        onClose={() => setInspectingApp(null)}
        app={inspectingApp}
        playbackDevices={playbackDevices}
        recordingDevices={recordingDevices}
      />

      <MicDriverPromptModal
        isOpen={micDriverPromptAppName !== null}
        appName={micDriverPromptAppName || ''}
        isBusy={isScanning}
        onInstallAutomatically={() => {
          setMicDriverPromptAppName(null);
          void handleInstallMicDriver(true);
        }}
        onVisitDownloadPage={() => { void handleVisitMicDriverDownloadPage(); }}
        onCancel={() => setMicDriverPromptAppName(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          SettingsManager.saveSettings(newSettings);
          logger.info('system', 'Updated application settings.');
        }}
        playbackDevices={playbackDevices}
        recordingDevices={recordingDevices}
        allApps={apps}
        micRouteAvailable={micRouteAvailable}
        micRouteName={micRouteName}
        micDriverInstallPending={micDriverInstallPending}
        onInstallMicDriver={() => { void handleInstallMicDriver(); }}
        onVisitMicDriverDownloadPage={() => { void handleVisitMicDriverDownloadPage(); }}
        onImportConfig={(imported) => {
          setApps(imported);
          SettingsManager.saveApps(imported);
        }}
        onResetConfig={() => {
          setApps([]);
          SettingsManager.saveApps([]);
          logger.info('system', 'Cleared all applications from dashboard.');
        }}
      />

      {/* STATUS BANNER */}
      <StatusBanner status={scanStatus} />
    </div>
  );
}
