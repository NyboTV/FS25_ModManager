# FS25 Mod Manager

A modern, robust mod manager for Farming Simulator 25, built with TypeScript, Electron, and React. The application allows you to create, manage, and seamlessly synchronize various mod profiles with Dedicated Servers. Featuring a user-friendly interface and advanced features for easily organizing your Farming Simulator mods.

![FS25 Mod Manager Screenshot](https://github.com/username/Fs25_ModManager/raw/main/screenshots/main.png)

## 🚀 Installation

**For End Users:**
1. Download the latest `Farming Simulator Mod Manager Setup.exe` from the [Releases section](https://github.com/username/Fs25_ModManager/releases)
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

### 🌐 Enhanced Server Synchronization
- **Automatic Detection**: Connect to Dedicated Servers and retrieve their complete mod list
- **Smart Download**: Automatically download missing mods directly from the mod source
- **Full Filenames**: Retrieve original mod filenames from the detail pages (not shortened HTML names)
- **Sync Protection**: Built-in spam protection prevents accidental multiple synchronizations
- **Progress Display**: Detailed real-time synchronization progress

### 🌍 Multi-language Support (i18n)
- **Modular System**: Completely overhauled internationalization system
- **Language Support**: English and German available
- **Extensible**: Easily add new languages via separate language files

### 🎨 Modern User Interface
- **Dark Theme**: Modern, eye-friendly design
- **Intuitive Navigation**: Easy to use via structured tabs
- **Responsive Layouts**: Clear overview of all mod profiles and settings

## 📖 How to Use

### Initial Setup
1. **Launch Application**: Start the FS25 Mod Manager via the desktop shortcut
2. **Configure Basic Settings**:
   - Go to Settings (⚙️ Tab)
   - **Default Mod Folder**: Select your FS25 mods folder (e.g., `Documents\My Games\FarmingSimulator2025\mods`)
   - **Game Executable**: Select the `FarmingSimulator2025.exe` file directly
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
3. **Start Game**: Click "Start Game" for a direct launch of FS25

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
git clone https://github.com/username/Fs25_ModManager.git
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
