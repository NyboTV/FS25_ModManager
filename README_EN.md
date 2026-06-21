# FS Mod Manager

[![GitHub Release](https://img.shields.io/github/v/release/NyboTV/FS25_ModManager?style=for-the-badge&color=success)](https://github.com/NyboTV/FS25_ModManager/releases/latest)
[![GitHub Downloads](https://img.shields.io/github/downloads/NyboTV/FS25_ModManager/total?style=for-the-badge&color=blue)](https://github.com/NyboTV/FS25_ModManager/releases)
[![GitHub License](https://img.shields.io/github/license/NyboTV/FS25_ModManager?style=for-the-badge)](https://github.com/NyboTV/FS25_ModManager/blob/main/LICENSE)

A modern, robust mod manager for Farming Simulator (FS19, FS22, FS25), built with TypeScript, Electron, and React. The application allows you to create, manage, and seamlessly synchronize various mod profiles with Dedicated Servers. Featuring a user-friendly interface and advanced features for easily organizing your Farming Simulator mods.

![FS Mod Manager Screenshot](https://raw.githubusercontent.com/NyboTV/FS25_ModManager/refs/heads/master/dist/image/screenshot.png)

## 🚀 Installation

**For End Users:**
1. Download the latest `Farming Simulator Mod Manager Setup.exe` from the [Releases section](https://github.com/NyboTV/FS25_ModManager/releases)
2. Run the setup file and follow the instructions
3. The application automatically creates a desktop shortcut
4. Launch the Farming Simulator ModManager and configure your settings

## ✨ Key Features

### 🗂️ Advanced Profile Management
- **Unlimited Profiles**: Create as many mod profiles as you need for different game situations
- **Flexible Organization**: Each profile can have its own mods and settings
- **Versatile Use**: Ideal for different savegames, single and multiplayer games, or server scenarios
- **Secure Data Storage**: All profile data is stored structurally in JSON format

### 🔄 Intelligent Mod Deployment
"Deploy Mods" means the mods from the selected profile are safely copied into your Farming Simulator mods folder. This allows you to:
- Quickly switch between different mod sets without manual file operations
- Automatically create backups before changes
- Robustly handle file conflicts and long filenames on Windows

### 🌐 Built-in ModHub Browser
- **In-App Surfing**: Browse the official Farming Simulator ModHub directly within the application.
- **Smart Download**: Clicks on download buttons on the ModHub page are intercepted, allowing direct installation of the mod into a profile of your choice.
- **Auto-Mapping**: Downloaded mods are automatically added to the internal mapping (for ModHub checks and updates).
- **Dark Mode**: The design of the ModHub page is automatically styled to match the dark theme of the ModManager.

### 🌐 Enhanced Server Synchronization
- **Automatic Detection**: Connect to Dedicated Servers and retrieve their complete mod list
- **Smart Download**: Automatically download missing mods directly from the mod source
- **Full Filenames**: Retrieve original mod filenames from the detail pages (not shortened HTML names)
- **Sync Protection**: Built-in spam protection prevents accidental multiple synchronizations
- **Progress Display**: Detailed real-time synchronization progress
- **FastDL Webserver**: An integrated, standalone web server (`fastdl-server.js`) for lightning-fast mod downloads. Ideal when the ModManager and Dedicated Server run on the same host, allowing clients to download mods at gigabit speeds, bypassing the slow native in-game download speed.

### 🌍 Multi-language Support (i18n)
- **Modular System**: Completely overhauled internationalization system
- **Language Support**: English and German available
- **Extensible**: Easily add new languages via separate language files

### 🛠️ Auto-Debugger & Log Analysis
- **Error Detection**: Automatically scan your game's `log.txt` for errors
- **Problematic Mods**: Instantly identify which mods are causing crashes or issues

### 🧹 Storage Cleaner
- **Junk File Detection**: Scan your global mod folder for orphaned or unused mods
- **Space Savings**: Easily delete mods that are no longer used in any of your single-player profiles

### 🎨 Modern User Interface
- **Dark Theme**: Modern, eye-friendly design
- **Intuitive Navigation**: Easy to use via structured tabs
- **Responsive Layouts**: Clear overview of all mod profiles and settings

## 📖 How to Use

### Initial Setup
1. **Launch Application**: Start the FS Mod Manager via the desktop shortcut
2. **Configure Basic Settings**:
   - Go to Settings (⚙️ Tab)
   - **Default Mod Folder**: Select your Farming Simulator mods folder (e.g., `Documents\My Games\FarmingSimulator2025\mods`)
   - **Game Executable**: Select the game executable file directly (e.g., `FarmingSimulator2025.exe`)
   - **Language**: Choose between English and German
   - **Debug Logging**: Optionally enable for advanced error tracking

### 🗂️ Manage Profiles
1. **Create New Profile**:
   - Switch to the "Profiles" tab
   - Click "Create New Profile"
   - Provide a meaningful name
   - **Tip**: Enable "Import current mods" to copy existing mods into the profile

2. **Edit Profiles**:
   - Click "Edit" on a profile
   - Configure server URLs for automatic synchronization
   - Manage the profile's mod list

### 🎮 Deploy Mods and Start Game
1. **Select Profile**: Select a profile from the dropdown menu on the home page
2. **Deploy Mods**: Click "Deploy Mods"
   - The application automatically copies all mods from the profile to your game mods folder
   - Existing mods are safely backed up
3. **Start Game**: Click "Start Game" for a direct launch of Farming Simulator

### 🌐 Server Synchronization (Advanced)
1. **Configure Server**:
   - Open the profile settings (Edit button)
   - Enter the server URL (Format: `http://server.domain.com/mods`)
   - Save settings
2. **Start Synchronization**:
   - Click "Sync with Server"
   - The manager parses the server mod list
   - **Automatic Download**: Missing mods are automatically downloaded

### 🔧 Debug and Troubleshooting
1. **Enable Debug Logging**:
   - Go to Settings
   - Enable "Debug-Logging"
   - Log files are found under `Documents\FS_ModManager\logs\`

## 💻 For Developers

### Technology Stack
- **TypeScript**: Type-safe development for better code quality
- **Electron**: Cross-platform desktop application framework
- **React**: Modern, component-based user interface
- **SCSS**: Advanced styling capabilities
- **Webpack**: Module bundling and build process

### Development Setup
```powershell
# Clone repository
git clone https://github.com/NyboTV/FS25_ModManager.git
cd Fs25_ModManager

# Install dependencies
npm install

# Start development mode (with DevTools)
npm run dev

# Create production build
npm run build

# Package application
npm run package
```

## 📄 License
This project is licensed under the **ISC License**.

**Farming Simulator** is a registered trademark of **GIANTS Software GmbH**.

## ?? Known Limitations

Please note the following app limitations, which are primarily due to external platform or API constraints:

1. **ModHub Updates:** The detection of outdated mods relies strictly on comparing version numbers (extracted from the ModHub HTML page versus your local mod file). Because GIANTS does not provide a public API with file hashes, exact binary verifications are not possible. If the version numbers match, the script considers the mod "up-to-date", even if the internal files differ.
2. **ModHub Mapping:** Matching local mods to their ModHub entries is done via intelligent filename scraping. Mods that have had their filenames heavily modified after download, or mods from unofficial third-party sites, might not be detected reliably.
3. **Dedicated Server Sync (FastDL):** When using bare FastDL services (without the GIANTS Web Interface HTML structure), you must provide a `dedicated-server-stats.xml` URL in the profile settings so the app can correctly determine the expected mod versions from the server.

