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

**AI-powered Android testing using OpenAI's computer-use model**

Create and run automated Android tests using natural language. The AI explores your app and generates executable test scripts.

https://github.com/user-attachments/assets/36b2ea7e-820a-432d-9294-8aa61dceb4b0

---

<h2 id="what-is-droid-cua">💡 What is droid-cua?</h2>

`droid-cua` gives you three core components for Android testing:

* **Interactive Shell** – Design and run tests with real-time feedback and visual status indicators
* **Test Scripts** – Simple text files with natural language instructions and assertions
* **AI Agent** – Autonomous exploration powered by OpenAI's computer-use model

Together, these let you create and execute Android tests without writing traditional test code.

---

<h2 id="quick-start">🚀 Quick Start</h2>

```sh
# Install
npm install -g @loadmill/droid-cua

# Set API key
export OPENAI_API_KEY=your-key

# Run
droid-cua
```

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
| `--avd=NAME` | Specify emulator |
| `--instructions=FILE` | Run test headless |
| `--record` | Save screenshots |
| `--debug` | Enable debug logs |

---

## Requirements

- Node.js 18.17.0+
- Android Debug Bridge (ADB)
- Android Emulator (AVD)
- OpenAI API Key (Tier 3 for computer-use-preview model)

---

<h2 id="how-it-works">🔧 How It Works</h2>

1. Connects to a running Android emulator
2. Captures full-screen device screenshots
3. Scales down the screenshots for OpenAI model compatibility
4. Sends screenshots and user instructions to OpenAI's computer-use-preview model
5. Receives structured actions (click, scroll, type, keypress, wait, drag)
6. Rescales model outputs back to real device coordinates
7. Executes the actions on the device via ADB
8. Validates assertions and handles failures
9. Repeats until task completion

---

<h2 id="license">📄 License</h2>

© 2025 Loadmill. All rights reserved.
