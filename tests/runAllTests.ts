import { testProcessDiscoveryAndMatching } from './processDiscovery.test';
import { testCategorization } from './categorization.test';
import { testDeviceEnumeration } from './deviceEnumeration.test';
import { testHotkeyConflictDetection, testHotkeyNormalization } from './hotkeyConflict.test';
import { testConfiguration } from './configuration.test';

async function run() {
  console.log('--- Running Super Audio Control Automated Tests ---');
  try {
    testCategorization();
    testConfiguration();
    testProcessDiscoveryAndMatching();
    await testDeviceEnumeration();
    testHotkeyConflictDetection();
    testHotkeyNormalization();
    console.log('--- ALL TESTS PASSED (6/6) ---');
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  }
}

run();
