/**
 * @name KeywordTracker
 * @description Monitors messages for keywords and provides notifications with optional auto-navigation to the channel.
 * @version 1.9.10 (Navigation Fixed)
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
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();
@else@*/

const config = {
    info: {
        name: "KeywordTracker",
        authors: [{
            name: "sawahkitty!~<3 (Modified with Navigation by Zerocu)",
            discord_id: "135895345296048128",
            github_username: "sarahkittyy",
        }],
        version: "1.9.10",
        description: "Monitors messages for keywords and provides notifications with optional auto-navigation to the channel.",
        github: "https://github.com/sarahkittyy/KeywordTracker",
        github_raw: "https://raw.githubusercontent.com/sarahkittyy/KeywordTracker/main/KeywordTracker.plugin.js",
    },
    changelog: [{
        title: "v1.9.10 - Navigation Fixed",
        items: [
            "**FIXED:** Auto-navigation to channels now works properly when keywords are detected",
            "**IMPROVED:** Better error handling for navigation failures",
            "**IMPROVED:** Enhanced notification system with proper click handling"
        ]
    }],
    main: "index.js"
};

class Dummy {
    constructor() { this._config = config; }
    start() { }
    stop() { }
}

if (!global.ZeresPluginLibrary) {
    BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
        confirmText: "Download Now",
        cancelText: "Cancel",
        onConfirm: () => {
            require("request").get("https://betterdiscord.app/gh-redirect?id=9", async (err, resp, body) => {
                if (err) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                if (resp.statusCode === 302) {
                    require("request").get(resp.headers.location, async (error, response, content) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), content, r));
                    });
                } else {
                    await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                }
            });
        }
    });
}

