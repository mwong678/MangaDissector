document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyBtn = document.getElementById('toggleKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const statusEl = document.getElementById('status');
  const activateBtn = document.getElementById('activateBtn');

  // Load saved API key
  chrome.storage.local.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }
  });

  // Toggle password visibility
  toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.textContent = isPassword ? '🔒' : '👁';
  });

  // Save API key
  saveKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      showStatus('Invalid API key format', 'error');
      return;
    }

    // Test the API key
    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = '⏳ Validating...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_API_KEY',
        apiKey: apiKey
      });

      if (response.success) {
        chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
          showStatus('API key saved successfully!', 'success');
        });
      } else {
        showStatus(response.error || 'Invalid API key', 'error');
      }
    } catch (error) {
      showStatus('Failed to validate key: ' + error.message, 'error');
    } finally {
      saveKeyBtn.disabled = false;
      saveKeyBtn.innerHTML = '💾 Save API Key';
    }
  });

  // Activate selection mode
  activateBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_SELECTION' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Cannot activate on this page. Try refreshing.', 'error');
      } else {
        window.close();
      }
    });
  });

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
  }
});
