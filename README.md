# Student Extension (Visual Scholar)

A powerful, premium minimalist Chrome Extension (Manifest V3) designed for students. It supports smart screenshot search with custom positioning, tab-grouped workspaces, automated browser tab group imports, active page savers, an element inspect copier, a forced dark mode filter, and a quick shortcut to a PDF drawing canvas.

---

## 🛠️ Installation Guide

1. Download or clone this directory to your machine.
2. Open **Google Chrome** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (using the toggle switch on the top-right).
4. Click **Load unpacked** (button on the top-left).
5. Select the project folder containing `manifest.json`.

---

## 📖 How to Use the Extension

### 1. Screen Capture & Visual Search
Capture any portion of your active webpage to search for it instantly.

- **Step 1: Set Search Engine**  
  Open the extension popup and choose your visual search engine (options: **Lens** (default), **Bing**, **Yandex**, or **TinEye**).
- **Step 2: Trigger Capture**  
  - Press `Alt + I` on your keyboard, OR open the popup and click **Split View**, **New Tab**, or **Reading**.
  - A dark glass mask will cover your webpage, changing your cursor to a crosshair.
- **Step 3: Crop Selection**  
  - Click and drag your mouse over the area of the page you want to capture.
  - Release the click. The extension will automatically crop the screen and load the search results.
- **Step 4: View and Adjust (If in Split View)**  
  - If **Split View** is chosen, a resizable search panel will slide open inside the page.
  - **Resize**: Hover your mouse over the inner border and drag to expand or shrink the split window.
  - **Reposition**: Click the positioning buttons at the top of the side panel to anchor it to the **Left (L)**, **Right (R)**, **Top (T)**, or **Bottom (B)** margins.

---

### 2. Scholar Workspaces (Tab Groups)
Launch and organize educational websites inside native, color-coded Chrome Tab Groups.

- **Launch Workspace**:  
  Click any colored workspace pill on the dashboard (default groups are **Home**, **Study**, and **Coding**). The extension will open all saved links in background tabs and bind them under a labeled, colored native Chrome Tab Group.
- **Create Custom Workspace**:  
  - Click **Create** in the workspaces section header.
  - Enter a name, paste URLs (one per line), pick a group color, and click **Save**.
- **Add Current Webpage**:  
  - Navigate to any web page in Chrome.
  - Open the popup, click **Add Page** in the workspaces section header.
  - Choose a target workspace button. The page's URL will immediately append to that workspace group.
- **Manage Workspace Links**:  
  - Click **Manage** in the workspaces section header.
  - Choose your target workspace from the dropdown list.
  - Browse all URLs stored in that group. Click the red **x** cross next to a URL to remove it.
- **Delete Entire Workspace**:  
  Hover over any workspace pill on the dashboard and click the small red **x** badge in the corner.

---

### 3. Active Browser Groups Scanner
Import tab groups that you have already created in Chrome directly into the extension.

- **Focus Active Groups**:  
  If you have Chrome Tab Groups open, they appear under **Active Browser Groups** at the bottom of the Workspaces section. Click a group button to focus and switch to that tab group.
- **Save Permanently**:  
  Hover over an active group button and click the green **Save** badge. All tabs inside that group will be imported and saved as a permanent workspace pill.

---

### 4. Forced Dark Mode
Toggle any webpage (and all newly opened websites) into Dark Mode.

- **Turn On**:  
  Open the popup and click **On** under **Forced Dark Mode**. The current tab and all new webpage loads will dynamically adjust to a dark layout, while media elements (images/videos) and visual search frames retain their original colors.
- **Turn Off**:  
  Click **Off** in the theme toggle to revert back to default layout styling.

---

### 5. Element Copier (Clipboard Inspect Helper)
Quickly copy code, text structures, or raw HTML grids from any webpage.

- **Step 1: Set Copy Format**  
  In the Element Copier section, select your output preference: **Text** (copies clean string content) or **HTML** (copies raw tag hierarchy).
- **Step 2: Start Inspect Picker**  
  Click **Select & Copy Element**. The popup will close and the page inspector will activate.
- **Step 3: Highlight & Capture**  
  - Hover your cursor over nodes. Elements are highlighted in emerald green borders with a transparent mask.
  - Press `Escape` to cancel.
  - Click any highlighted element to copy it to your clipboard. An in-page slide-in notification will confirm: *"Copied successfully!"*.

---

### 6. PDF Canvas Editor
Open a quick drawing canvas to review and write on PDF materials.

- Click **Open PDF Canvas Editor** on the dashboard.
- A new browser tab will load **[Study Canvas](https://study-canvas.vercel.app/)** where you can drag & drop, draw, and annotate PDFs.
