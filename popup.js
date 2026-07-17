// Visual Scholar - Dashboard JS

document.addEventListener('DOMContentLoaded', () => {
  const btnSplitView = document.getElementById('btn-split-view');
  const btnNewTab = document.getElementById('btn-new-tab');
  const btnReadingPane = document.getElementById('btn-reading-pane');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnCopyPicker = document.getElementById('btn-copy-picker');
  const btnPdfCanvas = document.getElementById('btn-pdf-canvas');
  const formatPills = document.querySelectorAll('.vs-format-pill');
  
  const historyList = document.getElementById('history-list');
  const emptyState = document.getElementById('empty-state');
  const enginePills = document.querySelectorAll('.vs-engine-pill');
  const btnThemeOff = document.getElementById('btn-theme-off');
  const btnThemeOn = document.getElementById('btn-theme-on');

  // Workspace DOM Elements
  const btnAddWorkspace = document.getElementById('btn-add-workspace');
  const btnAddSite = document.getElementById('btn-add-site');
  const btnManageWorkspaces = document.getElementById('btn-manage-workspaces');
  const btnCloseGroups = document.getElementById('btn-close-groups');
  
  const workspaceList = document.getElementById('workspace-list');
  const workspaceForm = document.getElementById('workspace-form');
  const addSiteForm = document.getElementById('add-site-form');
  const manageForm = document.getElementById('manage-form');
  
  const addSiteLabel = document.getElementById('add-site-label');
  const addSiteWorkspaceGrid = document.getElementById('add-site-workspace-grid');
  const btnAddSiteCancel = document.getElementById('btn-add-site-cancel');

  const manageWsSelect = document.getElementById('manage-ws-select');
  const manageLinksList = document.getElementById('manage-links-list');
  const btnManageClose = document.getElementById('btn-manage-close');

  const activeGroupsSection = document.getElementById('active-groups-section');
  const activeGroupsList = document.getElementById('active-groups-list');

  const wsNameInput = document.getElementById('ws-name');
  const wsLinksInput = document.getElementById('ws-links');
  const colorPills = document.querySelectorAll('.vs-color-pill');
  const btnWsCancel = document.getElementById('btn-ws-cancel');
  const btnWsSave = document.getElementById('btn-ws-save');

  // Active Workspace Color Variable
  let selectedWsColor = 'blue';

  // 1. Initialize settings, load workspaces & load history
  loadSettings();
  loadWorkspaces();
  loadHistory();
  loadActiveTabGroups();

  // 2. Capture Actions Binds
  btnPdfCanvas.addEventListener('click', () => {
    chrome.tabs.create({ url: "https://study-canvas.vercel.app/" });
    window.close();
  });

  btnSplitView.addEventListener('click', () => {
    chrome.storage.local.set({ displayMode: 'side-panel' }, () => {
      triggerCapture();
    });
  });

  // 2.2 Forced Dark Mode Theme Toggles
  btnThemeOff.addEventListener('click', () => {
    btnThemeOff.classList.add('active');
    btnThemeOn.classList.remove('active');
    chrome.storage.local.set({ forcedDarkMode: 'disabled' }, () => {
      chrome.runtime.sendMessage({ action: "toggle-dark-mode", enabled: false });
    });
  });

  btnThemeOn.addEventListener('click', () => {
    btnThemeOn.classList.add('active');
    btnThemeOff.classList.remove('active');
    chrome.storage.local.set({ forcedDarkMode: 'enabled' }, () => {
      chrome.runtime.sendMessage({ action: "toggle-dark-mode", enabled: true });
    });
  });

  btnNewTab.addEventListener('click', () => {
    chrome.storage.local.set({ displayMode: 'new-tab' }, () => {
      triggerCapture();
    });
  });

  btnReadingPane.addEventListener('click', () => {
    chrome.storage.local.set({ displayMode: 'reading-pane' }, () => {
      triggerCapture();
    });
  });

  function triggerCapture() {
    chrome.runtime.sendMessage({ action: "trigger-capture" }, () => {
      window.close(); // Close popup
    });
  }

  // 2.5 Element Picker Actions Binds
  btnCopyPicker.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "trigger-copy-picker" }, () => {
      window.close();
    });
  });

  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const selectedFormat = pill.getAttribute('data-format');
      chrome.storage.local.set({ copyFormat: selectedFormat });
    });
  });

  // 3. Search Engine Selection (Pills Switcher)
  enginePills.forEach(pill => {
    pill.addEventListener('click', () => {
      enginePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const selectedEngine = pill.getAttribute('data-engine');
      chrome.storage.local.set({ searchEngine: selectedEngine });
    });
  });

  // 4. Clear History Action
  btnClearHistory.addEventListener('click', () => {
    chrome.storage.local.set({ searchHistory: [] }, () => {
      loadHistory();
    });
  });

  // 5. Workspaces Creation Actions
  // Toggle form display
  btnAddWorkspace.addEventListener('click', () => {
    const isHidden = workspaceForm.style.display === 'none';
    
    // Hide add site form if open
    addSiteForm.style.display = 'none';
    
    workspaceForm.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      wsNameInput.focus();
    }
  });

  // Toggle add current page form
  btnAddSite.addEventListener('click', () => {
    const isHidden = addSiteForm.style.display === 'none';
    
    // Hide create form if open
    workspaceForm.style.display = 'none';
    
    addSiteForm.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      populateAddSitePanel();
    }
  });

  btnAddSiteCancel.addEventListener('click', () => {
    addSiteForm.style.display = 'none';
  });

  // Toggle manage workspaces form
  btnManageWorkspaces.addEventListener('click', () => {
    const isHidden = manageForm.style.display === 'none';
    
    // Hide other forms
    workspaceForm.style.display = 'none';
    addSiteForm.style.display = 'none';
    
    manageForm.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      populateManageWorkspacesPanel();
    }
  });

  btnManageClose.addEventListener('click', () => {
    manageForm.style.display = 'none';
  });

  btnCloseGroups.addEventListener('click', () => {
    closeAllTabGroups();
  });

  manageWsSelect.addEventListener('change', () => {
    renderManageLinks();
  });

  function populateManageWorkspacesPanel() {
    chrome.storage.local.get(['workspaces'], (result) => {
      const list = result.workspaces || getDefaultWorkspaces();
      manageWsSelect.innerHTML = '';
      
      list.forEach(ws => {
        const opt = document.createElement('option');
        opt.value = ws.id;
        opt.textContent = ws.name;
        manageWsSelect.appendChild(opt);
      });
      
      renderManageLinks();
    });
  }

  function renderManageLinks() {
    const wsId = manageWsSelect.value;
    if (!wsId) {
      manageLinksList.innerHTML = '<div class="vs-manage-empty">No workspaces found.</div>';
      return;
    }

    chrome.storage.local.get(['workspaces'], (result) => {
      const list = result.workspaces || getDefaultWorkspaces();
      const ws = list.find(w => w.id === wsId);
      
      manageLinksList.innerHTML = '';
      
      if (!ws || !ws.urls || ws.urls.length === 0) {
        manageLinksList.innerHTML = '<div class="vs-manage-empty">No links saved in this workspace.</div>';
        return;
      }

      ws.urls.forEach((url, index) => {
        const row = document.createElement('div');
        row.className = 'vs-manage-link-row';
        
        row.innerHTML = `
          <span class="vs-manage-link-url" title="${url}">${url}</span>
          <button class="vs-manage-link-delete-btn" title="Remove link">&times;</button>
        `;
        
        row.querySelector('.vs-manage-link-delete-btn').addEventListener('click', () => {
          removeLinkFromWorkspace(wsId, index);
        });
        
        manageLinksList.appendChild(row);
      });
    });
  }

  function removeLinkFromWorkspace(wsId, linkIndex) {
    chrome.storage.local.get(['workspaces'], (result) => {
      let list = result.workspaces || getDefaultWorkspaces();
      
      list = list.map(ws => {
        if (ws.id === wsId) {
          ws.urls.splice(linkIndex, 1);
        }
        return ws;
      });
      
      chrome.storage.local.set({ workspaces: list }, () => {
        loadWorkspaces(); // Refresh main workspace buttons
        renderManageLinks(); // Refresh current edit view list immediately
      });
    });
  }

  function populateAddSitePanel() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url && isAllowedUrl(activeTab.url)) {
        const title = activeTab.title ? (activeTab.title.length > 25 ? activeTab.title.substring(0, 25) + '...' : activeTab.title) : "This Site";
        addSiteLabel.textContent = `Add "${title}" to:`;
        
        chrome.storage.local.get(['workspaces'], (result) => {
          const list = result.workspaces || getDefaultWorkspaces();
          addSiteWorkspaceGrid.innerHTML = '';
          
          list.forEach(ws => {
            const wsBtn = document.createElement('button');
            wsBtn.className = `vs-add-site-btn vs-ws-${ws.color}`;
            wsBtn.textContent = ws.name;
            
            wsBtn.addEventListener('click', () => {
              addUrlToWorkspace(ws.id, activeTab.url);
              addSiteForm.style.display = 'none';
            });
            
            addSiteWorkspaceGrid.appendChild(wsBtn);
          });
        });
      } else {
        addSiteLabel.textContent = "Cannot add restricted browser pages.";
        addSiteWorkspaceGrid.innerHTML = '';
      }
    });
  }

  function addUrlToWorkspace(wsId, url) {
    chrome.storage.local.get(['workspaces'], (result) => {
      let list = result.workspaces || getDefaultWorkspaces();
      let wsFound = false;
      
      list = list.map(ws => {
        if (ws.id === wsId) {
          wsFound = true;
          if (!ws.urls.includes(url)) {
            ws.urls.push(url);
          }
        }
        return ws;
      });
      
      if (wsFound) {
        chrome.storage.local.set({ workspaces: list }, () => {
          loadWorkspaces();
          showWorkspaceFeedback(wsId, "Added!");
        });
      }
    });
  }

  // Cancel workspace creation
  btnWsCancel.addEventListener('click', () => {
    workspaceForm.style.display = 'none';
    clearWsFormInputs();
  });

  // Select color pill
  colorPills.forEach(pill => {
    pill.addEventListener('click', () => {
      colorPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedWsColor = pill.getAttribute('data-color');
    });
  });

  // Save new workspace
  btnWsSave.addEventListener('click', () => {
    const name = wsNameInput.value.trim();
    const rawLinks = wsLinksInput.value.trim();

    if (!name) {
      alert("Please enter a workspace name.");
      return;
    }

    if (!rawLinks) {
      alert("Please add at least one website link.");
      return;
    }

    // Parse links (split line breaks and format correctly)
    const links = rawLinks.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)
      .map(url => {
        // Enforce protocol prefix for browser tabs
        if (!/^https?:\/\//i.test(url)) {
          return 'https://' + url;
        }
        return url;
      });

    if (links.length === 0) {
      alert("Please enter valid URL links.");
      return;
    }

    // Save workspace to storage list
    chrome.storage.local.get(['workspaces'], (result) => {
      const list = result.workspaces || getDefaultWorkspaces();
      
      const newWs = {
        id: Date.now().toString(),
        name: name,
        urls: links,
        color: selectedWsColor
      };

      list.push(newWs);
      chrome.storage.local.set({ workspaces: list }, () => {
        workspaceForm.style.display = 'none';
        clearWsFormInputs();
        loadWorkspaces();
      });
    });
  });

  function clearWsFormInputs() {
    wsNameInput.value = '';
    wsLinksInput.value = '';
    colorPills.forEach(p => p.classList.remove('active'));
    colorPills[0].classList.add('active'); // Reset to Blue
    selectedWsColor = 'blue';
  }

  // Default workspace templates for students
  function getDefaultWorkspaces() {
    return [
      {
        id: 'default-home',
        name: 'Home',
        urls: ['https://www.google.com', 'https://www.wikipedia.org'],
        color: 'blue'
      },
      {
        id: 'default-study',
        name: 'Study',
        urls: ['https://scholar.google.com', 'https://www.wikipedia.org'],
        color: 'green'
      },
      {
        id: 'default-coding',
        name: 'Coding',
        urls: ['https://github.com', 'https://stackoverflow.com'],
        color: 'purple'
      }
    ];
  }

  const isAllowedUrl = (url) => {
    if (!url) return false;
    return !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') && 
           !url.startsWith('edge://') && 
           !url.startsWith('about:');
  };

  // Load and render workspaces
  function loadWorkspaces() {
    chrome.storage.local.get(['workspaces'], (result) => {
      const list = result.workspaces || getDefaultWorkspaces();
      
      // If workspaces list is not in storage, set the default templates
      if (!result.workspaces) {
        chrome.storage.local.set({ workspaces: list });
      }

      workspaceList.innerHTML = '';

      list.forEach(ws => {
        const wsContainer = document.createElement('div');
        wsContainer.className = 'vs-workspace-btn-container';
        wsContainer.setAttribute('data-id', ws.id);
        
        wsContainer.innerHTML = `
          <button class="vs-workspace-btn vs-ws-${ws.color}" title="Launch Workspace Group">
            <span>${ws.name}</span>
          </button>
          <button class="vs-workspace-btn-delete" title="Delete Workspace">&times;</button>
        `;

        // Launch Workspace Click
        wsContainer.querySelector('.vs-workspace-btn').addEventListener('click', () => {
          chrome.runtime.sendMessage({
            action: "launch-workspace",
            name: ws.name,
            urls: ws.urls,
            color: ws.color
          });
        });

        // Delete Workspace click
        wsContainer.querySelector('.vs-workspace-btn-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteWorkspace(ws.id);
        });

        workspaceList.appendChild(wsContainer);
      });
    });
  }

  function showWorkspaceFeedback(wsId, text) {
    const container = document.querySelector(`[data-id="${wsId}"]`);
    if (!container) return;
    
    const btn = container.querySelector('.vs-workspace-btn');
    const span = btn.querySelector('span');
    const originalText = span.textContent;
    
    const isError = text.includes("Can't");
    btn.style.borderColor = isError ? '#ef4444' : '#22c55e';
    span.textContent = text;
    span.style.color = isError ? '#fca5a5' : '#86efac';
    
    setTimeout(() => {
      btn.style.borderColor = '';
      span.textContent = originalText;
      span.style.color = '';
    }, 1200);
  }

  function deleteWorkspace(wsId) {
    chrome.storage.local.get(['workspaces'], (result) => {
      let list = result.workspaces || getDefaultWorkspaces();
      list = list.filter(ws => ws.id !== wsId);
      chrome.storage.local.set({ workspaces: list }, () => {
        loadWorkspaces();
      });
    });
  }

  // Helper: Retrieve settings
  function loadSettings() {
    chrome.storage.local.get(['searchEngine', 'copyFormat', 'forcedDarkMode'], (result) => {
      const savedEngine = result.searchEngine || 'google-lens';
      enginePills.forEach(pill => {
        if (pill.getAttribute('data-engine') === savedEngine) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });

      const savedFormat = result.copyFormat || 'text';
      formatPills.forEach(pill => {
        if (pill.getAttribute('data-format') === savedFormat) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });

      const savedTheme = result.forcedDarkMode || 'disabled';
      if (savedTheme === 'enabled') {
        btnThemeOn.classList.add('active');
        btnThemeOff.classList.remove('active');
      } else {
        btnThemeOff.classList.add('active');
        btnThemeOn.classList.remove('active');
      }
    });
  }

  // Helper: Retrieve and render local history items
  function loadHistory() {
    chrome.storage.local.get(['searchHistory'], (result) => {
      const history = result.searchHistory || [];
      const existingItems = historyList.querySelectorAll('.vs-history-item');
      existingItems.forEach(item => item.remove());

      if (history.length === 0) {
        emptyState.style.display = 'flex';
        btnClearHistory.style.display = 'none';
        return;
      }

      emptyState.style.display = 'none';
      btnClearHistory.style.display = 'block';

      history.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'vs-history-item';
        
        itemCard.innerHTML = `
          <img src="${item.thumbnail}" alt="Thumbnail" class="vs-history-thumb">
          <div class="vs-history-details">
            <span class="vs-history-engine">${item.engine}</span>
            <span class="vs-history-time">${item.time}</span>
          </div>
          <div class="vs-history-actions">
            <button class="vs-action-btn vs-action-btn-open" title="Open search results">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
              </svg>
            </button>
            <button class="vs-action-btn vs-action-btn-delete" title="Delete screenshot">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        `;

        itemCard.querySelector('.vs-action-btn-open').addEventListener('click', () => {
          chrome.tabs.create({ url: item.url });
        });

        itemCard.querySelector('.vs-action-btn-delete').addEventListener('click', () => {
          deleteHistoryItem(item.id);
        });

        historyList.appendChild(itemCard);
      });
    });
  }

  function deleteHistoryItem(itemId) {
    chrome.storage.local.get(['searchHistory'], (result) => {
      let history = result.searchHistory || [];
      history = history.filter(item => item.id !== itemId);
      chrome.storage.local.set({ searchHistory: history }, () => {
        loadHistory();
      });
    });
  }

  function loadActiveTabGroups() {
    if (!activeGroupsList) return;
    
    // Check if chrome.tabGroups is available (requires permission, MV3 supports it)
    if (!chrome.tabGroups) {
      activeGroupsSection.style.display = 'none';
      return;
    }

    chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (groups) => {
      if (chrome.runtime.lastError || !groups || groups.length === 0) {
        activeGroupsSection.style.display = 'none';
        return;
      }

      activeGroupsSection.style.display = 'flex';
      activeGroupsList.innerHTML = '';

      groups.forEach(group => {
        chrome.tabs.query({ groupId: group.id }, (tabs) => {
          const urls = tabs.map(t => t.url).filter(url => url && isAllowedUrl(url));
          if (urls.length === 0) return;

          const groupDiv = document.createElement('div');
          groupDiv.className = 'vs-workspace-btn-container';
          
          const colorMap = {
            'blue': 'blue',
            'green': 'green',
            'purple': 'purple',
            'red': 'red',
            'yellow': 'yellow',
            'orange': 'orange',
            'pink': 'red',
            'cyan': 'blue',
            'grey': 'blue'
          };
          const wsColor = colorMap[group.color] || 'blue';

          groupDiv.innerHTML = `
            <button class="vs-workspace-btn vs-ws-${wsColor}" title="Switch focus to this tab group">
              <span class="vs-group-dot" style="background-color: ${group.color || '#3b82f6'};"></span>
              <span>${group.title || 'Group'}</span>
            </button>
            <button class="vs-workspace-btn-save-group" title="Save this group permanently">
              <svg viewBox="0 0 24 24" width="10" height="10">
                <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
              </svg>
            </button>
          `;

          // Focus Group Click
          groupDiv.querySelector('.vs-workspace-btn').addEventListener('click', () => {
            if (tabs[0]) {
              chrome.tabs.update(tabs[0].id, { active: true });
            }
          });

          // Save Group Click
          groupDiv.querySelector('.vs-workspace-btn-save-group').addEventListener('click', (e) => {
            e.stopPropagation();
            saveActiveGroupAsWorkspace(group.title || 'Saved Group', urls, wsColor);
          });

          activeGroupsList.appendChild(groupDiv);
        });
      });
    });
  }

  function saveActiveGroupAsWorkspace(name, urls, color) {
    chrome.storage.local.get(['workspaces'], (result) => {
      const list = result.workspaces || getDefaultWorkspaces();
      
      const newWs = {
        id: Date.now().toString(),
        name: name,
        urls: urls,
        color: color
      };

      list.push(newWs);
      chrome.storage.local.set({ workspaces: list }, () => {
        loadWorkspaces();
        loadActiveTabGroups();
      });
    });
  }

  function closeAllTabGroups() {
    if (!chrome.tabGroups) return;
    chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (groups) => {
      if (chrome.runtime.lastError || !groups || groups.length === 0) return;
      
      groups.forEach(group => {
        chrome.tabs.query({ groupId: group.id }, (tabs) => {
          const tabIds = tabs.map(t => t.id);
          if (tabIds.length > 0) {
            chrome.tabs.remove(tabIds);
          }
        });
      });
    });
  }
});
