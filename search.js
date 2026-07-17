// search.js - Local dynamic form uploader

document.addEventListener('DOMContentLoaded', () => {
  // Request cropped image dynamically from in-memory service worker transit
  chrome.runtime.sendMessage({ action: "get-temp-image" }, (response) => {
    const dataUrl = response?.croppedDataUrl;
    
    if (!dataUrl) {
      document.getElementById('status-text').textContent = 'Error: No image source found or link expired.';
      return;
    }

    // Read configured search engine to submit properly
    chrome.storage.local.get(['searchEngine'], (result) => {
      const engine = result.searchEngine || 'google-lens';
      const statusText = document.getElementById('status-text');
      const form = document.getElementById('upload-form');
      
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
        
        // Inject file into file input using HTML5 DataTransfer API (programmatic file assignment)
        const container = new DataTransfer();
        container.items.add(file);

        if (engine === 'yandex') {
          statusText.textContent = 'Searching image on Yandex...';
          form.action = 'https://yandex.com/images/search';
          
          // RPT parameter (tells Yandex to open ImageView search)
          const rptInput = document.createElement('input');
          rptInput.type = 'hidden';
          rptInput.name = 'rpt';
          rptInput.value = 'imageview';
          form.appendChild(rptInput);
          
          // File input
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.name = 'upfile';
          fileInput.files = container.files;
          form.appendChild(fileInput);
          
        } else {
          // Default: Google Lens
          statusText.textContent = 'Searching image on Google Lens...';
          form.action = 'https://lens.google.com/v3/upload';
          
          // File input
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.name = 'encoded_image';
          fileInput.files = container.files;
          form.appendChild(fileInput);
        }
        
        // Wait 300ms to let transition animation render, then submit the form POST navigation
        setTimeout(() => {
          form.submit();
        }, 300);
        
      } catch (err) {
        console.error(err);
        statusText.textContent = 'Failed to prepare image search: ' + err.message;
      }
    });
  });
});
