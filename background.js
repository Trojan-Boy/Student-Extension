// Visual Scholar - Background Service Worker (Manifest V3)

const isAllowedUrl = (url) => {
  if (!url) return false;
  return !url.startsWith('chrome://') && 
         !url.startsWith('chrome-extension://') && 
         !url.startsWith('edge://') && 
         !url.startsWith('about:') && 
         !url.startsWith('https://chrome.google.com/webstore');
};

// Global memory transit variable for full-res screenshot (prevents browser disk write)
let tempCroppedImage = null;

function captureActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];
    if (!activeTab || !isAllowedUrl(activeTab.url)) {
      console.warn("Visual Scholar cannot run on this page.");
      return;
    }
    
    // Check if script is already loaded
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => typeof window.__visualScholarLoaded !== 'undefined'
    }).then((results) => {
      const isLoaded = results[0]?.result;
      if (!isLoaded) {
        // Inject CSS first
        chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ["content.css"]
        }).then(() => {
          // Inject JS
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["content.js"]
          }).then(() => {
            // Start the selection overlay
            chrome.tabs.sendMessage(activeTab.id, { action: "start-capture" });
          }).catch(err => console.error("Error executing content JS:", err));
        }).catch(err => console.error("Error inserting content CSS:", err));
      } else {
        // Already loaded, just message to start
        chrome.tabs.sendMessage(activeTab.id, { action: "start-capture" }).catch(err => {
          console.warn("Context invalidated, re-injecting content script...", err);
          injectAndStart(activeTab.id);
        });
      }
    }).catch((err) => {
      console.error("Script injection check failed:", err);
      // Fallback: try injecting directly
      injectAndStart(activeTab.id);
    });
  });
}

function injectAndStart(tabId) {
  chrome.scripting.insertCSS({
    target: { tabId: tabId },
    files: ["content.css"]
  }).then(() => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    }).then(() => {
      chrome.tabs.sendMessage(tabId, { action: "start-capture" });
    }).catch(err => console.error("Error in re-injection JS:", err));
  }).catch(err => console.error("Error in re-injection CSS:", err));
}

// Listen for the command shortcut (Alt+I)
chrome.commands.onCommand.addListener((command) => {
  if (command === "take-screenshot") {
    captureActiveTab();
  }
});

// Listen for extension action click (icon click)
chrome.action.onClicked.addListener((tab) => {
  captureActiveTab();
});

// Helper function: Convert dataURL to Blob in service worker
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

