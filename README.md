# Manga Dissector

A Chrome extension for learning Japanese while reading manga. Instead of replacing Japanese text with translations, this extension lets you select any manga text to see:

- The original Japanese text with reading (furigana)
- English translation
- Word-by-word breakdown with meanings and grammar
- Cultural/usage notes

## Features

- **Select Any Text**: Click and drag over manga panels to analyze text
- **Detailed Breakdowns**: See each word's reading, meaning, and grammatical role
- **Non-Intrusive**: The original manga stays untouched until you want help
- **Keyboard Shortcut**: Press `Alt+M` to quickly enter selection mode

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" and select this folder
5. Click the extension icon and enter your OpenAI API key

## Usage

1. Navigate to any webpage with manga images
2. Press `Alt+M` or click the extension icon and select "Select Region to Analyze"
3. Draw a rectangle over the Japanese text you want to understand
4. View the translation and detailed breakdown in the tooltip

## API Key

This extension uses GPT-4o-mini for OCR and translation. You'll need an OpenAI API key:

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Enter it in the extension popup

The key is stored locally in Chrome and only sent to OpenAI's API.

## Cost

GPT-4o-mini is very affordable:
- ~$0.15 per million input tokens
- A typical manga panel analysis costs less than $0.001

## Tech Stack

- Chrome Extension Manifest V3
- GPT-4o-mini Vision API for OCR + translation
- Vanilla JavaScript (no dependencies)

## Privacy

- Your API key is stored only in Chrome's local storage
- Images are sent directly to OpenAI's API (no intermediary servers)
- No data is collected or stored by this extension
