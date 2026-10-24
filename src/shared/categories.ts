import { AppCategory } from './types';

interface KnownAppDefinition {
  executable: string;
  displayName: string;
  category: AppCategory;
  iconHint?: string;
}

export const KNOWN_APPLICATIONS: KnownAppDefinition[] = [
  // Voice & Chat
  { executable: 'discord.exe', displayName: 'Discord Voice & Video', category: 'Voice & Chat' },
  { executable: 'teams.exe', displayName: 'Microsoft Teams', category: 'Voice & Chat' },
  { executable: 'zoom.exe', displayName: 'Zoom Meetings', category: 'Voice & Chat' },
  { executable: 'skype.exe', displayName: 'Skype', category: 'Voice & Chat' },
  { executable: 'slack.exe', displayName: 'Slack', category: 'Voice & Chat' },
  { executable: 'telegram.exe', displayName: 'Telegram Desktop', category: 'Voice & Chat' },
  { executable: 'whatsapp.exe', displayName: 'WhatsApp Desktop', category: 'Voice & Chat' },
  { executable: 'signal.exe', displayName: 'Signal Desktop', category: 'Voice & Chat' },
  { executable: 'element.exe', displayName: 'Element Messenger', category: 'Voice & Chat' },
  { executable: 'ts3client_win64.exe', displayName: 'TeamSpeak 3', category: 'Voice & Chat' },
  { executable: 'mumble.exe', displayName: 'Mumble Voice Client', category: 'Voice & Chat' },

  // Browsers
  { executable: 'chrome.exe', displayName: 'Google Chrome', category: 'Browsers' },
  { executable: 'msedge.exe', displayName: 'Microsoft Edge', category: 'Browsers' },
  { executable: 'firefox.exe', displayName: 'Mozilla Firefox', category: 'Browsers' },
  { executable: 'brave.exe', displayName: 'Brave Browser', category: 'Browsers' },
  { executable: 'opera.exe', displayName: 'Opera Browser', category: 'Browsers' },
  { executable: 'vivaldi.exe', displayName: 'Vivaldi Browser', category: 'Browsers' },
  { executable: 'zen.exe', displayName: 'Zen Browser', category: 'Browsers' },
  { executable: 'waterfox.exe', displayName: 'Waterfox', category: 'Browsers' },

  // Media
  { executable: 'spotify.exe', displayName: 'Spotify Music', category: 'Media' },
  { executable: 'vlc.exe', displayName: 'VLC Media Player', category: 'Media' },
  { executable: 'wmplayer.exe', displayName: 'Windows Media Player', category: 'Media' },
  { executable: 'mpc-hc64.exe', displayName: 'Media Player Classic', category: 'Media' },
  { executable: 'foobar2000.exe', displayName: 'foobar2000 Audio Player', category: 'Media' },
  { executable: 'audacity.exe', displayName: 'Audacity Audio Editor', category: 'Media' },
  { executable: 'obs64.exe', displayName: 'OBS Studio', category: 'Media' },
  { executable: 'reaper.exe', displayName: 'REAPER Digital Audio Workstation', category: 'Media' },
  { executable: 'fl64.exe', displayName: 'FL Studio', category: 'Media' },
  { executable: 'tidal.exe', displayName: 'TIDAL Music', category: 'Media' },
  { executable: 'apple-music.exe', displayName: 'Apple Music for Windows', category: 'Media' },

  // Games
  { executable: 'steam.exe', displayName: 'Steam Client', category: 'Games' },
  { executable: 'steamwebhelper.exe', displayName: 'Steam Web Helper', category: 'Games' },
  { executable: 'epicgameslauncher.exe', displayName: 'Epic Games Launcher', category: 'Games' },
  { executable: 'riotclientservices.exe', displayName: 'Riot Client', category: 'Games' },
  { executable: 'valorant.exe', displayName: 'VALORANT', category: 'Games' },
  { executable: 'cs2.exe', displayName: 'Counter-Strike 2', category: 'Games' },
  { executable: 'dota2.exe', displayName: 'Dota 2', category: 'Games' },
  { executable: 'leagueclient.exe', displayName: 'League of Legends Client', category: 'Games' },
  { executable: 'overwatch.exe', displayName: 'Overwatch 2', category: 'Games' },
  { executable: 'r5apex.exe', displayName: 'Apex Legends', category: 'Games' },
  { executable: 'fortniteclient-win64-shipping.exe', displayName: 'Fortnite', category: 'Games' },
  { executable: 'minecraft.exe', displayName: 'Minecraft Launcher', category: 'Games' },
  { executable: 'javaw.exe', displayName: 'Minecraft Java Edition', category: 'Games' },
  { executable: 'gta5.exe', displayName: 'Grand Theft Auto V', category: 'Games' },
  { executable: 'cyberpunk2077.exe', displayName: 'Cyberpunk 2077', category: 'Games' },

  // System
  { executable: 'explorer.exe', displayName: 'Windows Explorer & System Audio', category: 'System' },
  { executable: 'audiodg.exe', displayName: 'Windows Audio Device Graph', category: 'System' },
  { executable: 'systemsettings.exe', displayName: 'Windows Settings', category: 'System' },
  { executable: 'shellexperiencehost.exe', displayName: 'Windows Shell Host', category: 'System' },
  { executable: 'searchhost.exe', displayName: 'Windows Search Host', category: 'System' }
];

export function categorizeProcess(executableName: string, windowTitle?: string): { category: AppCategory; displayName: string } {
  const lowerExe = executableName.toLowerCase();
  
  const known = KNOWN_APPLICATIONS.find(app => app.executable.toLowerCase() === lowerExe);
  if (known) {
    return {
      category: known.category,
      displayName: (windowTitle && windowTitle.trim().length > 0 && windowTitle !== known.displayName) 
        ? `${known.displayName} - ${windowTitle}` 
        : known.displayName
    };
  }

  // Heuristic categorization based on name or window title
  const fullText = `${lowerExe} ${(windowTitle || '').toLowerCase()}`;

  if (fullText.includes('game') || fullText.includes('play') || fullText.includes('unreal') || fullText.includes('unity') || fullText.includes('steam')) {
    return { category: 'Games', displayName: formatDisplayName(executableName, windowTitle) };
  }
  if (fullText.includes('voice') || fullText.includes('chat') || fullText.includes('talk') || fullText.includes('call') || fullText.includes('meet')) {
    return { category: 'Voice & Chat', displayName: formatDisplayName(executableName, windowTitle) };
  }
  if (fullText.includes('music') || fullText.includes('sound') || fullText.includes('audio') || fullText.includes('video') || fullText.includes('player') || fullText.includes('media')) {
    return { category: 'Media', displayName: formatDisplayName(executableName, windowTitle) };
  }
  if (fullText.includes('browser') || fullText.includes('web') || fullText.includes('surf')) {
    return { category: 'Browsers', displayName: formatDisplayName(executableName, windowTitle) };
  }
  if (fullText.includes('host') || fullText.includes('svc') || fullText.includes('system') || fullText.includes('service')) {
    return { category: 'System', displayName: formatDisplayName(executableName, windowTitle) };
  }

  return {
    category: 'Media',
    displayName: formatDisplayName(executableName, windowTitle)
  };
}

function formatDisplayName(exe: string, windowTitle?: string): string {
  if (windowTitle && windowTitle.trim().length > 0 && !windowTitle.includes('.exe')) {
    return windowTitle;
  }
  const base = exe.replace(/\.exe$/i, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}
