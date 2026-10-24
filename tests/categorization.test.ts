import { categorizeProcess } from '../src/shared/categories';

export function testCategorization() {
  const tests = [
    { exe: 'discord.exe', title: 'Discord', expectedCat: 'Voice & Chat' },
    { exe: 'teams.exe', title: 'Microsoft Teams', expectedCat: 'Voice & Chat' },
    { exe: 'chrome.exe', title: 'YouTube - Google Chrome', expectedCat: 'Browsers' },
    { exe: 'firefox.exe', title: 'Mozilla Firefox', expectedCat: 'Browsers' },
    { exe: 'spotify.exe', title: 'Spotify Premium', expectedCat: 'Media' },
    { exe: 'vlc.exe', title: 'VLC Media Player', expectedCat: 'Media' },
    { exe: 'cs2.exe', title: 'Counter-Strike 2', expectedCat: 'Games' },
    { exe: 'explorer.exe', title: 'Windows Explorer', expectedCat: 'System' }
  ];

  for (const t of tests) {
    const res = categorizeProcess(t.exe, t.title);
    if (res.category !== t.expectedCat) {
      throw new Error(`Failed to categorize ${t.exe}: expected ${t.expectedCat}, got ${res.category}`);
    }
  }

  console.log('✓ testCategorization passed');
}
