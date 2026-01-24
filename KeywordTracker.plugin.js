/**
 * @name KeywordTracker
 * @description Monitors messages for keywords and provides notifications with optional auto-navigation to the channel.
 * @version 1.9.16 (Dispatcher Fix + BD Notifications + ESC + Settings CSS)
 * @author sawahkitty!~<3 (Modified with Navigation by Zerocu)
 * @authorId 135895345296048128
 * @authorLink https://github.com/sarahkittyy
 * @website https://github.com/sarahkittyy/KeywordTracker
 * @source https://raw.githubusercontent.com/sarahkittyy/KeywordTracker/main/KeywordTracker.plugin.js
 */
/*@cc_on
@if (@_jscript)
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\\\BetterDiscord\\\\plugins");
    var pathSelf = WScript.ScriptFullName;
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.\nJust reload Discord with Ctrl+R.", 0, "Already Installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure BetterDiscord is installed?", 0, "Can't Install", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need help installing?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("Installed!\nJust reload Discord with Ctrl+R.", 0, "Successfully Installed", 0x40);
    }
    WScript.Quit();
@end @*/

module.exports = (() => {
    const config = {
        info: {
            name: "KeywordTracker",
            authors: [
                { name: "sawahkitty!~<3 (Modified with Navigation by Zerocu)" }
            ],
            version: "1.9.16",
            description: "Monitors messages for keywords and provides notifications with optional auto-navigation to the channel."
        }
    };

    return !global.ZeresPluginLibrary ? class {
        constructor() { this._config = config; }
        getName() { return config.info.name; }
        getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
        getDescription() { return config.info.description; }
        getVersion() { return config.info.version; }
        load() {
            BdApi.showConfirmationModal(
                "Library Missing",
                `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`,
                {
                    confirmText: "Download Now",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (err, resp, body) => {
                            if (err) return BdApi.showToast("Failed to download library plugin.", { type: "error" });
                            await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                            BdApi.showToast("Downloaded library plugin. Please reload Discord (Ctrl+R).", { type: "success" });
                        });
                    }
                }
            );
        }
        start() { }
        stop() { }
    } : (([Plugin, Library]) => {
        const { WebpackModules, PluginUtilities, Logger, Toasts, DiscordModules, ReactTools, DOMTools, Utilities } = Library;

        return class KeywordTracker extends Plugin {
            constructor() {
                super();
                this.defaultSettings = {
                    keywords: [],
                    notifications: true,
                    autoNav: true,
                    includeEmbeds: true,
                    cooldown: 5000,
                    matchCase: false,
                    wholeWord: false,
                    guilds: {}
                };

                this.settings = Utilities.loadData(config.info.name, "settings", this.defaultSettings) || Utilities.deepclone(this.defaultSettings);
                this.cooldowns = {};
                this.modules = null;
            }

            onStart() {
                try {
                    BdApi.DOM.addStyle("KeywordTracker-Settings", `
                        .kt-settings { padding: 16px; }
                        .kt-card { background: var(--background-secondary); border: 1px solid var(--background-tertiary); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
                        .kt-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
                        .kt-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--header-primary); }
                        .kt-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
                        .kt-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; background: var(--background-tertiary); margin: 4px 6px 0 0; }
                        .kt-divider { height: 1px; background: var(--background-modifier-accent); margin: 12px 0; }
                    `);
                } catch (e) { }

                this.loadModules();
                this.validateCriticalModules();

                this.patched = false;
                try {
                    this.patchDispatcher();
                    this.patched = true;
                    Logger.log("[KeywordTracker] Started and listening for messages.");
                } catch (e) {
                    Logger.error("[KeywordTracker] Failed to start:", e);
                }
            }

            onStop() {
                try { BdApi.DOM.removeStyle("KeywordTracker-Settings"); } catch (e) { }
                try {
                    if (this._settingsRoot && typeof this._settingsRoot.unmount === "function") {
                        this._settingsRoot.unmount();
                        this._settingsRoot = null;
                    }
                } catch (e) { }

                try {
                    if (this.cancelPatch) this.cancelPatch();
                } catch (e) { }
                Logger.log("[KeywordTracker] Stopped.");
            }

            loadModules() {
                try {
                    const React = BdApi.React;
                    const ReactDOM = BdApi.ReactDOM;

                    const Text = WebpackModules.getByProps("Sizes", "Weights");
                    const Button = WebpackModules.getByProps("Colors", "Looks", "Sizes")?.default || WebpackModules.getByProps("Looks", "Sizes")?.default;
                    const Switch = WebpackModules.getByDisplayName("Switch");
                    const TextInput = WebpackModules.getByDisplayName("TextInput");
                    const Flex = WebpackModules.getByDisplayName("Flex");
                    const FormTitle = WebpackModules.getByDisplayName("FormTitle");
                    const FormText = WebpackModules.getByDisplayName("FormText");
                    const FormDivider = WebpackModules.getByDisplayName("FormDivider");
                    const GuildIcon = WebpackModules.getByDisplayName("GuildIcon");

                    const GuildStore = WebpackModules.getByProps("getGuild", "getGuilds");
                    const ChannelStore = WebpackModules.getByProps("getChannel", "hasChannel");
                    const UserStore = WebpackModules.getByProps("getCurrentUser", "getUser");
                    const GuildChannelsStore = WebpackModules.getByProps("getChannels", "getSelectableChannels");
                    const ChannelTypes = WebpackModules.getModule(m => m && typeof m === 'object' && m.GUILD_TEXT === 0) || { GUILD_TEXT: 0 };

                    // Dispatcher: robust resolution across builds
                    const Dispatcher = (() => {
                        let disp = null;
                        try { disp = WebpackModules.getByProps('dispatch', 'subscribe'); } catch (e) { }
                        if (!disp) {
                            try { disp = BdApi.findModuleByProps && BdApi.findModuleByProps('dispatch', 'subscribe'); } catch (e) { }
                        }
                        if (!disp && BdApi.Webpack && typeof BdApi.Webpack.getModule === 'function') {
                            try {
                                disp = BdApi.Webpack.getModule(function (m) {
                                    return m && typeof m.dispatch === 'function' && typeof m.subscribe === 'function';
                                }, { searchExports: true });
                            } catch (e) { }
                        }
                        return disp;
                    })();

                    const NavigationUtils = WebpackModules.getByProps("transitionTo", "replaceWith") || WebpackModules.getByProps("transitionTo");
                    const MessageActions = WebpackModules.getByProps("jumpToMessage", "fetchMessages");
                    const SelectedChannelStore = WebpackModules.getByProps("getChannelId", "getVoiceChannelId");

                    this.modules = {
                        React, ReactDOM,
                        Text, Button, Switch, TextInput, Flex,
                        FormTitle, FormText, FormDivider, GuildIcon,
                        GuildStore, ChannelStore, UserStore, GuildChannelsStore, ChannelTypes,
                        Dispatcher,
                        NavigationUtils,
                        MessageActions,
                        SelectedChannelStore,
                        Logger
                    };
                } catch (e) {
                    Logger.error("[KeywordTracker] Failed to load modules:", e);
                }
            }

            validateCriticalModules() {
                const missing = [];
                const m = this.modules || {};
                if (!m.Dispatcher) missing.push("Dispatcher");
                if (!m.ChannelStore) missing.push("ChannelStore");
                if (!m.GuildStore) missing.push("GuildStore");

                if (missing.length) {
                    Logger.err("[KeywordTracker] Failed to find critical modules: " + missing.join(", "));
                }
            }

            patchDispatcher() {
                const Dispatcher = this.modules.Dispatcher;
                if (!Dispatcher || typeof Dispatcher.subscribe !== "function") {
                    throw new Error("Dispatcher unavailable. Cannot hook message events.");
                }

                const handler = this.handleDispatch.bind(this);
                Dispatcher.subscribe("MESSAGE_CREATE", handler);

                this.cancelPatch = () => {
                    try { Dispatcher.unsubscribe("MESSAGE_CREATE", handler); } catch (e) { }
                };
            }

            handleDispatch(event) {
                try {
                    if (!event || !event.message) return;
                    this.handleMessage(event.message);
                } catch (e) {
                    Logger.error("[KeywordTracker] Error in dispatch handler:", e);
                }
            }

            normalizeText(text) {
                if (typeof text !== "string") return "";
                return this.settings.matchCase ? text : text.toLowerCase();
            }

            keywordMatches(content, keyword) {
                if (!content || !keyword) return false;
                const hay = this.normalizeText(content);
                const needle = this.normalizeText(keyword);

                if (this.settings.wholeWord) {
                    try {
                        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const re = new RegExp(`\\b${escaped}\\b`, this.settings.matchCase ? "" : "i");
                        return re.test(content);
                    } catch (e) {
                        return hay.includes(needle);
                    }
                }
                return hay.includes(needle);
            }

            handleMessage(message) {
                try {
                    if (!message || !message.author) return;
                    const channel = this.modules.ChannelStore.getChannel(message.channel_id);
                    if (!channel) return;

                    // Guild filter per-guild settings (if configured)
                    if (channel.guild_id && this.settings.guilds && this.settings.guilds[channel.guild_id]) {
                        const g = this.settings.guilds[channel.guild_id];
                        if (g.enabled === false) return;

                        // channel whitelist behavior if present
                        if (Array.isArray(g.channels) && g.channels.length) {
                            if (!g.channels.includes(message.channel_id)) return;
                        }
                    }

                    const now = Date.now();
                    if (this.cooldowns[message.channel_id] && now - this.cooldowns[message.channel_id] < (this.settings.cooldown || 0)) return;

                    let content = message.content || "";
                    if (this.settings.includeEmbeds && message.embeds && message.embeds.length) {
                        for (let i = 0; i < message.embeds.length; i++) {
                            const em = message.embeds[i];
                            if (em && em.description) content += "\n" + em.description;
                            if (em && em.title) content += "\n" + em.title;
                        }
                    }

                    for (let i = 0; i < (this.settings.keywords || []).length; i++) {
                        const kw = this.settings.keywords[i];
                        if (this.keywordMatches(content, kw)) {
                            this.cooldowns[message.channel_id] = now;
                            if (this.settings.notifications) {
                                this.pingSuccess(message, channel);
                            }

                            // Auto-navigate immediately (no click required)
                            if (this.settings.autoNav) {
                                const gid = message.guild_id || (channel && channel.guild_id);
                                const cid = message.channel_id;
                                const mid = message.id;

                                setTimeout(() => {
                                    this.navigateToChannel(gid, cid, mid);
                                }, 150);
                            }

                            break;
                        }
                    }
                } catch (e) {
                    Logger.error("[KeywordTracker] Error in handleMessage:", e);
                }
            }

            pressEscape(times, delayMs) {
                try {
                    times = (typeof times === "number" && times > 0) ? times : 1;
                    delayMs = (typeof delayMs === "number" && delayMs >= 0) ? delayMs : 0;

                    const fire = function () {
                        const ev = new KeyboardEvent("keydown", {
                            key: "Escape",
                            code: "Escape",
                            keyCode: 27,
                            which: 27,
                            bubbles: true,
                            cancelable: true
                        });
                        document.dispatchEvent(ev);
                    };

                    for (let i = 0; i < times; i++) {
                        setTimeout(fire, delayMs * i);
                    }
                } catch (e) { }
            }

            navigateToChannel(guildId, channelId, messageId) {
                const Logger = this.modules.Logger;
                try {
                    let path = `/channels/${guildId}/${channelId}`;
                    if (messageId) path += `/${messageId}`;

                    Logger.info(`[KeywordTracker] Attempting navigation: ${path}`);

                    // Method 1: router transitionTo (if available)
                    try {
                        const router = BdApi.findModuleByProps && BdApi.findModuleByProps("transitionTo");
                        if (router && typeof router.transitionTo === "function") {
                            router.transitionTo(path);
                            try { setTimeout(() => this.pressEscape(2, 140), 250); } catch (e) { }
                            return true;
                        }
                    } catch (e) { }

                    // Method 2: dispatch channel select
                    try {
                        const Dispatcher = this.modules.Dispatcher;
                        if (Dispatcher && typeof Dispatcher.dispatch === "function") {
                            Dispatcher.dispatch({ type: "CHANNEL_SELECT", guildId: guildId, channelId: channelId });
                            try { setTimeout(() => this.pressEscape(2, 140), 250); } catch (e) { }
                            return true;
                        }
                    } catch (e) { }

                    // Method 3: NavigationUtils
                    try {
                        const nav = this.modules.NavigationUtils;
                        if (nav && typeof nav.transitionTo === "function") {
                            nav.transitionTo(path);
                            try { setTimeout(() => this.pressEscape(2, 140), 250); } catch (e) { }
                            return true;
                        }
                    } catch (e) { }

                    // Method 4: jumpToMessage if we have it (best UX)
                    try {
                        const MessageActions = this.modules.MessageActions;
                        if (MessageActions && typeof MessageActions.jumpToMessage === "function" && messageId) {
                            MessageActions.jumpToMessage(channelId, messageId, { flash: true });
                            try { setTimeout(() => this.pressEscape(2, 140), 250); } catch (e) { }
                            return true;
                        }
                    } catch (e) { }
                    // Method 5: URL fallback (works on some builds)
                    try {
                        const url = `https://discord.com/channels/${guildId}/${channelId}${messageId ? `/${messageId}` : ""}`;
                        window.open(url, "_self");
                        setTimeout(() => this.pressEscape(2, 140), 350);
                        return true;
                    } catch (e) { }

                    return false;
                } catch (e) {
                    Logger.warn("[KeywordTracker] Navigation failed:", e);
                    return false;
                }
            }

            pingSuccess(message, channel) {
                try {
                    const Logger = this.modules.Logger;
                    const GuildStore = this.modules.GuildStore;
                    const guild = GuildStore && channel ? GuildStore.getGuild(channel.guild_id) : null;

                    const guildName = (guild && guild.name) ? guild.name : "Unknown Server";
                    const channelName = (channel && channel.name) ? channel.name : "Unknown Channel";
                    const authorName = (message && message.author && message.author.username) ? message.author.username : "Someone";
                    const content = (message && message.content) ? message.content : "Message with embed";

                    const doNavigate = () => {
                        try {
                            if (this.settings && this.settings.autoNav) {
                                const gid = message.guild_id || (channel && channel.guild_id);
                                this.navigateToChannel(gid, message.channel_id, message.id);
                            }
                        } catch (e) {
                            Logger && Logger.warn && Logger.warn("[KeywordTracker] onClick navigation failed:", e);
                        }
                    };

                    // Preferred: BetterDiscord UI notifications (stable)
                    try {
                        if (BdApi && BdApi.UI && typeof BdApi.UI.showNotification === "function") {
                            BdApi.UI.showNotification({
                                id: "KeywordTracker-" + message.id,
                                title: authorName + " in #" + channelName + " (" + guildName + ")",
                                content: content,
                                duration: 8000,
                                type: "info",
                                onClick: doNavigate
                            });
                            return;
                        }
                    } catch (e) { }

                    // Fallback: toast
                    try {
                        if (BdApi && BdApi.UI && typeof BdApi.UI.showToast === "function") {
                            BdApi.UI.showToast("Keyword found in #" + channelName + " (" + guildName + ")", { type: "info" });
                        }
                    } catch (e) { }

                } catch (e) {
                    try { this.modules.Logger.error("[KeywordTracker] Error in pingSuccess:", e); } catch (e2) { }
                }
            }

            saveSettings() {
                Utilities.saveData(config.info.name, "settings", this.settings);
            }

            getSettingsPanel() {
                const p = this;

                const root = document.createElement("div");
                root.className = "kt-settings";

                // Ensure CSS exists (safe if already added)
                try {
                    BdApi.DOM.addStyle("KeywordTracker-Settings", `
            .kt-settings { padding: 16px; }
            .kt-card { background: var(--background-secondary); border: 1px solid var(--background-tertiary); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
            .kt-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; color: var(--header-primary); }
            .kt-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
            .kt-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
            .kt-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; background: var(--background-tertiary); margin: 4px 6px 0 0; }
            .kt-pill button { border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 14px; }
            .kt-divider { height: 1px; background: var(--background-modifier-accent); margin: 12px 0; }
            .kt-input {
                width: 320px;
                max-width: 100%;
                padding: 10px 12px;

                /* VISUAL DIFFERENTIATION */
                background: var(--background-primary);
                border: 1px solid var(--brand-500);

                border-radius: 10px;
                color: var(--text-normal);
                outline: none;

                transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
            }

            /* Focus = clearly editable */
            .kt-input:focus {
                border-color: var(--brand-400);
                box-shadow: 0 0 0 2px rgba(88,101,242,0.25);
                background: var(--background-primary);
            }

            /* Number inputs same treatment */
            .kt-input[type="number"] {
                background: var(--background-primary);
            }

            /* Checkbox click targets stay neutral */
            .kt-toggle input[type="checkbox"] {
                accent-color: var(--brand-500);
            }
            .kt-btn { border: none; background: var(--brand-500); color: white; border-radius: 10px; padding: 10px 14px; cursor: pointer; }
            .kt-btn-secondary { border: 1px solid var(--background-tertiary); background: transparent; color: var(--text-normal); border-radius: 10px; padding: 10px 14px; cursor: pointer; }
            .kt-toggle { display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 8px 0; }
            .kt-toggle label { color: var(--text-normal); }
        `);
                } catch (e) { }

                function card(title, subtitle) {
                    const c = document.createElement("div");
                    c.className = "kt-card";
                    const t = document.createElement("div");
                    t.className = "kt-title";
                    t.textContent = title;
                    c.appendChild(t);

                    if (subtitle) {
                        const s = document.createElement("div");
                        s.className = "kt-sub";
                        s.textContent = subtitle;
                        c.appendChild(s);
                    }
                    return c;
                }

                function divider() {
                    const d = document.createElement("div");
                    d.className = "kt-divider";
                    return d;
                }

                function save() {
                    p.saveSettings();
                }

                // --- Keywords Card ---
                const kwCard = card(
                    "Keywords",
                    "Add words/phrases to watch for. Notifications trigger when any keyword is found."
                );

                const pills = document.createElement("div");
                function renderPills() {
                    pills.innerHTML = "";
                    const kws = p.settings.keywords || [];
                    if (!kws.length) {
                        const empty = document.createElement("div");
                        empty.className = "kt-sub";
                        empty.textContent = "No keywords added yet.";
                        pills.appendChild(empty);
                        return;
                    }

                    kws.forEach((kw) => {
                        const pill = document.createElement("span");
                        pill.className = "kt-pill";

                        const text = document.createElement("span");
                        text.textContent = kw;

                        const x = document.createElement("button");
                        x.type = "button";
                        x.textContent = "✕";
                        x.onclick = () => {
                            p.settings.keywords = (p.settings.keywords || []).filter(k => k !== kw);
                            save();
                            renderPills();
                        };

                        pill.appendChild(text);
                        pill.appendChild(x);
                        pills.appendChild(pill);
                    });
                }

                kwCard.appendChild(divider());
                kwCard.appendChild(pills);

                const addRow = document.createElement("div");
                addRow.className = "kt-row";
                addRow.style.marginTop = "10px";

                const kwInput = document.createElement("input");
                kwInput.className = "kt-input";
                kwInput.placeholder = "Add keyword…";

                const addBtn = document.createElement("button");
                addBtn.className = "kt-btn";
                addBtn.textContent = "Add";
                addBtn.onclick = () => {
                    const kw = (kwInput.value || "").trim();
                    if (!kw) return;
                    p.settings.keywords = p.settings.keywords || [];
                    if (p.settings.keywords.indexOf(kw) === -1) {
                        p.settings.keywords.push(kw);
                        save();
                        kwInput.value = "";
                        renderPills();
                    }
                };

                addRow.appendChild(kwInput);
                addRow.appendChild(addBtn);
                kwCard.appendChild(addRow);

                // Enter key adds too
                kwInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") addBtn.click();
                });

                root.appendChild(kwCard);
                renderPills();

                // --- Behavior Card ---
                const behavior = card(
                    "Behavior",
                    "Auto-nav jumps to the match, then presses ESC to return to the most recent chat."
                );

                function toggleRow(labelText, key) {
                    const row = document.createElement("div");
                    row.className = "kt-toggle";

                    const label = document.createElement("label");
                    label.textContent = labelText;

                    const input = document.createElement("input");
                    input.type = "checkbox";
                    input.checked = !!p.settings[key];
                    input.onchange = () => {
                        p.settings[key] = !!input.checked;
                        save();
                    };

                    row.appendChild(label);
                    row.appendChild(input);
                    return row;
                }

                behavior.appendChild(toggleRow("Enable Notifications", "notifications"));
                behavior.appendChild(toggleRow("Auto Navigate to Keyword", "autoNav"));
                behavior.appendChild(toggleRow("Include Embeds", "includeEmbeds"));
                behavior.appendChild(toggleRow("Match Case", "matchCase"));
                behavior.appendChild(toggleRow("Whole Word", "wholeWord"));

                behavior.appendChild(divider());

                const cdRow = document.createElement("div");
                cdRow.className = "kt-toggle";

                const cdLabel = document.createElement("label");
                cdLabel.textContent = "Cooldown (seconds)";

                const cdInput = document.createElement("input");
                cdInput.type = "number";
                cdInput.min = "0";
                cdInput.step = "0.5";
                cdInput.value = String((p.settings.cooldown || 5000) / 1000);
                cdInput.className = "kt-input";
                cdInput.style.width = "120px";

                cdInput.onchange = () => {
                    const n = parseFloat(cdInput.value);
                    if (isNaN(n) || n < 0) return;
                    p.settings.cooldown = Math.round(n * 1000);
                    save();
                };

                cdRow.appendChild(cdLabel);
                cdRow.appendChild(cdInput);
                behavior.appendChild(cdRow);

                root.appendChild(behavior);

                // --- Server / Channel Filters Card (DOM picker) ---
                const filters = card(
                    "Server / Channel Filters",
                    "Enable/disable per server and optionally restrict to specific text channels. If no channels are selected for a server, all text channels are allowed."
                );

                function ensureGuild(gid) {
                    if (!p.settings.guilds) p.settings.guilds = {};
                    if (!p.settings.guilds[gid]) p.settings.guilds[gid] = { enabled: true, channels: [] };
                    if (!Array.isArray(p.settings.guilds[gid].channels)) p.settings.guilds[gid].channels = [];
                }

                const expandedGuilds = {}; // local UI state (not saved)

                function renderGuilds() {
                    // clear old
                    while (filters.lastChild && filters.lastChild !== filters.firstChild) {
                        // keep title/sub already inside the card created by card()
                        // but card() currently appends title/sub directly; easiest is to rebuild below
                        break;
                    }

                    // Remove everything after subtitle (card created by card() has title + optional sub)
                    // We'll rebuild contents each render by keeping first 2 children.
                    while (filters.children.length > 2) filters.removeChild(filters.lastChild);

                    filters.appendChild(divider());

                    const m = p.modules || {};
                    const GuildStore = m.GuildStore;
                    const GuildChannelsStore = m.GuildChannelsStore;
                    const ChannelTypes = m.ChannelTypes || {};
                    const GUILD_TEXT = (typeof ChannelTypes.GUILD_TEXT === "number") ? ChannelTypes.GUILD_TEXT : 0;

                    let guilds = [];
                    try {
                        const map = GuildStore && typeof GuildStore.getGuilds === "function" ? GuildStore.getGuilds() : null;
                        if (map) guilds = Object.values(map);
                    } catch (e) { }

                    if (!guilds.length) {
                        const empty = document.createElement("div");
                        empty.className = "kt-sub";
                        empty.textContent = "No guilds found.";
                        filters.appendChild(empty);
                        return;
                    }

                    // Sort by name for sanity
                    guilds.sort(function (a, b) {
                        const an = (a && a.name) ? a.name.toLowerCase() : "";
                        const bn = (b && b.name) ? b.name.toLowerCase() : "";
                        return an.localeCompare(bn);
                    });

                    for (let gi = 0; gi < guilds.length; gi++) {
                        const g = guilds[gi];
                        if (!g || !g.id) continue;

                        const gid = g.id;
                        ensureGuild(gid);

                        const enabled = p.settings.guilds[gid].enabled !== false;
                        const isExpanded = !!expandedGuilds[gid];

                        const gCard = document.createElement("div");
                        gCard.className = "kt-card";

                        // Header row
                        const header = document.createElement("div");
                        header.className = "kt-row";

                        const nameWrap = document.createElement("div");
                        nameWrap.style.flex = "1 1 auto";

                        const title = document.createElement("div");
                        title.className = "kt-title";
                        title.style.marginBottom = "0";
                        title.textContent = g.name || "Unknown Server";

                        const sub = document.createElement("div");
                        sub.className = "kt-sub";
                        sub.style.margin = "2px 0 0 0";
                        sub.textContent = enabled ? "Enabled" : "Disabled";

                        nameWrap.appendChild(title);
                        nameWrap.appendChild(sub);

                        const enableBtn = document.createElement("button");
                        enableBtn.type = "button";
                        enableBtn.className = "kt-btn-secondary";
                        enableBtn.textContent = enabled ? "Disable" : "Enable";
                        enableBtn.onclick = function () {
                            ensureGuild(gid);
                            p.settings.guilds[gid].enabled = !(p.settings.guilds[gid].enabled === true);
                            // The line above toggles weirdly; do it clearly:
                            p.settings.guilds[gid].enabled = !enabled;
                            save();
                            renderGuilds();
                        };

                        const expandBtn = document.createElement("button");
                        expandBtn.type = "button";
                        expandBtn.className = "kt-btn-secondary";
                        expandBtn.textContent = isExpanded ? "Hide Channels" : "Choose Channels";
                        expandBtn.onclick = function () {
                            expandedGuilds[gid] = !expandedGuilds[gid];
                            renderGuilds();
                        };

                        header.appendChild(nameWrap);
                        header.appendChild(enableBtn);
                        header.appendChild(expandBtn);

                        gCard.appendChild(header);

                        // Expanded: channel list
                        if (isExpanded) {
                            gCard.appendChild(divider());

                            let channels = [];
                            try {
                                // Discord frequently changes this structure; try common shapes
                                const ch = GuildChannelsStore && typeof GuildChannelsStore.getChannels === "function"
                                    ? GuildChannelsStore.getChannels(gid)
                                    : null;

                                if (ch) {
                                    if (Array.isArray(ch.SELECTABLE)) channels = ch.SELECTABLE;
                                    else if (ch.SELECTABLE && Array.isArray(ch.SELECTABLE.channels)) channels = ch.SELECTABLE.channels;
                                    else if (Array.isArray(ch.channels)) channels = ch.channels;
                                }
                            } catch (e) { }

                            // Filter to text channels
                            const textChannels = [];
                            for (let ci = 0; ci < channels.length; ci++) {
                                const c = channels[ci];
                                if (!c || !c.id) continue;
                                if (typeof c.type === "number" && c.type !== GUILD_TEXT) continue;
                                textChannels.push(c);
                            }

                            // If store structure failed, show a hint instead of breaking settings
                            if (!textChannels.length) {
                                const hint = document.createElement("div");
                                hint.className = "kt-sub";
                                hint.textContent = "Could not list channels for this server on your build. (Filtering still works if you enter channel IDs manually—tell me and I’ll add a manual entry field.)";
                                gCard.appendChild(hint);
                            } else {
                                // sort channels
                                textChannels.sort(function (a, b) {
                                    const an = (a && a.name) ? a.name.toLowerCase() : "";
                                    const bn = (b && b.name) ? b.name.toLowerCase() : "";
                                    return an.localeCompare(bn);
                                });

                                const selected = p.settings.guilds[gid].channels || [];

                                for (let ci2 = 0; ci2 < textChannels.length; ci2++) {
                                    const c = textChannels[ci2];

                                    const row = document.createElement("label");
                                    row.style.display = "flex";
                                    row.style.alignItems = "center";
                                    row.style.gap = "10px";
                                    row.style.margin = "6px 0";

                                    const cb = document.createElement("input");
                                    cb.type = "checkbox";
                                    cb.checked = selected.indexOf(c.id) !== -1;
                                    cb.onchange = function () {
                                        ensureGuild(gid);
                                        const arr = p.settings.guilds[gid].channels;
                                        const idx = arr.indexOf(c.id);
                                        if (cb.checked) {
                                            if (idx === -1) arr.push(c.id);
                                        } else {
                                            if (idx !== -1) arr.splice(idx, 1);
                                        }
                                        save();
                                    };

                                    const label = document.createElement("span");
                                    label.textContent = "#" + (c.name || c.id);

                                    row.appendChild(cb);
                                    row.appendChild(label);
                                    gCard.appendChild(row);
                                }
                            }

                            const note = document.createElement("div");
                            note.className = "kt-sub";
                            note.style.marginTop = "8px";
                            note.textContent = "Tip: If you select zero channels, all text channels are allowed for this server.";
                            gCard.appendChild(note);
                        }

                        filters.appendChild(gCard);
                    }
                }

                renderGuilds();
                root.appendChild(filters);

                return root;
            }

        };
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
