KeywordTracker (BetterDiscord Plugin)

KeywordTracker notifies you when a message matches one of your keywords and can automatically navigate you to the channel/message.

Install (Where to put it)

This is a BetterDiscord plugin file. You do not run it directly.

Make sure the file is named:

KeywordTracker.plugin.js

Put it in your BetterDiscord plugins folder:

Windows

%APPDATA%\BetterDiscord\plugins

Quick way:
Discord → User Settings → BetterDiscord → Plugins → Open Plugins Folder

macOS

~/Library/Application Support/BetterDiscord/plugins

Linux

~/.config/BetterDiscord/plugins

After copying the file:

Discord → Settings → BetterDiscord → Plugins

Enable KeywordTracker

If prompted, also install/enable ZeresPluginLibrary

Tip: If you double-click the .plugin.js on Windows, the script portion at the top may offer to copy itself to the right folder. That’s normal.

Required Dependency

This plugin uses ZeresPluginLibrary.

If you enable the plugin and see a “Library Missing” popup, click Download Now and it will install the library plugin for you.

How to Configure

Discord → Settings → BetterDiscord → Plugins → KeywordTracker (gear icon)

Keywords

One keyword per line.

Normal keywords are case-insensitive.

Regex is supported using /pattern/flags format.

Examples:

hello

free nitro

/\bdeal(s)?\b/i

Filters (watch only specific user/channel/server)

You can prefix a keyword with a filter in this format:

@USER_ID:keyword → only match messages from that user

#CHANNEL_ID:keyword → only match messages in that channel

SERVER_ID:keyword → only match messages in that server

Examples:

@123456789012345678:hello

#234567890123456789:/\bping\b/i

345678901234567890:/\d{4}-\d{2}-\d{2}/

To copy IDs: enable Developer Mode in Discord → Settings → Advanced → Developer Mode, then right-click a user/channel/server → Copy ID.

Other Options (Settings panel)

Auto-Navigate: Automatically jumps you to the channel when a match happens.

Navigation Cooldown: Prevents constant jumping (default is 5 seconds).

Notification sounds: Toggles sound on match.

Embeds: Allow matching inside embed content.

Bots / Self: Allow bots and/or your own messages to trigger matches.

Ignored Users: One user ID per line (their messages will never trigger matches).

Whitelisted Users: One user ID per line (all their messages trigger matches).

Using the Inbox (Matches)

The plugin adds a small icon near the top bar. Clicking it opens a “Keyword Matches” inbox:

View recent matches

Jump to a message

Mark individual matches as read

Or mark everything read

Troubleshooting

Plugin doesn’t show up: Confirm the file is in the correct plugins folder and ends with .plugin.js.

Library Missing: Install/enable 0PluginLibrary.plugin.js (ZeresPluginLibrary).

No matches: Make sure the server/channel is enabled in the plugin’s Channels section and your keyword list isn’t empty.