// Upload cropped image to tmpfiles.org and scrape the direct download URL containing the hotlink token
function uploadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const blob = dataURLtoBlob(dataUrl);
      const formData = new FormData();
      formData.append('file', blob, 'screenshot.png');

      fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData
      })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Upload failed with status ${res.status}`);
        }
        return res.json();
      })
      .then(json => {
        if (json.status === 'success' && json.data && json.data.url) {
          const previewUrl = json.data.url;
          
          // Scrape preview HTML page to find direct image link (bypass anti-hotlinking tokens)
          fetch(previewUrl)
            .then(res => {
              if (!res.ok) {
                throw new Error("Failed to load image preview page.");
              }
              return res.text();
            })
            .then(html => {
              const match = html.match(/id="img_preview"\s+src="([^"]+)"/);
              if (match && match[1]) {
                resolve(match[1]); // Real raw link, e.g. https://tmpfiles.org/dl/{token}/{id}/{name}
              } else {
                // Fallback: replace domains if scraping fails
                const fallbackUrl = previewUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                resolve(fallbackUrl);
              }
            })
            .catch(err => {
              console.warn("Scraping failed, falling back to URL replace", err);
              const fallbackUrl = previewUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
              resolve(fallbackUrl);
            });
        } else {
          reject(new Error("Invalid API response format from tmpfiles.org"));
        }
      })
      .catch(err => {
        console.error("Network or API error uploading screenshot:", err);
        reject(err);
      });
    } catch (err) {
      console.error("Blob conversion error:", err);
      reject(err);
    }
  });
}

// Save search event to storage history
function saveToHistory(thumbnailUrl, engine, searchUrl) {
  chrome.storage.local.get(['searchHistory'], function(result) {
    let history = result.searchHistory || [];
    
    // Clean engine name for display
    const engineMap = {
      'google-lens': 'Google Lens',
      'bing': 'Bing Visual',
      'yandex': 'Yandex',
      'tineye': 'TinEye'
    };
    const engineName = engineMap[engine] || 'Google Lens';

    const newItem = {
      id: Date.now().toString(),
      thumbnail: thumbnailUrl, // Optimized tiny thumbnail (5-10 KB), storage safe
      engine: engineName,
      url: searchUrl,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
    };
    
    // Add to top, keep max 5 items
    history.unshift(newItem);
    if (history.length > 5) {
      history = history.slice(0, 5);
    }
    
    chrome.storage.local.set({ searchHistory: history });
  });
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "trigger-capture") {
    captureActiveTab();
    sendResponse({ success: true });
    return false;
  }

  if (request.action === "trigger-copy-picker") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && isAllowedUrl(activeTab.url)) {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => typeof window.__visualScholarLoaded !== 'undefined'
        }).then((results) => {
          const isLoaded = results[0]?.result;
          if (!isLoaded) {
            chrome.scripting.insertCSS({
              target: { tabId: activeTab.id },
              files: ["content.css"]
            }).then(() => {
              chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ["content.js"]
              }).then(() => {
                chrome.tabs.sendMessage(activeTab.id, { action: "start-copy-picker" });
              }).catch(err => console.error("Error executing picker JS:", err));
            }).catch(err => console.error("Error inserting picker CSS:", err));
          } else {
            chrome.tabs.sendMessage(activeTab.id, { action: "start-copy-picker" }).catch(err => {
              console.warn("Context invalidated, re-injecting content script...", err);
              chrome.scripting.insertCSS({
                target: { tabId: activeTab.id },
                files: ["content.css"]
              }).then(() => {
                chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ["content.js"]
                }).then(() => {
                  chrome.tabs.sendMessage(activeTab.id, { action: "start-copy-picker" });
                });
              });
            });
          }
        }).catch((err) => {
          console.error("Injection check failed:", err);
          chrome.scripting.insertCSS({
            target: { tabId: activeTab.id },
            files: ["content.css"]
          }).then(() => {
            chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["content.js"]
            }).then(() => {
              chrome.tabs.sendMessage(activeTab.id, { action: "start-copy-picker" });
            });
          });
        });
      }
    });
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === "capture-tab") {
    // Captures the visible tab of the active window
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, function (dataUrl) {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    return true; // Keep communication port open asynchronously
  }
  
  if (request.action === "process-cropped-image") {
    chrome.storage.local.get(['searchEngine', 'displayMode'], function(result) {
      const engine = result.searchEngine || 'google-lens';
      const mode = result.displayMode || 'new-tab';
      
      // I. GOOGLE LENS / YANDEX (Uses Local Form POST)
      if (engine === 'google-lens' || engine === 'yandex') {
        tempCroppedImage = request.croppedDataUrl;
        
        let dummySearchUrl = '';
        if (engine === 'yandex') {
          dummySearchUrl = 'https://yandex.com/images/search?rpt=imageview';
        } else {
          dummySearchUrl = 'https://lens.google.com';
        }
        
        // Save tiny optimized thumbnail (only ~5KB) for history
        saveToHistory(request.thumbnailDataUrl, engine, dummySearchUrl);

        if (mode === 'side-panel') {
          // Send message to the tab to open custom split view directly inside page DOM
          chrome.tabs.sendMessage(sender.tab.id, { 
            action: "open-custom-split", 
            engine: engine 
          });
        } else if (mode === 'reading-pane') {
          chrome.tabs.create({ url: chrome.runtime.getURL('reading.html') });
        } else {
          // Default: new-tab
          chrome.tabs.create({ url: chrome.runtime.getURL('search.html') });
        }
        
        sendResponse({ success: true });
      } 
      // II. BING / TINEYE (Requires public URL upload)
      else {
        uploadImage(request.croppedDataUrl)
          .then(directUrl => {
            let searchUrl = '';
            if (engine === 'tineye') {
              searchUrl = `https://tineye.com/search?url=${encodeURIComponent(directUrl)}`;
            } else {
              // bing
              searchUrl = `https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${encodeURIComponent(directUrl)}`;
            }
            
            // Save tiny optimized thumbnail (only ~5KB) for history
            saveToHistory(request.thumbnailDataUrl, engine, searchUrl);

            if (mode === 'side-panel') {
              // Send message to the tab to open custom split view directly inside page DOM
              chrome.tabs.sendMessage(sender.tab.id, {
                action: "open-custom-split",
                url: searchUrl,
                engine: engine
              });
            } else if (mode === 'reading-pane') {
              chrome.storage.local.set({ sidePanelUrl: searchUrl }, () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('reading.html') });
              });
            } else {
              // Default: new-tab
              chrome.tabs.create({ url: searchUrl });
            }
            
            sendResponse({ success: true });
          })
          .catch(err => {
            sendResponse({ error: err.message || "Failed to upload image." });
          });
      }
    });
      
    return true; // Asynchronous response
  }
  
  if (request.action === "get-temp-image") {
    // Deliver the full-res cropped image and IMMEDIATELY release from service worker memory
    sendResponse({ croppedDataUrl: tempCroppedImage });
    tempCroppedImage = null; // Mark for garbage collection
    return false;
  }

  if (request.action === "launch-workspace") {
    const urls = request.urls;
    const name = request.name;
    const color = request.color;
    
    const tabIds = [];
    const createPromises = urls.map(url => {
      return new Promise((resolve) => {
        chrome.tabs.create({ url: url, active: false }, (tab) => {
          tabIds.push(tab.id);
          resolve();
        });
      });
    });
    
    Promise.all(createPromises).then(() => {
      chrome.tabs.group({ tabIds: tabIds }, (groupId) => {
        chrome.tabGroups.update(groupId, { title: name, color: color });
      });
    });
    
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "toggle-dark-mode") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: "set-dark-mode", enabled: request.enabled }).catch(() => {
          // ignore tabs where content script isn't active
        });
      });
    });
    sendResponse({ success: true });
    return false;
  }
});