module.exports = !global.ZeresPluginLibrary ? Dummy : (([Plugin, Api]) => {
    const plugin = (Plugin, Library) => {
        const { Logger, Utilities, PluginUtilities, Toasts } = Library;

        const defaultSettings = {
            keywords: [],
            guilds: {},
            notifications: true,
            allowSelf: false,
            allowEmbeds: true,
            allowBots: true,
            autoNavigate: true,
            navigationCooldown: 5000,
            lastNavigateTime: 0
        };

        const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        return class KeywordTracker extends Plugin {
            constructor() {
                super();
                this.settings = null;
                this.root = null;
                this.modules = null;
                this._settingsPanel = null;
                this._isInitialized = false;
            }

            onStart() {
                try {
                    this.modules = this.loadModules();
                    this.loadSettings();

                    const missingCriticalModules = this.validateCriticalModules();
                    if (missingCriticalModules.length > 0) {
                        Logger.error(`Failed to find critical modules: ${missingCriticalModules.join(", ")}`);
                        Toasts.show(`KeywordTracker failed to start: Missing critical modules.`, { type: "error" });
                        return;
                    }

                    PluginUtilities.addStyle(this.getName(), `
                        .keyword-tracker-settings {
                            color: var(--text-normal);
                        }

                        /* Section headers ("General Settings", "Keywords", etc.) */
                        .keyword-tracker-settings h2,
                        .keyword-tracker-settings .formTitle-31W3EJ {
                            color: var(--header-primary) !important;
                            font-weight: 600;
                            font-size: 16px;
                            margin-bottom: 8px;
                        }

                        /* Normal text like labels, guild names, etc. */
                        .keyword-tracker-settings span,
                        .keyword-tracker-settings .guild-row,
                        .keyword-tracker-settings .guild-header,
                        .keyword-tracker-settings .channel-list {
                            color: var(--header-primary) !important;
                        }

                        /* Softer descriptive notes under toggles */
                        .keyword-tracker-settings .formText-2ngGjI,
                        .keyword-tracker-settings div[type="description"] {
                            color: var(--header-secondary) !important;
                            font-size: 13px;
                        }

                        /* Keywords list styling */
                        .keyword-tracker-settings .keyword-item {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            margin-bottom: 6px;
                        }

                        .keyword-tracker-settings .keyword-text {
                            background-color: var(--brand-experiment);
                            color: #fff !important;
                            font-weight: 500;
                            padding: 4px 8px;
                            border-radius: 12px;
                            font-size: 13px;
                        }

                        /* Hover effects for guild headers */
                        .keyword-tracker-settings .guild-header:hover {
                            background-color: var(--background-modifier-hover);
                            border-radius: 4px;
                        }
                    `);

                    this.patch();
                    this._isInitialized = true;
                    Logger.info("KeywordTracker started successfully");
                } catch (error) {
                    Logger.error("Error during plugin start:", error);
                }
            }

            loadModules() {
                try {
                    const modules = {
                        React: BdApi.React,
                        ReactDOM: BdApi.ReactDOM,
                        Patcher: BdApi.Patcher,
                        Utilities: Library.Utilities,
                        PluginUtilities: Library.PluginUtilities,
                        Toasts: Library.Toasts,
                        Logger: Library.Logger,
                        GuildStore: Library.WebpackModules.getByProps("getGuild", "getGuilds"),
                        ChannelStore: Library.WebpackModules.getByProps("getChannel", "hasChannel"),
                        UserStore: Library.WebpackModules.getByProps("getCurrentUser", "getUser"),
                        GuildChannelsStore: Library.WebpackModules.getByProps("getChannels", "getSelectableChannels"),
                        ChannelTypes: Library.WebpackModules.getModule(m => m && typeof m === 'object' && m.GUILD_TEXT === 0) || { GUILD_TEXT: 0 },
                        Dispatcher: Library.WebpackModules.getByProps('dispatch', 'subscribe'),
                        NavigationUtils: Library.WebpackModules.getByProps("transitionTo", "replaceWith") || Library.WebpackModules.getByProps("pushLayer", "popLayer"),
                        NotificationModule: Library.WebpackModules.getByProps("showNotification") || Library.WebpackModules.getByProps("requestPermission"),
                        FormTitle: Library.WebpackModules.getByDisplayName("FormTitle"),
                        FormText: Library.WebpackModules.getByDisplayName("FormText"),
                        FormDivider: Library.WebpackModules.getByDisplayName("FormDivider"),
                        Switch: Library.WebpackModules.getByDisplayName("Switch"),
                        TextInput: Library.WebpackModules.getByDisplayName("TextInput"),
                        Button: Library.WebpackModules.getByProps("Looks", "Colors", "Sizes"),
                        Flex: Library.WebpackModules.getByProps('Align', 'Justify', 'Direction'),
                        Margins: Library.WebpackModules.getByProps("marginTop20", "marginBottom20"),
                        GuildIcon: Library.WebpackModules.getByDisplayName("GuildIcon"),
                        Text: Library.WebpackModules.getByDisplayName("Text"),
                    };

                    if (!modules.NavigationUtils) {
                        modules.NavigationUtils = Library.WebpackModules.find(m => m && typeof m.transitionTo === 'function') ||
                                                Library.WebpackModules.find(m => m && typeof m.push === 'function') ||
                                                Library.WebpackModules.getByProps("push", "replace");
                    }

                    for (const key of ["Button", "Flex"]) {
                        if (modules[key]?.default) {
                            const component = modules[key].default;
                            Object.assign(component, modules[key]);
                            modules[key] = component;
                        }
                    }

                    if (!modules.FormTitle) modules.FormTitle = ({ children }) => BdApi.React.createElement("h2", { style: { color: "var(--header-primary)", marginBottom: "10px" } }, children);
                    if (!modules.FormText) {
                        modules.FormText = ({ children }) => BdApi.React.createElement("div", { style: { color: "var(--header-secondary)", fontSize: "14px" } }, children);
                        modules.FormText.Types = { DESCRIPTION: "description" };
                    }
                    if (!modules.FormDivider) modules.FormDivider = () => BdApi.React.createElement("div", { style: { height: "1px", backgroundColor: "var(--background-modifier-accent)", margin: "20px 0" } });
                    if (!modules.Switch) modules.Switch = ({ checked, onChange }) => BdApi.React.createElement("input", { type: "checkbox", checked, onChange: e => onChange(e.target.checked) });
                    if (!modules.TextInput) modules.TextInput = (props) => BdApi.React.createElement("input", { ...props, style: { color: "var(--text-normal)", backgroundColor: "var(--input-background)", border: "1px solid var(--input-background)", borderRadius: "3px", padding: "10px" } });
                    if (!modules.Button) {
                        modules.Button = ({ children, onClick, color, look }) => BdApi.React.createElement("button", { onClick, style: { color: "var(--white)", backgroundColor: color === "RED" ? "var(--button-danger-background)" : "var(--button-secondary-background)", border: "none", borderRadius: "3px", padding: "8px 12px", cursor: "pointer", textDecoration: look === "LINK" ? "underline" : "none" } }, children);
                        modules.Button.Colors = { RED: "RED" };
                        modules.Button.Looks = { LINK: "LINK" };
                    }
                    if (!modules.Flex) {
                        modules.Flex = ({ children }) => BdApi.React.createElement("div", {}, children);
                        modules.Flex.Align = {};
                    }
                    if (!modules.Text) {
                        modules.Text = ({ children, style }) => BdApi.React.createElement("span", { style }, children);
                        modules.Text.Sizes = {};
                    }

                    return modules;
                } catch (e) {
                    Logger.error("Error loading modules:", e);
                    return null;
                }
            }

            validateCriticalModules() {
                if (!this.modules) return ['All modules'];
                const critical = ['React', 'ReactDOM', 'Patcher', 'Dispatcher', 'GuildStore', 'ChannelStore', 'UserStore', 'GuildChannelsStore', 'ChannelTypes'];
                return critical.filter(key => !this.modules[key]);
            }

            patch() {
                const { Patcher, Dispatcher } = this.modules;
                Patcher.after(this.getName(), Dispatcher, 'dispatch', (_, args) => this.handleMessage(args));
            }

            onStop() {
                try {
                    if (this.root) this.root.unmount();
                    if (this._settingsPanel) BdApi.ReactDOM.unmountComponentAtNode(this._settingsPanel);
                    this.modules?.Patcher?.unpatchAll(this.getName());
                    PluginUtilities.removeStyle(this.getName());
                } catch (e) { Logger.error("Error during stop:", e); }
            }

            handleMessage([event]) {
                if (!this._isInitialized || !event || event.type !== 'MESSAGE_CREATE' || event.optimistic) return;
                try {
                    const { ChannelStore, UserStore } = this.modules;
                    const message = event.message;
                    if (!message?.author) return;
                    const channel = ChannelStore.getChannel(message.channel_id);
                    if (!channel?.guild_id) return;
                    const currentUser = UserStore.getCurrentUser();
                    if (!currentUser) return;

                    if (!this.settings.allowSelf && message.author.id === currentUser.id) return;
                    if (this.settings.guilds?.[channel.guild_id]?.enabled === false) return;
                    if (this.settings.guilds?.[channel.guild_id]?.channels?.[channel.id] === false) return;
                    if (!message.content && (!this.settings.allowEmbeds || !message.embeds?.length)) return;
                    if (message.author.bot && !this.settings.allowBots) return;

                    const content = this.settings.allowEmbeds ? JSON.stringify([message.content || '', ...this.objectValues(message.embeds || [])]) : (message.content || '');
                    for (const keyword of this.settings.keywords) {
                        if (keyword && this.createRegex(keyword).test(content)) {
                            this.pingSuccess(message, channel);
                            break;
                        }
                    }
                } catch (e) { Logger.error("Error in handleMessage:", e); }
            }

            initializeGuildSettings(guildId) {
                if (!this.modules || !this.settings || !guildId) return;
                try {
                    const { GuildStore, GuildChannelsStore, ChannelTypes } = this.modules;
                    if (!this.settings.guilds) this.settings.guilds = {};
                    if (!this.settings.guilds[guildId]) {
                        const guild = GuildStore.getGuild(guildId);
                        if (!guild) return;
                        const channels = GuildChannelsStore.getChannels(guildId);
                        const channelMap = {};
                        if (channels && channels.SELECTABLE) {
                            channels.SELECTABLE.forEach(({ channel }) => {
                                if (channel && channel.type === ChannelTypes.GUILD_TEXT) {
                                    channelMap[channel.id] = true;
                                }
                            });
                        }
                        this.settings.guilds[guildId] = { channels: channelMap, enabled: true };
                        this.saveSettings();
                    }
                } catch (error) { Logger.error(`Error initializing guild settings for ${guildId}:`, error); }
            }

            createRegex(keyword) {
                try {
                    const match = keyword.match(new RegExp('^/(.*?)/([gimy]*)$'));
                    return match ? new RegExp(match[1], match[2] || 'i') : new RegExp(escapeRegex(keyword), 'i');
                } catch (e) {
                    Logger.warn(`Failed to create regex for "${keyword}"`, e);
                    return new RegExp(escapeRegex(keyword), 'i');
                }
            }

            objectValues(obj) {
                if (!obj) return [];
                return Object.values(obj).flatMap(v => typeof v === 'object' && v !== null ? this.objectValues(v) : v);
            }

            navigateToChannel(guildId, channelId, messageId = null) {
                const { Logger } = this.modules;
                
                try {
                    let path = `/channels/${guildId}/${channelId}`;
                    if (messageId) {
                        path += `/${messageId}`;
                    }

                    Logger.info(`Attempting to navigate to: ${path}`);

                    // Method 1: Force navigation using Discord's router with dispatch
                    try {
                        const router = BdApi.findModuleByProps("transitionTo");
                        if (router && typeof router.transitionTo === 'function') {
                            router.transitionTo(path);
                            Logger.info("Navigation successful with BdApi router.transitionTo");
                            return true;
                        }
                    } catch (e) {
                        Logger.warn("Method 1 failed:", e);
                    }

                    // Method 2: Try using Discord's internal dispatch system
                    try {
                        const { Dispatcher } = this.modules;
                        if (Dispatcher) {
                            Dispatcher.dispatch({
                                type: "CHANNEL_SELECT",
                                guildId: guildId,
                                channelId: channelId
                            });
                            Logger.info("Navigation successful with CHANNEL_SELECT dispatch");
                            return true;
                        }
                    } catch (e) {
                        Logger.warn("Method 2 failed:", e);
                    }

                    // Method 3: Try alternative router patterns
                    try {
                        const routerAlt = BdApi.findModuleByProps("push", "replace");
                        if (routerAlt && typeof routerAlt.push === 'function') {
                            routerAlt.push(path);
                            Logger.info("Navigation successful with alternative router.push");
                            return true;
                        }
                    } catch (e) {
                        Logger.warn("Method 3 failed:", e);
                    }

                    // Method 4: Try webpack module search at runtime
                    try {
                        const webpackRouter = Library.WebpackModules.getByProps("transitionTo");
                        if (webpackRouter && typeof webpackRouter.transitionTo === 'function') {
                            webpackRouter.transitionTo(path);
                            Logger.info("Navigation successful with webpack router");
                            return true;
                        }
                    } catch (e) {
                        Logger.warn("Method 4 failed:", e);
                    }

                    // Method 5: Force using window location with page reload
                    try {
                        if (typeof window !== 'undefined') {
                            window.location.href = `https://discord.com/channels${path}`;
                            Logger.info("Navigation successful with forced window location");
                            return true;
                        }
                    } catch (e) {
                        Logger.warn("Method 5 failed:", e);
                    }

                    try {
                        const allModules = Library.WebpackModules.getAllModules();
                        for (let i = 0; i < allModules.length; i++) {
                            const module = allModules[i];
                            if (module && module.transitionTo && typeof module.transitionTo === 'function') {
                                module.transitionTo(path);
                                Logger.info("Navigation successful with module search");
                                return true;
                            }
                        }
                    } catch (e) {
                        Logger.warn("Method 6 failed:", e);
                    }

                    Logger.error("All navigation methods failed");
                    return false;

                } catch (error) {
                    Logger.error("Navigation error:", error);
                    return false;
                }
            }

            pingSuccess(message, channel) {
                try {
                    const { GuildStore, NotificationModule, Logger } = this.modules;
                    const guild = GuildStore.getGuild(channel.guild_id);
                    
                    // Show notification
                    if (NotificationModule && typeof NotificationModule.showNotification === 'function') {
                        const avatarUrl = message.author.getAvatarURL?.() || message.author.avatar || '';
                        const guildName = guild?.name || 'Unknown Server';
                        const channelName = channel.name || 'Unknown Channel';
                        const content = message.content || 'Message with embed';
                        
                        NotificationModule.showNotification(
                            avatarUrl,
                            `${message.author.username} in #${channelName} (${guildName})`,
                            content,
                            {
                                sound: this.settings.notifications ? 'message1' : null,
                                onClick: () => {
                                    Logger.info("Notification clicked, navigating immediately...");
                                    this.navigateToChannel(message.guild_id || channel.guild_id, message.channel_id, message.id);
                                }
                            }
                        );
                    } else {
                        // Fallback notification using BdApi
                        BdApi.showToast(`Keyword found: ${message.author.username} in ${guild?.name || 'Server'}`, { 
                            type: "info",
                            timeout: 10000 // Show longer so user can see it
                        });
                    }

                    // Auto-navigate IMMEDIATELY if enabled (ignore cooldown for immediate response)
                    if (this.settings.autoNavigate) {
                        const now = Date.now();
                        const lastNav = this.settings.lastNavigateTime || 0;
                        const cooldown = this.settings.navigationCooldown || 5000;
                        
                        if ((now - lastNav) >= cooldown) {
                            Logger.info("Auto-navigating IMMEDIATELY due to keyword match");
                            
                            // Update the last navigation time
                            this.settings.lastNavigateTime = now;
                            this.saveSettings();
                            
                            // Navigate to the channel IMMEDIATELY - no setTimeout delay
                            const success = this.navigateToChannel(message.guild_id || channel.guild_id, message.channel_id);
                            
                            if (success) {
                                // Show a toast to confirm navigation
                                BdApi.showToast(`Navigated to keyword in #${channel.name}`, { 
                                    type: "success",
                                    timeout: 3000
                                });
                            } else {
                                Logger.error("Auto-navigation failed");
                                BdApi.showToast("Navigation failed - check console for details", { 
                                    type: "error",
                                    timeout: 5000
                                });
                            }
                        } else {
                            const remainingCooldown = Math.ceil((cooldown - (now - lastNav)) / 1000);
                            Logger.info(`Navigation on cooldown for ${remainingCooldown} seconds`);
                            BdApi.showToast(`Navigation on cooldown (${remainingCooldown}s remaining)`, { 
                                type: "warning",
                                timeout: 3000
                            });
                        }
                    }
                    
                } catch (error) {
                    Logger.error("Error in pingSuccess:", error);
                }
            }

            getSettingsPanel() {
                const panelElement = document.createElement("div");
                const { React, ReactDOM, FormTitle, FormText, FormDivider, Switch, TextInput, Button, Flex, Margins, GuildIcon, Text, GuildStore, GuildChannelsStore, ChannelTypes } = this.modules;

                const SettingsItem = ({ label, note, isNumber = false, value, onChange }) => {
                    return React.createElement('div', { style: { marginBottom: '20px' } },
                        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                            React.createElement(Text, { color: "header-primary", size: Text.Sizes?.SIZE_16, style: { fontWeight: '500' } }, label),
                            isNumber
                                ? React.createElement(TextInput, {
                                    type: "number",
                                    value: (value ?? 5000) / 1000,
                                    style: { width: '80px' },
                                    onChange: (e) => {
                                        const val = typeof e === 'string' ? e : e.target.value;
                                        const num = parseFloat(val);
                                        if (!isNaN(num)) {
                                            onChange(Math.max(0, Math.round(num * 1000)));
                                        }
                                    }
                                })
                                : React.createElement(Switch, { checked: !!value, onChange: onChange })
                        ),
                        note && React.createElement(FormText, { type: FormText.Types?.DESCRIPTION }, note)
                    );
                };

                const Panel = () => {
                    const [settings, setSettings] = React.useState(this.settings);
                    const [newKeyword, setNewKeyword] = React.useState("");
                    const [openGuilds, setOpenGuilds] = React.useState({});

                    const updateAndSave = (partialUpdate) => {
                        const newSettings = { ...settings, ...partialUpdate };
                        Object.assign(this.settings, newSettings);
                        this.saveSettings();
                        setSettings(newSettings);
                    };

                    const addKeyword = () => {
                        const trimmed = (newKeyword || "").trim();
                        if (trimmed && !(settings.keywords || []).includes(trimmed)) {
                            updateAndSave({ keywords: [...(settings.keywords || []), trimmed] });
                            setNewKeyword("");
                        }
                    };

                    const removeKeyword = (index) => {
                        const newKeywords = [...(settings.keywords || [])];
                        newKeywords.splice(index, 1);
                        updateAndSave({ keywords: newKeywords });
                    };

                    return React.createElement("div", { className: "keyword-tracker-settings", style: { padding: '20px' } },
                        React.createElement(FormTitle, { tag: "h2" }, "General Settings"),
                        React.createElement(SettingsItem, { label: "Enable Notification Sounds", note: "Plays a sound on keyword match.", value: settings.notifications, onChange: v => updateAndSave({ notifications: v }) }),
                        React.createElement(SettingsItem, { label: "Match Embed Content", note: "Search inside message embeds.", value: settings.allowEmbeds, onChange: v => updateAndSave({ allowEmbeds: v }) }),
                        React.createElement(SettingsItem, { label: "Allow Bot Messages", note: "Monitor messages from bots.", value: settings.allowBots, onChange: v => updateAndSave({ allowBots: v }) }),
                        React.createElement(SettingsItem, { label: "Allow Own Messages", note: "Monitor messages you send.", value: settings.allowSelf, onChange: v => updateAndSave({ allowSelf: v }) }),
                        React.createElement(SettingsItem, { label: "Auto-navigate to Channel", note: "Switch to the channel on match.", value: settings.autoNavigate, onChange: v => updateAndSave({ autoNavigate: v }) }),
                        React.createElement(SettingsItem, { label: "Navigation Cooldown (seconds)", note: "Wait time before auto-navigating.", isNumber: true, value: settings.navigationCooldown, onChange: v => updateAndSave({ navigationCooldown: v }) }),
                        React.createElement(FormDivider, { className: Margins.marginTop20 }),
                        React.createElement(FormTitle, { tag: "h2" }, "Keywords"),
                        React.createElement(Flex, { align: Flex.Align?.CENTER, style: { display: "flex", alignItems: "center", marginBottom: "10px" } },
                            React.createElement(TextInput, {
                                placeholder: "Add keyword (regex: /word/i)",
                                value: newKeyword,
                                style: { flexGrow: 1, marginRight: "10px" },
                                onChange: (e) => setNewKeyword(typeof e === 'string' ? e : e.target.value),
                                onKeyPress: e => e.key === 'Enter' && addKeyword()
                            }),
                            React.createElement(Button, { onClick: addKeyword }, "Add")
                        ),
                        (settings.keywords || []).map((keyword, index) => React.createElement("div", { key: index, className: "keyword-item" },
                            React.createElement(Text, { className: "keyword-text" }, keyword),
                            React.createElement(Button, { color: Button.Colors?.RED, look: Button.Looks?.LINK, onClick: () => removeKeyword(index) }, "Remove")
                        )),
                        React.createElement(FormDivider, { className: Margins.marginTop20 }),
                        React.createElement(FormTitle, { tag: "h2" }, "Server & Channel Settings"),
                        Object.values(GuildStore.getGuilds()).sort((a, b) => a.name.localeCompare(b.name)).map(guild => {
                            this.initializeGuildSettings(guild.id);
                            const guildSetting = settings.guilds?.[guild.id] || { enabled: true, channels: {} };
                            const channels = (GuildChannelsStore.getChannels(guild.id)?.SELECTABLE ?? []).map(c => c.channel).filter(c => c?.type === ChannelTypes.GUILD_TEXT).sort((a, b) => a.position - b.position);

                            return React.createElement("div", { key: guild.id, className: Margins.marginBottom20 },
                                React.createElement("div", { className: "guild-row", style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', cursor: 'pointer' }, className: "guild-header", onClick: () => setOpenGuilds(p => ({ ...p, [guild.id]: !p[guild.id] })) },
                                        GuildIcon ? React.createElement(GuildIcon, { guild: guild, size: GuildIcon.Sizes?.MEDIUM ?? 32 }) : React.createElement("div", { style: { width: "32px", height: "32px", backgroundColor: "var(--background-secondary)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" } }, guild.name.charAt(0)),
                                        React.createElement(Text, { style: { marginLeft: '10px' } }, guild.name)
                                    ),
                                    React.createElement(Switch, {
                                        checked: guildSetting.enabled,
                                        onChange: checked => {
                                            const newSettings = { ...settings };
                                            if (!newSettings.guilds[guild.id]) newSettings.guilds[guild.id] = { channels: {} };
                                            newSettings.guilds[guild.id].enabled = checked;
                                            updateAndSave(newSettings);
                                        }
                                    })
                                ),
                                openGuilds[guild.id] && React.createElement("div", { className: "channel-list", style: { marginLeft: '42px', marginTop: '8px' } }, channels.map(channel => React.createElement("div", { key: channel.id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' } },
                                    React.createElement(Text, null, `# ${channel.name}`),
                                    React.createElement(Switch, {
                                        checked: guildSetting.channels?.[channel.id] !== false,
                                        onChange: checked => {
                                            const newSettings = { ...settings };
                                            if (!newSettings.guilds[guild.id].channels) newSettings.guilds[guild.id].channels = {};
                                            newSettings.guilds[guild.id].channels[channel.id] = checked;
                                            updateAndSave(newSettings);
                                        }
                                    })
                                )))
                            );
                        })
                    );
                };

                if (ReactDOM.createRoot) {
                    this.root = ReactDOM.createRoot(panelElement);
                    this.root.render(React.createElement(Panel));
                } else {
                    ReactDOM.render(React.createElement(Panel), panelElement);
                    this._settingsPanel = panelElement;
                }

                return panelElement;
            }

            loadSettings() {
                this.settings = Utilities.loadSettings(this.getName(), defaultSettings);
            }

            saveSettings() {
                Utilities.saveSettings(this.getName(), this.settings);
            }
        };
    };
    return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));

/*@end@*/
