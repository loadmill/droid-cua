# droid-cua

**A minimal AI agent that uses ADB to control Android emulators with OpenAI’s computer-use-preview model.**

---

## 🚀 How It Works

1. Connects to a running Android emulator using ADB.
2. Captures full-screen device screenshots.
3. Scales down the screenshots for compatibility with OpenAI's model.
4. Sends screenshots and user instructions to OpenAI’s computer-use-preview model.
5. Receives structured actions (click, scroll, type, keypress, wait, drag).
6. Rescales model outputs back to real device coordinates.
7. Executes the actions on the emulator via ADB.
8. Repeats until you type `exit`.

---

## 🛠 Setup

1. Install dependencies:
   ```sh
   npm install
   ```

2. Create a `.env` file with your OpenAI API key:
   ```sh
   echo "OPENAI_API_KEY=your-api-key" > .env
   ```

3. Start your Android emulator manually (optional):
   ```sh
   emulator -avd Your_AVD_Name
   ```

4. Run the agent:
   ```sh
   node index.js --avd=Your_AVD_Name
   ```

   If no `--avd` is provided, the agent will try to connect to the first running device.

---

## 🧠 Features

- Captures screenshots directly from the emulator (`adb exec-out screencap -p`).
- Dynamically scales the screenshot for OpenAI model compatibility.
- Maps model-generated actions (click, scroll, drag, type, keypress, wait) back to real device coordinates.
- Connects automatically to a running emulator or launches it if needed.
- Pretends the device screen is embedded inside a browser page for model compatibility.

---

## 📄 Command Line Flags

| Flag | Description |
|:-----|:------------|
| `--avd=AVD_NAME` | Select the emulator device by AVD name. |
| `--instructions=FILENAME` | Load user instructions from a text file. |

---

## 📋 Example Usage

Start your emulator:

```sh
emulator -avd Pixel_5_API_34
```

Run the agent:

```sh
node index.js --avd=Pixel_5_API_34
```

Run with an instructions file:

```sh
node index.js --avd=Pixel_5_API_34 --instructions=example.txt
```

Example `example.txt`:

```
Open Chrome
Search for "Loadmill"
Scroll down
Go back to the home screen
exit
```

---

## 📦 Requirements

- Node.js 18 or higher
- A running Android emulator (AVD)
- ADB installed and available in system PATH
- OpenAI Tier 3 access for the computer-use-preview model

---

## 📁 Project Structure

| File         | Responsibility |
|--------------|-----------------|
| `index.js`   | Manages user input, OpenAI conversation, and main loop. |
| `device.js`  | ADB device connection, screenshot capture, screen size management. |
| `actions.js` | Executes model actions on the device (tap, swipe, drag, type, keypress). |
| `openai.js`  | Sends requests to OpenAI and manages API responses. |

---

## ✅ Summary

**droid-cua** is a lightweight project that bridges OpenAI's computer-use-preview model to real Android devices using Node.js and ADB.  
Just pure, direct interaction with Android emulators — controlled by AI.
