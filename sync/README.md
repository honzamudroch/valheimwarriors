# Valheim Warriors Sync

Small Windows tray app for [valheimwarriors.com](https://valheimwarriors.com). It watches your Steam
character folder (`.fch` files) and after every game save uploads the character sheet to your party's
Valhalla page. Open source, MIT licensed.

- `vwsync.py` - the app (tkinter UI, pystray tray icon, urllib client, self-update)
- `fchfull.py`, `zdo.py`, `items.py`, `item-names.json` - parser of Valheim `.fch` character files (format v46)
- `vw.ico` - icon
- `build.ps1` - build with PyInstaller, sign every exe/dll/pyd, verify, zip

What is uploaded: character name, stats, skills, inventory, trophies, explored-map coverage grid (128x128,
no coordinates). Map pins, positions, spawn/death/logout points are stripped before upload.

## Build

```powershell
pip install pyinstaller pystray pillow
.\build.ps1 -Version 0.1.9            # build only
.\build.ps1 -Version 0.1.9 -Sign      # build + sign (needs the code signing certificate in the user store)
```

Requirements: Python 3.12+, Windows SDK (signtool.exe) for signing.
