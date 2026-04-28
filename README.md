KeywordTracker
A BetterDiscord plugin for real‑time keyword alerts.

KeywordTracker notifies you whenever a message matches one of your keywords and can automatically jump you to the channel or message where it occurred.

✨ Features
Real‑time keyword detection

Optional auto‑navigation to the matched message

Case‑insensitive matching

Full regex support

Per‑keyword filters (user, channel, server)

Simple, clean configuration UI

📦 Installation
This is a BetterDiscord plugin. You do not run it directly.

1. Download
Ensure the file is named:

Code
KeywordTracker.plugin.js
2. Move it to your BetterDiscord plugins folder
Windows
Code
%APPDATA%\BetterDiscord\plugins
Quick path:
Discord → User Settings → BetterDiscord → Plugins → Open Plugins Folder

macOS
Code
~/Library/Application Support/BetterDiscord/plugins
Linux
Code
~/.config/BetterDiscord/plugins
3. Enable the plugin
Discord → Settings → BetterDiscord → Plugins → KeywordTracker

If prompted, install ZeresPluginLibrary.

Note (Windows): Double‑clicking the .plugin.js may offer to copy itself into the correct folder. This is normal.

📚 Dependency
KeywordTracker requires ZeresPluginLibrary.

If you see a “Library Missing” popup when enabling the plugin, click Download Now and BetterDiscord will install it automatically.

⚙️ Configuration
Open the settings panel:

Discord → Settings → BetterDiscord → Plugins → KeywordTracker (gear icon)

🔑 Keywords
Enter one keyword per line.

Matching is case‑insensitive by default

Regex supported using /pattern/flags format

Examples:

Code
hello
free nitro
/\bdeal(s)?\b/i
🎯 Filters
Limit a keyword to specific users, channels, or servers by prefixing it:

@USER_ID:keyword → only match messages from that user

#CHANNEL_ID:keyword → only match messages in that channel

SERVER_ID:keyword → only match messages in that server

Examples:

Code
@123456789012345678:hello
#987654321098765432:/\bdeal\b/i
112233445566778899:free nitro
📝 License
MIT (or whatever license you prefer — I can generate one if you want)
