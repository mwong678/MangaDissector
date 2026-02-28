// Manga Dissector - Background Service Worker
// Handles API calls to OpenAI and tab capture

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Listen for keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'activate-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'ACTIVATE_SELECTION' });
      }
    });
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CAPTURE_TAB':
      handleCaptureTab(sender.tab, sendResponse);
      return true;

    case 'ANALYZE_IMAGE':
      handleAnalyzeImage(message.imageData, sendResponse);
      return true;

    case 'TEST_API_KEY':
      testApiKey(message.apiKey, sendResponse);
      return true;
  }
});

async function handleCaptureTab(tab, sendResponse) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });
    sendResponse({ dataUrl });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function handleAnalyzeImage(imageData, sendResponse) {
  const startTime = performance.now();
  
  try {
    const result = await chrome.storage.local.get(['openaiApiKey']);
    const apiKey = result.openaiApiKey;

    if (!apiKey) {
      sendResponse({ error: 'API key not configured. Click the extension icon to set it up.' });
      return;
    }

    const { result: analysisResult, timing } = await analyzeWithGPT(apiKey, imageData);
    const totalMs = Math.round(performance.now() - startTime);
    
    sendResponse({ 
      result: analysisResult, 
      timing: {
        ...timing,
        totalMs
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    sendResponse({ error: error.message });
  }
}

async function analyzeWithGPT(apiKey, imageData) {
  const systemPrompt = `You are a Japanese language learning assistant specialized in manga/comic translation and OCR.

Your task: Look carefully at the image and extract ALL Japanese text visible. 

CRITICAL FOR MANGA: Japanese manga text is written VERTICALLY in columns that read RIGHT TO LEFT. A speech bubble may contain MULTIPLE COLUMNS of vertical text. You MUST read ALL columns from right to left, combining them into a complete sentence.

Example: If you see three vertical columns, read the rightmost column first (top to bottom), then the middle column, then the leftmost column.

When you find Japanese text:
1. Extract ALL the text - read every column from right to left
2. Combine all columns into the complete sentence/phrase
3. Provide the reading in hiragana for any kanji
4. Translate to natural English
5. Break down each word/phrase for learning

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "originalText": "the COMPLETE original Japanese text from ALL columns",
  "reading": "full text reading in hiragana",
  "translation": "natural English translation",
  "breakdown": [
    {
      "word": "Japanese word or phrase",
      "reading": "hiragana reading (for kanji)",
      "meaning": "English meaning",
      "type": "grammatical type (noun, verb, particle, etc.)"
    }
  ],
  "notes": "any cultural context, formality level, or usage notes (optional)"
}

ONLY if the image contains absolutely no Japanese text at all, respond with:
{
  "noText": true
}

Be thorough - read EVERY column of text visible in the image.`;

  // Calculate image size for logging
  const imageSizeKB = Math.round(imageData.length * 0.75 / 1024); // base64 to bytes approx
  console.log(`[MangaDissector] Image size: ${imageSizeKB}KB`);
  
  const apiStartTime = performance.now();
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze any Japanese text in this manga image and provide the translation with a detailed breakdown for learning purposes.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    })
  });

  const apiTime = Math.round(performance.now() - apiStartTime);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  console.log('[MangaDissector] API Response:', content);
  console.log(`[MangaDissector] API call took: ${apiTime}ms`);

  if (!content) {
    throw new Error('No response from API');
  }

  // Parse the JSON response
  try {
    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[MangaDissector] No JSON found in response:', content);
      throw new Error('Invalid response format');
    }
    const result = JSON.parse(jsonMatch[0]);
    console.log('[MangaDissector] Parsed result:', result);
    
    // Return result with timing info
    return { 
      result, 
      timing: { 
        apiMs: apiTime,
        imageSizeKB: imageSizeKB
      } 
    };
  } catch (parseError) {
    console.error('[MangaDissector] Parse error:', parseError, 'Content:', content);
    throw new Error('Failed to parse analysis result');
  }
}

async function testApiKey(apiKey, sendResponse) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      sendResponse({ success: true });
    } else {
      const error = await response.json().catch(() => ({}));
      sendResponse({ 
        success: false, 
        error: error.error?.message || 'Invalid API key' 
      });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
