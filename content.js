// Visual Scholar - Content Script
// This script is injected dynamically when the user triggers the extension shortcut.

(function () {
  if (window.__visualScholarLoaded) {
    // If already loaded, this content script will just listen to start-capture messages
    return;
  }
  window.__visualScholarLoaded = true;

  // On startup, check and apply forced dark mode theme if enabled
  chrome.storage.local.get(['forcedDarkMode'], (result) => {
    if (result.forcedDarkMode === 'enabled') {
      applyForcedDarkMode(true);
    }
  });

  let overlayContainer = null;
  let selectionBox = null;
  let panels = {};
  let toolbar = null;
  let isSelecting = false;
  let selectionActive = false;
  
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;

  // Initialize and build UI
  function createOverlay() {
    if (overlayContainer) return;

    // Outer container
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'visual-scholar-overlay-container';
    overlayContainer.style.opacity = '0';
    
    // Dimming panels (top, bottom, left, right)
    // Using 4 separate elements around the selection allows a clear viewport cutout
    // while blurring and darkening the remainder of the page.
    const panelNames = ['top', 'bottom', 'left', 'right'];
    panelNames.forEach(name => {
      const panel = document.createElement('div');
      panel.className = `vs-panel vs-panel-${name}`;
      overlayContainer.appendChild(panel);
      panels[name] = panel;
    });

    // Selection box outline
    selectionBox = document.createElement('div');
    selectionBox.className = 'vs-selection-box';
    overlayContainer.appendChild(selectionBox);

    // Floating toolbar
    toolbar = document.createElement('div');
    toolbar.className = 'vs-toolbar';
    toolbar.style.display = 'none';
    
    toolbar.innerHTML = `
      <div class="vs-toolbar-content">
        <span class="vs-dims">0 x 0 px</span>
        <div class="vs-divider"></div>
        <button class="vs-btn vs-btn-cancel" title="Cancel (Esc)">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          <span>Cancel</span>
        </button>
        <button class="vs-btn vs-btn-search" title="Search Selection (Enter)">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <span>Search</span>
        </button>
      </div>
      <div class="vs-toolbar-loader" style="display: none;">
        <div class="vs-spinner"></div>
        <span class="vs-loader-text">Uploading and searching...</span>
      </div>
    `;
    
    overlayContainer.appendChild(toolbar);
    document.body.appendChild(overlayContainer);

    // Initial positioning: entire screen is dimmed
    resetPanels();

    // Attach Event Listeners
    overlayContainer.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    
    // Toolbar button actions
    toolbar.querySelector('.vs-btn-cancel').addEventListener('click', cancelCapture);
    toolbar.querySelector('.vs-btn-search').addEventListener('click', startSearch);

    // Smooth entry fade
    requestAnimationFrame(() => {
      overlayContainer.style.opacity = '1';
    });
  }

  function resetPanels() {
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    
    // Dim the entire screen
    panels.top.style.left = '0px';
    panels.top.style.top = '0px';
    panels.top.style.width = `${vW}px`;
    panels.top.style.height = `${vH}px`;
    
    panels.bottom.style.width = '0px';
    panels.bottom.style.height = '0px';
    panels.left.style.width = '0px';
    panels.left.style.height = '0px';
    panels.right.style.width = '0px';
    panels.right.style.height = '0px';

    selectionBox.style.display = 'none';
    toolbar.style.display = 'none';
    selectionActive = false;
  }

  function updateOverlayLayout(x, y, w, h) {
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const x2 = x + w;
    const y2 = y + h;

    // Update 4 overlay panels around the selection box
    // Top Panel: Full width, extends from top to box top
    panels.top.style.left = '0px';
    panels.top.style.top = '0px';
    panels.top.style.width = `${vW}px`;
    panels.top.style.height = `${y}px`;

    // Bottom Panel: Full width, extends from box bottom to viewport bottom
    panels.bottom.style.left = '0px';
    panels.bottom.style.top = `${y2}px`;
    panels.bottom.style.width = `${vW}px`;
    panels.bottom.style.height = `${Math.max(0, vH - y2)}px`;

    // Left Panel: Extends from box top to box bottom, left edge to box left
    panels.left.style.left = '0px';
    panels.left.style.top = `${y}px`;
    panels.left.style.width = `${x}px`;
    panels.left.style.height = `${h}px`;

    // Right Panel: Extends from box top to box bottom, box right to viewport right
    panels.right.style.left = `${x2}px`;
    panels.right.style.top = `${y}px`;
    panels.right.style.width = `${Math.max(0, vW - x2)}px`;
    panels.right.style.height = `${h}px`;

    // Update selection box boundaries
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = `${w}px`;
    selectionBox.style.height = `${h}px`;
    selectionBox.style.display = 'block';

    // Update dimension display text
    const dimsBadge = toolbar.querySelector('.vs-dims');
    if (dimsBadge) {
      dimsBadge.textContent = `${w} x ${h} px`;
    }
  }

  function positionToolbar() {
    const toolbarWidth = toolbar.offsetWidth || 240;
    const toolbarHeight = toolbar.offsetHeight || 44;
    
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    const x2 = x + w;
    const y2 = y + h;
    
    // Default toolbar position: below selection box, aligned to the right edge
    let top = y2 + 12;
    let left = x2 - toolbarWidth;
    
    // Boundary conditions
    // 1. If too close to the bottom of the screen, float inside the selection box (bottom-right)
    if (top + toolbarHeight > vH) {
      top = y2 - toolbarHeight - 12;
    }
    
    // 2. If selection is very tall and reaches the top or is too narrow
    if (top < 0) {
      top = y + 12;
    }
    
    // 3. Align to left edge if box is too far left
    if (left < 0) {
      left = x;
    }
    
    // 4. Stay within right screen border
    if (left + toolbarWidth > vW) {
      left = vW - toolbarWidth - 12;
    }
    
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.display = 'flex';
  }

  // Mouse Handlers
  function onMouseDown(e) {
    // Left click only, ignore clicks directly on the toolbar buttons
    if (e.button !== 0 || e.target.closest('.vs-toolbar')) return;

    isSelecting = true;
    selectionActive = false;
    
    startX = e.clientX;
    startY = e.clientY;
    currentX = e.clientX;
    currentY = e.clientY;

    toolbar.style.display = 'none';
    selectionBox.style.display = 'none';
    selectionBox.classList.remove('vs-pulsing');
    
    resetPanels();
  }

  function onMouseMove(e) {
    if (!isSelecting) return;

    currentX = e.clientX;
    currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    if (w > 5 && h > 5) {
      updateOverlayLayout(x, y, w, h);
    }
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    // Minimum selection size threshold to avoid single clicks triggering search
    if (w >= 10 && h >= 10) {
      selectionActive = true;
      positionToolbar();
    } else {
      resetPanels();
    }
  }

  // Key Handler
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cancelCapture();
    } else if (e.key === 'Enter' && selectionActive) {
      startSearch();
    }
  }

  function cancelCapture() {
    // Fade out overlay container
    if (overlayContainer) {
      overlayContainer.style.opacity = '0';
      setTimeout(destroyOverlay, 200);
    }
  }

  function destroyOverlay() {
    if (overlayContainer) {
      overlayContainer.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      
      overlayContainer.remove();
      overlayContainer = null;
      selectionBox = null;
      toolbar = null;
      panels = {};
      isSelecting = false;
      selectionActive = false;
    }
  }

  // Crop & Send Search Function
  function startSearch() {
    if (!selectionActive) return;
    
    // Put UI into loading state
    const toolbarContent = toolbar.querySelector('.vs-toolbar-content');
    const toolbarLoader = toolbar.querySelector('.vs-toolbar-loader');
    
    toolbarContent.style.display = 'none';
    toolbarLoader.style.display = 'flex';
    
    selectionBox.classList.add('vs-pulsing');
    overlayContainer.style.cursor = 'wait';

    const rect = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      w: Math.abs(currentX - startX),
      h: Math.abs(currentY - startY)
    };

    // Request full visible tab capture from service worker
    chrome.runtime.sendMessage({ action: "capture-tab" }, function (response) {
      if (response && response.error) {
        handleError("Failed to capture window: " + response.error);
        return;
      }
      
      if (!response || !response.dataUrl) {
        handleError("Failed to capture tab screenshot.");
        return;
      }

      // Crop captured visible viewport data URL
      cropImage(response.dataUrl, rect)
        .then(({ croppedDataUrl, thumbnailDataUrl }) => {
          // Send cropped and thumbnail versions to service worker for upload & search
          chrome.runtime.sendMessage({
            action: "process-cropped-image",
            croppedDataUrl: croppedDataUrl,
            thumbnailDataUrl: thumbnailDataUrl
          }, function (searchResponse) {
            if (searchResponse && searchResponse.success) {
              // Successfully started search! Close overlay
              cancelCapture();
            } else {
              handleError(searchResponse?.error || "Error uploading or launching search.");
            }
          });
        })
        .catch(err => {
          handleError("Crop failed: " + err.message);
        });
    });
  }

  // Load viewport screenshot image, crop using canvas, resize to thumbnail
  function cropImage(dataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const dpr = window.devicePixelRatio || 1;
          
          // 1. Create crop canvas
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = rect.w * dpr;
          cropCanvas.height = rect.h * dpr;
          const cropCtx = cropCanvas.getContext('2d');
          
          cropCtx.drawImage(
            img,
            rect.x * dpr,
            rect.y * dpr,
            rect.w * dpr,
            rect.h * dpr,
            0,
            0,
            rect.w * dpr,
            rect.h * dpr
          );
          
          const croppedDataUrl = cropCanvas.toDataURL('image/png');
          
          // 2. Create small thumbnail for history settings (limits storage size)
          const thumbCanvas = document.createElement('canvas');
          const maxThumbW = 120;
          const thumbScale = Math.min(maxThumbW / (rect.w * dpr), 1);
          
          thumbCanvas.width = rect.w * dpr * thumbScale;
          thumbCanvas.height = rect.h * dpr * thumbScale;
          
          const thumbCtx = thumbCanvas.getContext('2d');
          thumbCtx.drawImage(
            cropCanvas,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height,
            0,
            0,
            thumbCanvas.width,
            thumbCanvas.height
          );
          
          // Use JPEG 0.8 to keep thumbnail payloads small (saves space in chrome.storage.local)
          const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);
          
          resolve({ croppedDataUrl, thumbnailDataUrl });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(new Error("Failed to load capture source: " + err.message));
      img.src = dataUrl;
    });
  }

  function handleError(message) {
    console.error("Visual Scholar Error:", message);
    
    // Reset loader state and display error text
    const toolbarContent = toolbar.querySelector('.vs-toolbar-content');
    const toolbarLoader = toolbar.querySelector('.vs-toolbar-loader');
    
    toolbarLoader.style.display = 'none';
    toolbarContent.style.display = 'flex';
    
    selectionBox.classList.remove('vs-pulsing');
    overlayContainer.style.cursor = 'crosshair';

    // Show error shake effect
    toolbar.classList.add('vs-shake');
    setTimeout(() => {
      toolbar.classList.remove('vs-shake');
    }, 500);

    // Temporarily overlay error message in dimensions text
    const dimsBadge = toolbar.querySelector('.vs-dims');
    const originalText = dimsBadge.textContent;
    dimsBadge.textContent = "Error! Retry";
    dimsBadge.style.color = '#ef4444'; // Red

    setTimeout(() => {
      dimsBadge.textContent = originalText;
      dimsBadge.style.color = '';
    }, 3000);
  }

  // Custom split view panel logic (Left / Right / Top / Bottom resizable drawer)
  let splitContainer = null;
  let splitIframe = null;
  let isResizingSplit = false;
  let currentSplitPos = 'right';

  function showSplitPanel(searchUrl, engine) {
    // If it already exists, remove it first to do a fresh load
    if (splitContainer) {
      splitContainer.remove();
      splitContainer = null;
    }

    // Create container
    splitContainer = document.createElement('div');
    splitContainer.id = 'vs-split-container';
    splitContainer.className = `vs-split-container vs-split-${currentSplitPos}`;

    // Construct inside HTML
    splitContainer.innerHTML = `
      <div class="vs-split-header">
        <div class="vs-split-brand">
          <img src="${chrome.runtime.getURL('icons/icon16.png')}" class="vs-split-logo" alt="Logo">
          <span>Visual Scholar Search</span>
        </div>
        <div class="vs-split-controls">
          <div class="vs-split-pills">
            <button class="vs-pill-btn" data-pos="left" title="Split Left">L</button>
            <button class="vs-pill-btn" data-pos="right" title="Split Right">R</button>
            <button class="vs-pill-btn" data-pos="top" title="Split Top">T</button>
            <button class="vs-pill-btn" data-pos="bottom" title="Split Bottom">B</button>
          </div>
          <button class="vs-split-close-btn" title="Close Panel">&times;</button>
        </div>
      </div>
      <div class="vs-split-frame-wrapper">
        <iframe id="vs-split-iframe" name="vs-split-iframe" src="about:blank"></iframe>
      </div>
      <div class="vs-split-handle"></div>
    `;

    document.body.appendChild(splitContainer);

    // Elements
    splitIframe = document.getElementById('vs-split-iframe');
    const closeBtn = splitContainer.querySelector('.vs-split-close-btn');
    const positionButtons = splitContainer.querySelectorAll('.vs-pill-btn');
    const resizeHandle = splitContainer.querySelector('.vs-split-handle');

    // Make current position button active
    positionButtons.forEach(btn => {
      if (btn.getAttribute('data-pos') === currentSplitPos) {
        btn.classList.add('active');
      }
    });

    // Close button trigger
    closeBtn.addEventListener('click', () => {
      splitContainer.remove();
      splitContainer = null;
      splitIframe = null;
    });

    // Position pills triggers
    positionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        positionButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Remove previous position class
        splitContainer.classList.remove(`vs-split-${currentSplitPos}`);
        
        currentSplitPos = btn.getAttribute('data-pos');
        splitContainer.className = `vs-split-container vs-split-${currentSplitPos}`;
        
        // Reset dynamic style dimensions to default
        splitContainer.style.width = '';
        splitContainer.style.height = '';
      });
    });

    // Drag to Resize events
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizingSplit = true;
      splitContainer.classList.add('vs-dragging');
      e.preventDefault();
      // Inject overlay shield to prevent iframe from capturing mouse pointer movements during drag
      const shield = document.createElement('div');
      shield.id = 'vs-split-shield';
      shield.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:999999;';
      splitContainer.appendChild(shield);
    });

    window.addEventListener('mousemove', onSplitResize);
    window.addEventListener('mouseup', onSplitResizeEnd);

    // Trigger loading
    if (searchUrl) {
      // Bing / TinEye: Load direct URL
      splitIframe.src = searchUrl;
    } else {
      // Google Lens / Yandex: Load local search.html page which triggers form POST
      splitIframe.src = chrome.runtime.getURL('search.html');
    }
  }

  function onSplitResize(e) {
    if (!isResizingSplit || !splitContainer) return;
    
    const vW = window.innerWidth;
    const vH = window.innerHeight;

    if (currentSplitPos === 'right') {
      const width = vW - e.clientX;
      splitContainer.style.width = `${Math.max(260, Math.min(vW - 60, width))}px`;
    } else if (currentSplitPos === 'left') {
      const width = e.clientX;
      splitContainer.style.width = `${Math.max(260, Math.min(vW - 60, width))}px`;
    } else if (currentSplitPos === 'bottom') {
      const height = vH - e.clientY;
      splitContainer.style.height = `${Math.max(160, Math.min(vH - 60, height))}px`;
    } else if (currentSplitPos === 'top') {
      const height = e.clientY;
      splitContainer.style.height = `${Math.max(160, Math.min(vH - 60, height))}px`;
    }
  }

  function onSplitResizeEnd() {
    if (isResizingSplit && splitContainer) {
      isResizingSplit = false;
      splitContainer.classList.remove('vs-dragging');
      const shield = document.getElementById('vs-split-shield');
      if (shield) shield.remove();
    }
  }

  // --- ELEMENT COPIER PICKER LOGIC ---
  let isPickerActive = false;
  let hoveredPickElement = null;

  function startCopyPicker() {
    if (isPickerActive) return;
    isPickerActive = true;

    // Highlight body to indicate inspector is active
    document.body.classList.add('vs-picker-active');

    // Add listeners
    document.addEventListener('mousemove', onPickerMouseMove, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKeyDown, true);

    showToast("Copy Mode Active! Click any element to copy. Esc to cancel.");
  }

  function stopCopyPicker() {
    if (!isPickerActive) return;
    isPickerActive = false;

    document.body.classList.remove('vs-picker-active');

    // Clear highlights
    if (hoveredPickElement) {
      hoveredPickElement.classList.remove('vs-hover-picker');
      hoveredPickElement = null;
    }

    // Remove listeners
    document.removeEventListener('mousemove', onPickerMouseMove, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKeyDown, true);
  }

  function onPickerMouseMove(e) {
    if (!isPickerActive) return;
    const target = e.target;
    
    // Ignore overlay, toast, or extension containers
    if (target.id === 'vs-split-container' || target.closest('#vs-split-container') ||
        target.id === 'vs-toast-container' || target.closest('#vs-toast-container')) {
      if (hoveredPickElement) {
        hoveredPickElement.classList.remove('vs-hover-picker');
        hoveredPickElement = null;
      }
      return;
    }

    if (hoveredPickElement !== target) {
      if (hoveredPickElement) {
        hoveredPickElement.classList.remove('vs-hover-picker');
      }
      hoveredPickElement = target;
      hoveredPickElement.classList.add('vs-hover-picker');
    }
  }

  function onPickerClick(e) {
    if (!isPickerActive) return;
    e.preventDefault();
    e.stopPropagation();

    if (!hoveredPickElement) {
      stopCopyPicker();
      return;
    }

    const targetEl = hoveredPickElement;
    stopCopyPicker();

    // Check copy format preference
    chrome.storage.local.get(['copyFormat'], (result) => {
      const format = result.copyFormat || 'text';
      let contentToCopy = '';

      if (format === 'html') {
        contentToCopy = targetEl.outerHTML;
      } else {
        contentToCopy = targetEl.innerText || targetEl.textContent || '';
      }

      navigator.clipboard.writeText(contentToCopy)
        .then(() => {
          showToast(`Copied element ${format === 'html' ? 'HTML' : 'text'} successfully!`);
        })
        .catch(err => {
          console.error("Visual Scholar: Failed to copy text", err);
          showToast("Failed to copy element content.");
        });
    });
  }

  function onPickerKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopCopyPicker();
      showToast("Copy mode cancelled.");
    }
  }

  // Toast Notification Generator
  function showToast(message) {
    // Remove existing toast if visible
    const existing = document.getElementById('vs-toast-container');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'vs-toast-container';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" style="color:#10b981;flex-shrink:0;">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <span style="font-family: inherit; font-size: 13px; font-weight: 600; color: #f8fafc;">${message}</span>
    `;

    document.body.appendChild(toast);

    // Fade out and remove after 2.5s
    setTimeout(() => {
      toast.classList.add('vs-toast-fadeout');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2500);
  }

  function applyForcedDarkMode(enabled) {
    let style = document.getElementById('vs-forced-dark-style');
    if (enabled) {
      if (!style) {
        style = document.createElement('style');
        style.id = 'vs-forced-dark-style';
        style.textContent = `
          html {
            filter: invert(1) hue-rotate(180deg) !important;
            background-color: #000000 !important;
          }
          img, video, canvas, iframe, [style*="background-image"],
          #vs-split-container, #vs-toast-container, .vs-overlay-container,
          .vs-exclude-dark {
            filter: invert(1) hue-rotate(180deg) !important;
          }
        `;
        document.documentElement.appendChild(style);
      }
    } else {
      if (style) {
        style.remove();
      }
    }
  }

  // Listen for message from background page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start-capture") {
      createOverlay();
      sendResponse({ success: true });
    } else if (request.action === "open-custom-split") {
      showSplitPanel(request.url, request.engine);
      sendResponse({ success: true });
    } else if (request.action === "start-copy-picker") {
      startCopyPicker();
      sendResponse({ success: true });
    } else if (request.action === "set-dark-mode") {
      applyForcedDarkMode(request.enabled);
      sendResponse({ success: true });
    }
  });

})();
