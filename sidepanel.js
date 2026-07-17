// sidepanel.js - Handles split-view search frame loading

document.addEventListener('DOMContentLoaded', () => {
  const btnTogglePreview = document.getElementById('btn-toggle-preview');
  const previewBox = document.getElementById('preview-box');
  const previewImg = document.getElementById('preview-img');
  const previewEngineText = document.getElementById('preview-engine-text');
  const previewStatusText = document.getElementById('preview-status-text');
  const progressBar = document.getElementById('progress-bar');
  const searchFrame = document.getElementById('search-frame');
  const form = document.getElementById('upload-form');

  // Toggle preview section visibility
  btnTogglePreview.addEventListener('click', () => {
    const isCollapsed = previewBox.classList.toggle('collapsed');
    btnTogglePreview.textContent = isCollapsed ? 'Show Crop' : 'Hide Crop';
  });

  // Main search action
  function performSearch() {
    progressBar.classList.add('active');
    previewStatusText.textContent = 'Preparing image...';
    searchFrame.src = 'about:blank';

    // Clear any previous form elements
    form.innerHTML = '';

    chrome.storage.local.get(['searchEngine', 'sidePanelUrl'], (result) => {
      const engine = result.searchEngine || 'google-lens';
      const engineNames = {
        'google-lens': 'Google Lens',
        'yandex': 'Yandex Images',
        'bing': 'Bing Visual Search',
        'tineye': 'TinEye'
      };
      
      previewEngineText.textContent = engineNames[engine] || 'Google Lens';

      // 1. Google Lens or Yandex: Use dynamic local form POST targeting the iframe
      if (engine === 'google-lens' || engine === 'yandex') {
        // Request the full-resolution screenshot from the service worker's transit memory
        chrome.runtime.sendMessage({ action: "get-temp-image" }, (response) => {
          const dataUrl = response?.croppedDataUrl;
          
          if (!dataUrl) {
            previewStatusText.textContent = 'Error: No image source found.';
            progressBar.classList.remove('active');
            return;
          }

          // Show preview thumbnail
          previewImg.src = dataUrl;

          // Helper: Convert base64 data URL to Blob
          function dataURLtoBlob(dataurl) {
            const arr = dataurl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
          }

          try {
            const blob = dataURLtoBlob(dataUrl);
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });
            
            // Programmatically assign file using HTML5 DataTransfer
            const container = new DataTransfer();
            container.items.add(file);

            if (engine === 'yandex') {
              previewStatusText.textContent = 'Submitting form to Yandex...';
              form.action = 'https://yandex.com/images/search';
              
              const rptInput = document.createElement('input');
              rptInput.type = 'hidden';
              rptInput.name = 'rpt';
              rptInput.value = 'imageview';
              form.appendChild(rptInput);
              
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.name = 'upfile';
              fileInput.files = container.files;
              form.appendChild(fileInput);
            } else {
              previewStatusText.textContent = 'Submitting form to Google Lens...';
              form.action = 'https://lens.google.com/v3/upload';
              
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.name = 'encoded_image';
              fileInput.files = container.files;
              form.appendChild(fileInput);
            }

            // Submit the form into the iframe target
            setTimeout(() => {
              form.submit();
              previewStatusText.textContent = 'Results loading below...';
              progressBar.classList.remove('active');
            }, 300);

          } catch (err) {
            console.error("Form submit failure in side panel:", err);
            previewStatusText.textContent = 'Preparation failed.';
            progressBar.classList.remove('active');
          }
        });
      } else {
        // 2. Bing or TinEye: Load direct URL inside the iframe
        previewStatusText.textContent = 'Loading search page...';
        
        // Grab preview image from storage (if saved as history thumbnail, or fallback)
        chrome.storage.local.get(['searchHistory'], (historyResult) => {
          const history = historyResult.searchHistory || [];
          if (history.length > 0 && history[0].thumbnail) {
            previewImg.src = history[0].thumbnail;
          }
        });

        if (result.sidePanelUrl) {
          searchFrame.src = result.sidePanelUrl;
          previewStatusText.textContent = 'Results loading below...';
        } else {
          previewStatusText.textContent = 'Error: No URL provided.';
        }
        progressBar.classList.remove('active');
      }
    });
  }

  // Trigger search on loading
  performSearch();

  // Listen for refresh messages if the sidepanel is already open during a capture
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "refresh-sidepanel") {
      performSearch();
      sendResponse({ success: true });
    }
  });
});
