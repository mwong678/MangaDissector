// Manga Dissector - Content Script
// Handles selection overlay and tooltip display

(function() {
  'use strict';

  let isSelectionMode = false;
  let selectionOverlay = null;
  let selectionBox = null;
  let startX, startY;
  let tooltipEl = null;
  let resultsCache = new Map();
  let boundBlockEvent = null;
  let keepTooltipOpen = false;  // Prevent closing during capture/analyze

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ACTIVATE_SELECTION') {
      activateSelectionMode();
      sendResponse({ success: true });
    }
    return true;
  });

  // Listen for keyboard shortcut
  document.addEventListener('keydown', (e) => {
    // Alt+M to activate
    if (e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      activateSelectionMode();
    }
    // Escape to cancel
    if (e.key === 'Escape' && isSelectionMode) {
      deactivateSelectionMode();
    }
  });

  function activateSelectionMode() {
    if (isSelectionMode) return;
    isSelectionMode = true;
    keepTooltipOpen = true;  // Keep tooltip open during selection

    // Block all page interactions
    document.documentElement.classList.add('manga-dissector-active');

    // Create bound function for event blocking so we can remove it later
    boundBlockEvent = blockAllEvents.bind(null);
    
    // Add document-level event blockers in capture phase
    // These fire BEFORE any other handlers on the page
    const eventsToBlock = [
      'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
      'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'pointermove',
      'touchmove', 'touchstart', 'touchend',
      'scroll', 'wheel'
    ];
    
    eventsToBlock.forEach(eventType => {
      document.addEventListener(eventType, boundBlockEvent, true);
      window.addEventListener(eventType, boundBlockEvent, true);
    });

    // Create full-page overlay
    selectionOverlay = document.createElement('div');
    selectionOverlay.className = 'manga-dissector-overlay';
    selectionOverlay.innerHTML = `
      <div class="manga-dissector-hint">
        Click and drag to select manga text region
        <span class="manga-dissector-hint-sub">Press ESC to cancel</span>
      </div>
    `;
    document.body.appendChild(selectionOverlay);

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.className = 'manga-dissector-selection';
    selectionOverlay.appendChild(selectionBox);

    // Add event listeners for our selection functionality
    selectionOverlay.addEventListener('mousedown', onMouseDown, true);
    selectionOverlay.addEventListener('mousemove', onSelectionMouseMove, true);
    selectionOverlay.addEventListener('mouseup', onMouseUp, true);
  }

  function blockAllEvents(e) {
    // Don't block events on our own overlay elements
    if (e.target && (
      e.target.classList?.contains('manga-dissector-overlay') ||
      e.target.classList?.contains('manga-dissector-selection') ||
      e.target.classList?.contains('manga-dissector-hint') ||
      e.target.closest?.('.manga-dissector-overlay')
    )) {
      return;
    }
    
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
  }

  function onSelectionMouseMove(e) {
    // Handle our selection box drawing
    onMouseMove(e);
    // Stop the event from going anywhere else
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function deactivateSelectionMode() {
    isSelectionMode = false;
    document.documentElement.classList.remove('manga-dissector-active');
    
    // Remove document-level event blockers
    if (boundBlockEvent) {
      const eventsToBlock = [
        'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
        'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'pointermove',
        'touchmove', 'touchstart', 'touchend',
        'scroll', 'wheel'
      ];
      
      eventsToBlock.forEach(eventType => {
        document.removeEventListener(eventType, boundBlockEvent, true);
        window.removeEventListener(eventType, boundBlockEvent, true);
      });
      boundBlockEvent = null;
    }
    
    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
      selectionBox = null;
    }
  }

  function onMouseDown(e) {
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
  }

  function onMouseMove(e) {
    if (!startX || !startY) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }

  async function onMouseUp(e) {
    if (!startX || !startY) return;

    const endX = e.clientX;
    const endY = e.clientY;
    
    // Save mouse coordinates before reset
    const savedStartX = startX;
    const savedStartY = startY;

    // Calculate selection from mouse coordinates directly
    const mouseLeft = Math.min(savedStartX, endX);
    const mouseTop = Math.min(savedStartY, endY);
    const mouseWidth = Math.abs(endX - savedStartX);
    const mouseHeight = Math.abs(endY - savedStartY);

    // Also get selection box rect to compare
    const boxRect = selectionBox.getBoundingClientRect();
    
    console.log('[MangaDissector] Selection comparison:', {
      fromMouse: `(${mouseLeft}, ${mouseTop}) ${mouseWidth}×${mouseHeight}`,
      fromBox: `(${boxRect.left.toFixed(0)}, ${boxRect.top.toFixed(0)}) ${boxRect.width.toFixed(0)}×${boxRect.height.toFixed(0)}`,
      match: mouseLeft === boxRect.left && mouseTop === boxRect.top
    });

    // Use mouse coordinates directly - they're more reliable
    let left = mouseLeft;
    let top = mouseTop;
    let width = mouseWidth;
    let height = mouseHeight;

    // Reset start position
    startX = null;
    startY = null;

    // Minimum selection size
    if (width < 20 || height < 20) {
      deactivateSelectionMode();
      return;
    }

    // Capture the selected region
    try {
      // Keep tooltip open during capture/analyze
      keepTooltipOpen = true;
      
      // Make overlay transparent instead of hiding it
      // This prevents any layout shifts that could affect coordinates
      if (selectionOverlay) {
        selectionOverlay.style.opacity = '0';
        selectionOverlay.style.pointerEvents = 'none';
      }
      
      // Brief wait for transparency to apply
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const imageData = await captureRegion(left, top, width, height);
      deactivateSelectionMode();
      await analyzeImage(imageData, left, top, width, height);
      
      // Allow closing again after a short delay
      setTimeout(() => { keepTooltipOpen = false; }, 500);
    } catch (error) {
      console.error('Capture error:', error);
      deactivateSelectionMode();
      keepTooltipOpen = false;
      showError('Failed to capture region: ' + error.message);
    }
  }

  async function captureRegion(left, top, width, height) {
    // Request screenshot from background script
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.dataUrl) {
          reject(new Error('Failed to capture screenshot'));
          return;
        }

        // Crop the image to the selected region
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Simple: screenshot is viewport × devicePixelRatio
          const dpr = window.devicePixelRatio || 1;
          
          // Get visual viewport info
          const vv = window.visualViewport;
          const vvScale = vv ? vv.scale : 1;
          const vvOffsetX = vv ? vv.offsetLeft : 0;
          const vvOffsetY = vv ? vv.offsetTop : 0;
          const vvWidth = vv ? vv.width : window.innerWidth;
          const vvHeight = vv ? vv.height : window.innerHeight;
          
          console.log('[MangaDissector] === DEBUG INFO ===');
          console.log('Screenshot size:', img.naturalWidth, '×', img.naturalHeight);
          console.log('Layout viewport:', window.innerWidth, '×', window.innerHeight);
          console.log('Visual viewport:', vvWidth.toFixed(0), '×', vvHeight.toFixed(0), 'at scale', vvScale.toFixed(2));
          console.log('Visual viewport offset:', vvOffsetX.toFixed(0), ',', vvOffsetY.toFixed(0));
          console.log('Selection (layout coords):', left.toFixed(0), ',', top.toFixed(0), 'size', width.toFixed(0), '×', height.toFixed(0));
          
          // Convert layout coordinates to visual viewport coordinates
          // Mouse clientX/Y are in layout viewport coords
          // We need to convert to position within the visual viewport
          const visualX = left - vvOffsetX;
          const visualY = top - vvOffsetY;
          console.log('Selection (visual coords):', visualX.toFixed(0), ',', visualY.toFixed(0));
          
          // Screenshot scale: screenshot pixels per visual viewport pixel
          const scale = img.naturalWidth / vvWidth;
          console.log('Scale (screenshot/visual):', scale.toFixed(3));
          
          // Calculate screenshot coordinates
          const buffer = 5 * scale;
          const srcX = Math.max(0, visualX * scale - buffer);
          const srcY = Math.max(0, visualY * scale - buffer);
          const srcWidth = width * scale + buffer * 2;
          const srcHeight = height * scale + buffer * 2;
          
          console.log('Crop region:', srcX.toFixed(0), ',', srcY.toFixed(0), 'size', srcWidth.toFixed(0), '×', srcHeight.toFixed(0));
          console.log('Valid?', srcX >= 0 && srcY >= 0 && srcX + srcWidth <= img.naturalWidth && srcY + srcHeight <= img.naturalHeight);
          
          // DEBUG: Draw the crop rectangle on the full screenshot
          const debugCanvas = document.createElement('canvas');
          debugCanvas.width = img.naturalWidth / 4;  // Scale down for display
          debugCanvas.height = img.naturalHeight / 4;
          const debugCtx = debugCanvas.getContext('2d');
          debugCtx.drawImage(img, 0, 0, debugCanvas.width, debugCanvas.height);
          debugCtx.strokeStyle = 'red';
          debugCtx.lineWidth = 3;
          debugCtx.strokeRect(srcX/4, srcY/4, srcWidth/4, srcHeight/4);
          console.log('[MangaDissector] Full screenshot with crop region (red box):');
          console.log('%c ', `
            font-size: 1px;
            padding: ${debugCanvas.height/2}px ${debugCanvas.width/2}px;
            background: url(${debugCanvas.toDataURL()}) no-repeat;
            background-size: contain;
          `);
          
          console.log('[MangaDissector] Crop coordinates:', {
            scale: scale.toFixed(3),
            srcX: srcX.toFixed(0),
            srcY: srcY.toFixed(0),
            srcWidth: srcWidth.toFixed(0),
            srcHeight: srcHeight.toFixed(0)
          });
          
          // Ensure minimum size for better OCR
          const minDimension = 200;
          
          canvas.width = Math.max(srcWidth, minDimension);
          canvas.height = Math.max(srcHeight, minDimension);
          
          // Use better image scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(
            img,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );
          
          // Use high quality JPEG for better compression while maintaining quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          console.log('[MangaDissector] Captured region:', { 
            selection: `${left},${top} ${width}x${height}`,
            src: `${srcX.toFixed(0)},${srcY.toFixed(0)} ${srcWidth.toFixed(0)}x${srcHeight.toFixed(0)}`,
            canvas: `${canvas.width}x${canvas.height}`
          });
          
          // Debug: Show captured image in console
          console.log('[MangaDissector] Captured image preview:');
          console.log('%c ', `
            font-size: 1px;
            padding: ${Math.min(canvas.height/2, 150)}px ${Math.min(canvas.width/2, 200)}px;
            background: url(${dataUrl}) no-repeat;
            background-size: contain;
          `);
          
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load screenshot'));
        img.src = response.dataUrl;
      });
    });
  }

  async function analyzeImage(imageData, left, top, width, height) {
    // Show loading tooltip
    showTooltip(left + width / 2, top + height, {
      loading: true
    });

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_IMAGE',
        imageData: imageData
      });

      if (response.error) {
        console.log('[MangaDissector] API Error:', response.error);
        updateTooltipContent({ error: response.error });
      } else {
        console.log('[MangaDissector] API Result:', response.result);
        updateTooltipContent({ result: response.result });
      }
    } catch (error) {
      updateTooltipContent({ error: 'Analysis failed: ' + error.message });
    }
  }

  function updateTooltipContent(data) {
    if (!tooltipEl) return;
    
    const content = tooltipEl.querySelector('.manga-dissector-content');
    if (!content) return;

    if (data.error) {
      content.innerHTML = `
        <div class="manga-dissector-error">
          <span class="manga-dissector-error-icon">⚠️</span>
          <span>${escapeHtml(data.error)}</span>
        </div>
      `;
    } else if (data.result) {
      content.innerHTML = formatResult(data.result);
    }
  }

  function showTooltip(x, y, data) {
    // If tooltip exists, just update the content and keep position
    if (tooltipEl) {
      const content = tooltipEl.querySelector('.manga-dissector-content');
      if (content) {
        if (data.loading) {
          content.innerHTML = `
            <div class="manga-dissector-loading">
              <div class="manga-dissector-spinner"></div>
              <span>Analyzing Japanese text...</span>
            </div>
          `;
        } else if (data.error) {
          content.innerHTML = `
            <div class="manga-dissector-error">
              <span class="manga-dissector-error-icon">⚠️</span>
              <span>${escapeHtml(data.error)}</span>
            </div>
          `;
        } else if (data.result) {
          content.innerHTML = formatResult(data.result);
        }
        return;  // Keep existing position
      }
    }

    // Create new tooltip
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'manga-dissector-tooltip';

    // Create draggable header
    const header = document.createElement('div');
    header.className = 'manga-dissector-header';
    header.innerHTML = '<span class="manga-dissector-title">📖 Manga Dissector</span>';
    
    // Add close button to header
    const closeBtn = document.createElement('button');
    closeBtn.className = 'manga-dissector-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      tooltipEl.remove();
      tooltipEl = null;
      document.removeEventListener('click', closeTooltipOnClickOutside);
    };
    header.appendChild(closeBtn);
    tooltipEl.appendChild(header);

    // Create content container
    const content = document.createElement('div');
    content.className = 'manga-dissector-content';

    if (data.loading) {
      content.innerHTML = `
        <div class="manga-dissector-loading">
          <div class="manga-dissector-spinner"></div>
          <span>Analyzing Japanese text...</span>
        </div>
      `;
    } else if (data.error) {
      content.innerHTML = `
        <div class="manga-dissector-error">
          <span class="manga-dissector-error-icon">⚠️</span>
          <span>${escapeHtml(data.error)}</span>
        </div>
      `;
    } else if (data.result) {
      content.innerHTML = formatResult(data.result);
    }

    tooltipEl.appendChild(content);

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'manga-dissector-resize-handle';
    tooltipEl.appendChild(resizeHandle);

    document.body.appendChild(tooltipEl);

    // Calculate browser zoom level and apply inverse scale to keep tooltip consistent size
    const baseScale = window.screen.availWidth / window.innerWidth;
    const zoomLevel = Math.round(baseScale * 100) / 100;
    
    // Only scale down if zoomed in (zoomLevel > 1.1 to avoid micro-adjustments)
    if (zoomLevel > 1.1) {
      const inverseScale = 1 / zoomLevel;
      tooltipEl.style.transform = `scale(${inverseScale})`;
      tooltipEl.style.transformOrigin = 'top left';
    }

    // Position tooltip
    const tooltipRect = tooltipEl.getBoundingClientRect();
    let tooltipX = x - tooltipRect.width / 2;
    let tooltipY = y + 10;

    // Keep within viewport
    if (tooltipX < 10) tooltipX = 10;
    if (tooltipX + tooltipRect.width > window.innerWidth - 10) {
      tooltipX = window.innerWidth - tooltipRect.width - 10;
    }
    if (tooltipY + tooltipRect.height > window.innerHeight - 10) {
      tooltipY = y - tooltipRect.height - 10;
    }

    tooltipEl.style.left = tooltipX + 'px';
    tooltipEl.style.top = tooltipY + 'px';

    // Setup drag functionality on the entire tooltip
    setupDrag(tooltipEl);
    
    // Setup resize functionality
    setupResize(resizeHandle, tooltipEl);

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', closeTooltipOnClickOutside);
    }, 100);
  }

  function setupDrag(element) {
    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    element.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on close button, resize handle, or if user is selecting text
      if (e.target.classList.contains('manga-dissector-close') ||
          e.target.classList.contains('manga-dissector-resize-handle')) {
        return;
      }
      
      isDragging = true;
      dragOffsetX = e.clientX - element.offsetLeft;
      dragOffsetY = e.clientY - element.offsetTop;
      element.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      let newX = e.clientX - dragOffsetX;
      let newY = e.clientY - dragOffsetY;
      
      // Keep within viewport
      const rect = element.getBoundingClientRect();
      newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));
      
      element.style.left = newX + 'px';
      element.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = '';
      }
    });
  }

  function setupResize(handle, element) {
    let isResizing = false;
    let startWidth, startHeight, startX, startY;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startWidth = element.offsetWidth;
      startHeight = element.offsetHeight;
      startX = e.clientX;
      startY = e.clientY;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(250, startWidth + (e.clientX - startX));
      const newHeight = Math.max(150, startHeight + (e.clientY - startY));
      
      element.style.width = newWidth + 'px';
      element.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
      isResizing = false;
    });
  }

  function closeTooltipOnClickOutside(e) {
    // Don't close if in selection mode or during capture/analyze
    if (isSelectionMode || keepTooltipOpen) return;
    
    // Don't close if clicking on the overlay or selection box
    if (e.target.classList.contains('manga-dissector-overlay') ||
        e.target.classList.contains('manga-dissector-selection')) {
      return;
    }
    
    if (tooltipEl && !tooltipEl.contains(e.target)) {
      tooltipEl.remove();
      tooltipEl = null;
      document.removeEventListener('click', closeTooltipOnClickOutside);
    }
  }

  function formatResult(result) {
    // Parse the result from GPT
    // Expected format includes: original text, translation, and breakdown
    
    let html = '<div class="manga-dissector-result">';
    
    if (result.originalText) {
      html += `
        <div class="manga-dissector-section">
          <div class="manga-dissector-label">Original</div>
          <div class="manga-dissector-original">${escapeHtml(result.originalText)}</div>
        </div>
      `;
    }

    if (result.reading) {
      html += `
        <div class="manga-dissector-section">
          <div class="manga-dissector-label">Reading</div>
          <div class="manga-dissector-reading">${escapeHtml(result.reading)}</div>
        </div>
      `;
    }

    if (result.translation) {
      html += `
        <div class="manga-dissector-section">
          <div class="manga-dissector-label">Translation</div>
          <div class="manga-dissector-translation">${escapeHtml(result.translation)}</div>
        </div>
      `;
    }

    if (result.breakdown && result.breakdown.length > 0) {
      html += `
        <details class="manga-dissector-section manga-dissector-collapsible">
          <summary class="manga-dissector-label manga-dissector-collapse-toggle">
            Breakdown
            <span class="manga-dissector-collapse-icon"></span>
          </summary>
          <div class="manga-dissector-breakdown">
      `;
      
      for (const item of result.breakdown) {
        html += `
          <div class="manga-dissector-word">
            <span class="manga-dissector-word-japanese">${escapeHtml(item.word)}</span>
            ${item.reading ? `<span class="manga-dissector-word-reading">(${escapeHtml(item.reading)})</span>` : ''}
            <span class="manga-dissector-word-meaning">— ${escapeHtml(item.meaning)}</span>
            ${item.type ? `<span class="manga-dissector-word-type">[${escapeHtml(item.type)}]</span>` : ''}
          </div>
        `;
      }
      
      html += '</div></details>';
    }

    if (result.notes) {
      html += `
        <div class="manga-dissector-section">
          <div class="manga-dissector-label">Notes</div>
          <div class="manga-dissector-notes">${escapeHtml(result.notes)}</div>
        </div>
      `;
    }

    if (result.noText) {
      html += `
        <div class="manga-dissector-no-text">
          No Japanese text detected in the selected region.
          <br><small>Try selecting a different area.</small>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showError(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'manga-dissector-toast manga-dissector-toast-error';
    errorEl.textContent = message;
    document.body.appendChild(errorEl);
    
    setTimeout(() => errorEl.remove(), 4000);
  }

})();
