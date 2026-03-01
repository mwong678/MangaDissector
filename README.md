# Manga Dissector

A Chrome extension for learning Japanese while reading manga. Select any manga text to see translations and word-by-word breakdowns - perfect for Japanese learners!

![Demo](https://img.shields.io/badge/Status-Active-success)

## ✨ Features

- **Hover for Details**: Hover over any word in the original text to see its reading and meaning
- **Full Translation**: See the complete English translation
- **Keyboard Shortcut**: Press `Alt+M` to quickly select text
- **Non-Intrusive**: The original manga stays untouched

---

## 📥 Installation (Easy Mode)

### Step 1: Download
1. Go to the [**Releases page**](../../releases/latest)
2. Download the `.zip` file (e.g., `MangaDissector-v1.0.0.zip`)

### Step 2: Unzip
1. Find the downloaded file (usually in your Downloads folder)
2. **Right-click** the zip file
3. Select **"Extract All"** (Windows) or just **double-click** (Mac)
4. Remember where you extracted it!

### Step 3: Add to Chrome
1. Open Chrome
2. Type `chrome://extensions` in the address bar and press Enter
3. Turn ON **"Developer mode"** (toggle switch in the top-right corner)
4. Click the **"Load unpacked"** button
5. Navigate to the folder you extracted and select it
6. The extension is now installed! ✅

### Step 4: Set Up API Key
1. Click the puzzle piece icon (🧩) in Chrome's toolbar
2. Click **"Manga Dissector"**
3. Enter your OpenAI API key (see below for how to get one)
4. Click **"Save API Key"**

---

## 🔑 Getting an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to [API Keys](https://platform.openai.com/api-keys)
4. Click **"Create new secret key"**
5. Copy the key and paste it into the extension

**Cost**: Very affordable! Each translation costs less than $0.001 (a fraction of a penny).

---

## 🎮 How to Use

1. Go to any website with manga
2. Press **`Alt+M`** on your keyboard (or click the extension icon → "Select Region")
3. **Click and drag** a box around the Japanese text you want to translate
4. Wait a few seconds for the translation
5. **Hover over words** in the original text to see their meanings!

---

## 💡 Tips

- Select **just the text bubble**, not the whole page
- Works best with clear, high-contrast text
- The window stays open - select new text to update it
- Drag the translation window to move it around
- Use the corner to resize it

---

## 🔒 Privacy

- Your API key stays on your computer (never sent anywhere except OpenAI)
- Images are sent directly to OpenAI for translation
- No data is collected by this extension

---

## 🛠 For Developers

If you want to modify the extension:

```bash
git clone https://github.com/YOUR_USERNAME/MangaDissector.git
cd MangaDissector
# Load unpacked in Chrome from this folder
```

### Tech Stack
- Chrome Extension Manifest V3
- GPT-4o-mini Vision API
- Vanilla JavaScript (no dependencies)
