/**
 * Help command handler
 */

/**
 * Handle /help command
 * @param {string} args - Command arguments
 * @param {Object} session - Current session
 * @param {Object} context - Additional context
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleHelp(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));

  addOutput({ type: 'system', text: 'droid-cua - AI-powered mobile device testing CLI' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Usage:' });
  addOutput({ type: 'info', text: '  droid-cua --avd <device-name> [options]' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Options:' });
  addOutput({ type: 'info', text: '  --avd <name>           Device name (Android AVD or iOS Simulator)' });
  addOutput({ type: 'info', text: '  --platform <platform>  Force platform: android or ios' });
  addOutput({ type: 'info', text: '  --instructions <file>  Run test file in headless mode' });
  addOutput({ type: 'info', text: '  --record               Record screenshots during execution' });
  addOutput({ type: 'info', text: '  --debug                Enable debug logging' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Interactive commands:' });
  addOutput({ type: 'info', text: '  /help                    Show this help message' });
  addOutput({ type: 'info', text: '  /exit                    Exit the CLI' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Test Management:' });
  addOutput({ type: 'info', text: '  /create <test-name>      Create a new test with autonomous design' });
  addOutput({ type: 'info', text: '  /run <test-name>         Execute an existing test' });
  addOutput({ type: 'info', text: '  /list                    List all available tests' });
  addOutput({ type: 'info', text: '  /view <test-name>        View test contents with line numbers' });
  addOutput({ type: 'info', text: '  /edit <test-name>        Edit a test in your default editor' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Integrations:' });
  addOutput({ type: 'info', text: '  /loadmill <command>      Run Loadmill test flows using natural language' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Platform Support:' });
  addOutput({ type: 'info', text: '  Android: Uses ADB to communicate with Android emulators' });
  addOutput({ type: 'info', text: '  iOS:     Uses Appium + XCUITest for iOS Simulator automation' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Platform Detection:' });
  addOutput({ type: 'info', text: '  - Use --platform flag to force a specific platform' });
  addOutput({ type: 'info', text: '  - Auto-detects iOS from device names containing "iPhone" or "iPad"' });
  addOutput({ type: 'info', text: '  - Set DROID_CUA_PLATFORM env var to "ios" or "android"' });
  addOutput({ type: 'info', text: '  - Defaults to Android if not detected' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'iOS Prerequisites:' });
  addOutput({ type: 'info', text: '  1. Xcode with iOS Simulator installed' });
  addOutput({ type: 'info', text: '  2. Appium: npm install -g appium' });
  addOutput({ type: 'info', text: '  3. XCUITest driver: appium driver install xcuitest' });
  addOutput({ type: 'info', text: '  Note: Appium server is auto-started when iOS platform is detected' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Examples:' });
  addOutput({ type: 'info', text: '  droid-cua --avd Pixel_8_API_35          (Android emulator)' });
  addOutput({ type: 'info', text: '  droid-cua --avd "iPhone 16"             (iOS Simulator, auto-detected)' });
  addOutput({ type: 'info', text: '  droid-cua --platform ios --avd MySim    (Force iOS platform)' });
  addOutput({ type: 'info', text: '  /create login-test                      (design a new test)' });
  addOutput({ type: 'info', text: '  /list                                   (see all tests)' });
  addOutput({ type: 'info', text: '  /view login-test                        (view test contents)' });
  addOutput({ type: 'info', text: '  /run login-test                         (execute test)' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'For more info, see README.md' });

  return true; // Continue loop
}
