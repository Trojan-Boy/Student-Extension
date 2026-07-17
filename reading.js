// reading.js - Controls the visual scholar split reading page

document.addEventListener('DOMContentLoaded', () => {
  const cropPreview = document.getElementById('crop-preview');
  const metaEngine = document.getElementById('meta-engine');
  const metaStatus = document.getElementById('meta-status');
  const progressBar = document.getElementById('progress-bar');
  const resultsFrame = document.getElementById('results-frame');
  const btnDownloadImg = document.getElementById('btn-download-img');
  const btnNewTab = document.getElementById('btn-new-tab');
  const form = document.getElementById('upload-form');

  let currentSearchUrl = '';
  let screenshotDataUrl = '';

  // 1. Initial Load & Search Trigger
  function performSearch() {
    progressBar.classList.add('active');
    metaStatus.textContent = 'Preparing image...';
    resultsFrame.src = 'about:blank';
    
    // Clear previous form fields
    form.innerHTML = '';

    chrome.storage.local.get(['searchEngine', 'sidePanelUrl'], (result) => {
      const engine = result.searchEngine || 'google-lens';
      const engineNames = {
        'google-lens': 'Google Lens',
        'yandex': 'Yandex Images',
        'bing': 'Bing Visual Search',
        'tineye': 'TinEye'
      };
      
      metaEngine.textContent = engineNames[engine] || 'Google Lens';

      // A. Google Lens or Yandex: Use dynamic local form POST
      if (engine === 'google-lens' || engine === 'yandex') {
        // Retrieve crop image from background worker memory
        chrome.runtime.sendMessage({ action: "get-temp-image" }, (response) => {
          screenshotDataUrl = response?.croppedDataUrl;
          
          if (!screenshotDataUrl) {
            metaStatus.textContent = 'Error: Image expired or not found.';
            progressBar.classList.remove('active');
            return;
          }

          // Show cropped preview image
          cropPreview.src = screenshotDataUrl;

          // Helper: Convert data URL to Blob
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
            const blob = dataURLtoBlob(screenshotDataUrl);
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });
            
            // Programmatically assign files to input element
            const container = new DataTransfer();
            container.items.add(file);

            if (engine === 'yandex') {
              metaStatus.textContent = 'Posting form to Yandex...';
              currentSearchUrl = 'https://yandex.com/images/search?rpt=imageview';
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
              metaStatus.textContent = 'Posting form to Google Lens...';
              currentSearchUrl = 'https://lens.google.com';
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
              metaStatus.textContent = 'Active (Ready)';
              progressBar.classList.remove('active');
            }, 300);

          } catch (err) {
            console.error(err);
            metaStatus.textContent = 'Error building form.';
            progressBar.classList.remove('active');
          }
        });
      } else {
        // B. Bing or TinEye: Load URL directly in iframe
        metaStatus.textContent = 'Loading URL...';
        
        // Load background-generated search link
        if (result.sidePanelUrl) {
          currentSearchUrl = result.sidePanelUrl;
          resultsFrame.src = result.sidePanelUrl;
          metaStatus.textContent = 'Active (Ready)';
        } else {
          metaStatus.textContent = 'Error: No URL provided.';
        }
        
        // Grab thumbnail for preview image card
        chrome.storage.local.get(['searchHistory'], (historyResult) => {
          const history = historyResult.searchHistory || [];
          if (history.length > 0 && history[0].thumbnail) {
            screenshotDataUrl = history[0].thumbnail;
            cropPreview.src = history[0].thumbnail;
          }
        });
        
        progressBar.classList.remove('active');
      }
    });
  }

  // Load immediately
  performSearch();

  // 2. Action: Save screenshot locally
  btnDownloadImg.addEventListener('click', () => {
    if (!screenshotDataUrl) return;
    
    // Create direct download links
    const link = document.createElement('a');
    link.href = screenshotDataUrl;
    link.download = `VisualScholar_Capture_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // 3. Action: Open inside full browser tab
  btnNewTab.addEventListener('click', () => {
    if (currentSearchUrl) {
      // If we are showing Yandex/Lens, opening full tab requires posting the form to a new tab
      // To simplify this, we check if we can submit form targeting a new tab!
      const engine = metaEngine.textContent;
      if (engine.includes('Lens') || engine.includes('Yandex')) {
        // Submit the form to a new window target instead of the iframe!
        form.target = '_blank';
        form.submit();
        // Reset target back to iframe
        form.target = 'results-frame';
      } else {
        // Direct link load (Bing/TinEye)
        chrome.tabs.create({ url: currentSearchUrl });
      }
    }
  });
});
