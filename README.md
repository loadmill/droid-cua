# droid-cua

**AI-powered Android testing using OpenAI's computer-use model**

Create and run automated Android tests using natural language. The AI explores your app and generates executable test scripts.

https://github.com/user-attachments/assets/36b2ea7e-820a-432d-9294-8aa61dceb4b0

---

## Quick Start

```sh
# Install
npm install -g @loadmill/droid-cua

# Set API key
export OPENAI_API_KEY=your-key

# Run
droid-cua
```

---

## Features

- **Design Mode** - Describe what to test, AI explores and creates test scripts
- **Execution Mode** - Run tests with real-time feedback and assertion handling
- **Headless Mode** - Run tests in CI/CD pipelines
- **Test Management** - Create, edit, view, and run test scripts
- **Smart Actions** - Automatic wait detection and coordinate mapping

---

## Usage

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

---

## Command Line Options

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

## How It Works

1. Connects to Android emulator via ADB
2. Captures and scales screenshots
3. Sends to OpenAI computer-use-preview model
4. Receives structured actions (click, scroll, type)
5. Executes actions on device
6. Validates assertions

---

## License

© 2025 Loadmill. All rights reserved.
