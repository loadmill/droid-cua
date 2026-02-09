# droid-cua

<p align="center">
  <a href="https://www.npmjs.com/package/@loadmill/droid-cua"><img src="https://img.shields.io/npm/v/@loadmill/droid-cua?color=green" alt="npm version"></a>
</p>

<p align="center">
  <a href="#what-is-droid-cua">What is droid-cua?</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#usage">Usage</a> •
  <a href="#assertions">Assertions</a> •
  <a href="#command-line-options">Command Line Options</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#license">License</a>
</p>

---

**AI-powered mobile testing using OpenAI's computer-use model**

Create and run automated Android and iOS tests using natural language. The AI explores your app and generates executable test scripts.

https://github.com/user-attachments/assets/36b2ea7e-820a-432d-9294-8aa61dceb4b0

---

<h2 id="what-is-droid-cua">💡 What is droid-cua?</h2>

`droid-cua` gives you three core components for mobile testing:

* **Interactive Shell** – Design and run tests with real-time feedback and visual status indicators
* **Test Scripts** – Simple text files with natural language instructions and assertions
* **AI Agent** – Autonomous exploration powered by OpenAI's computer-use model

Together, these let you create and execute Android and iOS tests without writing traditional test code.

---

<h2 id="quick-start">🚀 Quick Start</h2>

**1. Install**

Globally (recommended):
```sh
npm install -g @loadmill/droid-cua
```

Or from source:
```sh
git clone https://github.com/loadmill/droid-cua
cd droid-cua
npm install
npm run build
```

**2. Set your OpenAI API key**

Using environment variable:
```sh
export OPENAI_API_KEY=your-api-key
```

Or create a `.env` file:
```sh
echo "OPENAI_API_KEY=your-api-key" > .env
```

**3. Setup for your platform**

For Android:
```sh
adb version  # Ensure ADB is available
```

For iOS (macOS only):
```sh
# Install Appium and XCUITest driver
npm install -g appium
appium driver install xcuitest
```

**4. Run**

```sh
droid-cua
```

An interactive menu will let you select your platform and device:

```
┌──────────────────────────────────────┐
│ Select Platform                      │
└──────────────────────────────────────┘

❯ Android (1 running) - 2 emulator(s)
  iOS - 5 simulator(s)

↑/↓ Navigate  Enter Select  q Quit
```

The emulator/simulator will auto-launch if not already running.

---

<h2 id="features">✨ Features</h2>

- **Design Mode** - Describe what to test, AI explores and creates test scripts
- **Execution Mode** - Run tests with real-time feedback and assertion handling
- **Headless Mode** - Run tests in CI/CD pipelines
- **Test Management** - Create, edit, view, and run test scripts
- **Smart Actions** - Automatic wait detection and coordinate mapping

---

<h2 id="usage">📚 Usage</h2>

### Interactive Commands

| Command | Description |
|---------|-------------|
| `/create <name>` | Create a new test |
| `/run <name>` | Execute a test |
| `/list` | List all tests |
| `/view <name>` | View test contents |
| `/edit <name>` | Edit a test |
| `/help` | Show help |
| `/exit` | Exit shell |

### Creating Tests

```sh
droid-cua
> /create login-test
> Test the login flow with valid credentials
```

The AI will explore your app and generate a test script. Review and save it.

### Running Tests

Interactive:
```sh
droid-cua
> /run login-test
```

Headless (CI/CD):
```sh
droid-cua --instructions tests/login-test.dcua
```

### Test Script Format

One instruction per line:

```
Open the Calculator app
assert: Calculator app is visible
Type "2"
Click the plus button
Type "3"
Click the equals button
assert: result shows 5
exit
```

<h3 id="assertions">Assertions</h3>

Assertions validate the app state during test execution. Add them anywhere in your test script.

**Syntax** (all valid):
```
assert: the login button is visible
Assert: error message appears
ASSERT the result shows 5
```

**Interactive Mode** - When an assertion fails:
- `retry` - Retry the same assertion
- `skip` - Continue to next instruction
- `stop` - Stop test execution

**Headless Mode** - Assertions fail immediately and exit with code 1.

**Examples**:
```
assert: Calculator app is open
assert: the result shows 8
assert: error message is displayed in red
assert: login button is enabled
```

---

<h2 id="command-line-options">💻 Command Line Options</h2>

| Option | Description |
|--------|-------------|
| `--avd=NAME` | Specify emulator/simulator name |
| `--platform=PLATFORM` | Force platform: `android` or `ios` |
| `--instructions=FILE` | Run test headless |
| `--record` | Save screenshots |
| `--debug` | Enable debug logs |

**Examples:**
```sh
# Interactive device selection
droid-cua

# Android emulator
droid-cua --avd Pixel_8_API_35

# iOS Simulator (auto-detected from name)
droid-cua --avd "iPhone 16"

# iOS Simulator (explicit platform)
droid-cua --platform ios --avd "iPhone 16"

# Headless CI mode
droid-cua --avd "iPhone 16" --instructions tests/login.dcua
```

---

## Requirements

**All platforms:**
- Node.js 18.17.0+
- OpenAI API Key (Tier 3 for computer-use-preview model)

**Android:**
- Android Debug Bridge (ADB)
- Android Emulator (AVD)

**iOS (macOS only):**
- Xcode with iOS Simulator
- Appium (`npm install -g appium`)
- XCUITest driver (`appium driver install xcuitest`)

---

<h2 id="how-it-works">🔧 How It Works</h2>

1. Connects to Android emulator (via ADB) or iOS Simulator (via Appium)
2. Captures full-screen device screenshots
3. Scales down the screenshots for OpenAI model compatibility
4. Sends screenshots and user instructions to OpenAI's computer-use-preview model
5. Receives structured actions (click, scroll, type, keypress, wait, drag)
6. Rescales model outputs back to real device coordinates
7. Executes the actions on the device
8. Validates assertions and handles failures
9. Repeats until task completion

---

## 🎞️ Convert Screenshots to Video

If you run with `--record`, screenshots are saved to:
```
droid-cua-recording-<timestamp>/
```

Convert to video with ffmpeg:
```sh
ffmpeg -framerate 1 -pattern_type glob -i 'droid-cua-recording-*/frame_*.png' \
  -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" \
  -c:v libx264 -pix_fmt yuv420p session.mp4
```

---

<h2 id="license">📄 License</h2>

© 2025 Loadmill. All rights reserved.
