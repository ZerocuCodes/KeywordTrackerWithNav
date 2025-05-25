/**
 * @name KeywordTracker
 * @description Be notified when a message matches a keyword and auto-navigate to its channel
 * @version 1.7.2
 * @author sawahkitty!~<3
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
        authors: [
            {
                name: "sawahkitty!~<3",
                discord_id: "135895345296048128",
                github_username: "sarahkittyy",
                twitter_username: "snuggleskittyy"
            }
        ],
        version: "1.7.2",
        description: "Be notified when a message matches a keyword and auto-navigate to its channel",
        github: "https://github.com/sarahkittyy/KeywordTracker",
        github_raw: "https://raw.githubusercontent.com/sarahkittyy/KeywordTracker/main/KeywordTracker.plugin.js",
        authorLink: "https://github.com/sarahkittyy",
        inviteCode: "0Tmfo5ZbORCRqbAd",
        paypalLink: "https://paypal.me/sarahkittyy",
        updateUrl: "https://raw.githubusercontent.com/sarahkittyy/KeywordTracker/main/KeywordTracker.plugin.js"
    },
    changelog: [
        {
            title: "v1.7.2",
            items: [
                "Fixed Discord client crash issues",
                "Updated navigation methods for compatibility",
                "Improved settings panel robustness",
                "Enhanced error handling throughout",
                "Fixed syntax errors in date formatting and comments"
            ]
        },
        {
            title: "v1.7.1",
            items: [
                "Added 5-second cooldown for auto-navigation",
                "Fixed case sensitivity issues with keywords",
                "Improved performance with frequently occurring keywords"
            ]
        },
        {
            title: "v1.7.0",
            items: [
                "Added auto-navigation to channel with keywords",
                "Added toggle for auto-navigation in settings"
            ]
        }
    ],
    main: "index.js"
};

class Dummy {
    constructor() { this._config = config; }
    start() {}
    stop() {}
}

if (!global.ZeresPluginLibrary) {
    BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.name ?? config.info.name} is missing. Please click Download Now to install it.`, {
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
        const switchCss = `
.switch input {
    position: absolute;
    opacity: 0;
}
.switch {
    display: inline-block;
    font-size: 20px;
    height: 1em;
    width: 2em;
    background: #ADD8E6;
    border-radius: 1em;
}
.switch div {
    height: 1em;
    width: 1em;
    border-radius: 1em;
    background: #FFF;
    box-shadow: 0 0.1em 0.3em rgba(0,0,0,0.3);
    transition: all 300ms;
}
.switch input:checked + div {
    transform: translate3d(100%, 0, 0);
}
`;

        const inboxCss = `
.kt-inbox-entry {
    padding: 5px;
    color: var(--text-normal);
}
.kt-inbox-entry:not(:last-child) {
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--background-secondary-alt);
}
.kt-spacer {
    flex: 1;
}
.kt-entry-row {
    display: flex;
    align-items: center;
    gap: 8px;
}
.kt-usericon {
    border-radius: 50%;
    width: 24px;
    height: 24px;
}
.kt-username {
    color: var(--text-normal);
    margin-left: -2px;
}
.kt-channel-container {
    width: 95%;
    margin-left: 2.5%;
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
}
.kt-channel-name {
    color: var(--header-primary);
    font-size: 16px;
}
.kt-timestamp {
    color: var(--text-muted);
    font-size: .75rem;
}
.kt-content {
    padding: 8px 0 5px;
    line-height: 1.25rem;
}
.kt-matched {
    color: var(--text-muted);
    font-size: .75rem;
    display: flex;
    align-items: center;
}
.kt-matched > code {
    background-color: var(--background-secondary);
    font-size: .75rem;
    border: 1px solid var(--background-tertiary);
    border-radius: 4px;
    padding: 3px 5px;
    margin-left: 3px;
    color: var(--text-secondary);
    max-width: 250px;
    display: inline-block;
    text-overflow: ellipsis;
}
.kt-button {
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    background-color: var(--background-secondary-alt);
    transition: background-color .2s;
}
.kt-button:hover {
    background-color: var(--background-tertiary);
}
.kt-button path {
    transition: fill .2s;
}
.kt-button:hover path {
    fill: var(--interactive-active);
}
`;

        const iconSVG = `<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12,73.51q.2-34.74.39-69.38A3.21,3.21,0,0,1,15,1h0C23.4-.75,36.64-.31,45.63,3.14a35.46,35.46,0,0,1,16,11.65,37.34,37.34,0,0,1,16-11.15C86.12.4,99-.38,108.23,1A3.2,3.2,0,0,1,111,4.14h0V73.8A3.21,3.21,0,0,1,107.77,77a3.49,3.49,0,0,1-.74-.09A53.45,53.45,0,0,0,83.58,79.1a71,71,0,0,0-15.77,8.26,69.09,69.09,0,0,1,21.24-3.1,125.42,125.42,0,0,1,27.41,3.48V14.84h3.21a3.21,3.21,0,0,1,3.21,3.21V91.94a3.21,3.21,0,0,1-3.21,3.21,3.18,3.18,0,0,1-1-.17A121.77,121.77,0,0,0,89,90.65a61.89,61.89,0,0,0-25.76,5.26,3.39,3.39,0,0,1-3.64,0,61.86,61.86,0,0,0-25.76-5.26A121.77,121.77,0,0,0,4.24,95a3.18,3.18,0,0,1-1,.17A3.21,3.21,0,0,1,0,91.94V18.05a3.21,3.21,0,0,1,3.21-3.21H6.42v72.9a125.42,125.42,0,0,1,27.41-3.48,68.84,68.84,0,0,1,22.71,3.57A48.7,48.7,0,0,0,41,79.39c-7-2.3-17.68-3.07-25.49-2.4A3.21,3.21,0,0,1,12,74.06a5,5,0,0,1,0-.55ZM73.64,64.4a2.3,2.3,0,1,1-2.5-3.85,51.46,51.46,0,0,1,11.8-5.4,53.73,53.73,0,0,1,13-2.67,2.29,2.29,0,1,1,.25,4.58,49.42,49.42,0,0,0-11.79,2.46A46.73,46.73,0,0,0,73.64,64.4Zm.2-17.76a2.29,2.29,0,0,1-2.46-3.87,52.71,52.71,0,0,1,11.74-5.3A54.12,54.12,0,0,1,95.9,34.85a2.3,2.3,0,0,1,.25,4.59,49.3,49.3,0,0,0-11.63,2.4,48,48,0,0,0-10.68,4.8Zm.06-17.7a2.3,2.3,0,1,1-2.46-3.89,52.54,52.54,0,0,1,11.72-5.27,53.71,53.71,0,0,1,12.74-2.6,2.29,2.29,0,1,1,.25,4.58,49.35,49.35,0,0,0-11.59,2.39A47.91,47.91,0,0,0,73.9,28.94ZM51.74,60.55a2.3,2.3,0,1,1-2.5,3.85,46.73,46.73,0,0,0-10.72-4.88,49.42,49.42,0,0,0-11.79-2.46A2.29,2.29,0,1,1,27,52.48a53.73,53.73,0,0,1,13,2.67,51.46,51.46,0,0,1,11.8,5.4ZM51.5,42.77A2.29,2.29,0,0,1,49,46.64a48,48,0,0,0-10.68-4.8,49.3,49.3,0,0,0-11.63-2.4A2.3,2.3,0,0,1,27,34.85a54.12,54.12,0,0,1,12.78,2.62,52.71,52.71,0,0,1,11.74,5.3Zm-.06-17.72A2.3,2.3,0,1,1,49,28.94a47.91,47.91,0,0,0-10.66-4.79,49.35,49.35,0,0,0-11.59-2.39A2.29,2.29,0,1,1,27,17.18a53.71,53.71,0,0,1,12.74,2.6,52.54,52.54,0,0,1,11.72,5.27ZM104.56,7c-7.42-.7-18.06.12-24.73,2.65A30,30,0,0,0,64.7,21.46V81.72a76.76,76.76,0,0,1,16.72-8.66,62.85,62.85,0,0,1,23.14-2.87V7ZM58.28,81.1V21.37c-3.36-5.93-8.79-9.89-14.93-12.24-7-2.67-17.75-3.27-24.56-2.3l-.36,63.56c7.43-.27,17.69.68,24.52,2.91a54.94,54.94,0,0,1,15.33,7.8Z"/>`;

        const defaultSettings = {
            whitelistedUsers: [],
            keywords: [],
            ignoredUsers: [],
            guilds: {},
            enabled: true,
            unreadMatches: {},
            notifications: true,
            allowSelf: false,
            allowEmbeds: true,
            allowBots: true,
            markJumpedRead: false,
            autoNavigate: true,
            lastNavigateTime: 0,
            navigationCooldown: 5000
        };

        const {
            ReactTools,
            Logger,
            Settings,
            Utilities,
            PluginUtilities,
            Modals,
            Tooltip,
            Toasts: Toast,
            DiscordModules: Modules
        } = Library;
        const {
            Patcher,
            Webpack,
            DOM,
            ReactUtils,
            React,
            UI
        } = BdApi;

        const NotificationModule = Webpack.getByKeys("showNotification");
        const ButtonData = Webpack.getByKeys("ButtonColors");
        const GuildStore = Webpack.getStore("GuildStore");
        const GuildChannelsStore = Webpack.getStore("GuildChannelsStore");

        const RegexEscape = function(string) {
            return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        };

        const log = (...args) => {
            Logger.info(...args);
        };

        return class KeywordTracker extends Plugin {
            async onStart() {
                try {
                    PluginUtilities.addStyle(this.getName(), switchCss);
                    PluginUtilities.addStyle(this.getName(), inboxCss);
                    this.loadSettings();
                    this.inboxPanel = null;

                    let dispatchModule = Webpack.getByKeys('dispatch', 'subscribe');
                    Patcher.after(this.getName(), dispatchModule, 'dispatch', this.handleMessage.bind(this));

                    const toolbarModule = Webpack.getByKeys("ToolbarContainer");
                    if (toolbarModule) {
                        Patcher.after(this.getName(), toolbarModule, "default", (thisObj, [props], ret) => {
                            if (!ret || !ret.props || !ret.props.children) return;
                            if (this.inboxPanel == null) {
                                this.inboxPanel = this.buildInboxPanel();
                            }
                            if (!Array.isArray(ret.props.children)) return;
                            let idx = ret.props.children.length - 1;
                            ret.props.children.splice(idx, 0, this.inboxPanel);
                        });
                    }

                    this.userId = Modules.UserStore.getCurrentUser()?.id;
                } catch (e) {
                    Logger.error(`Error in onStart: ${e}`);
                }
            }

            onStop() {
                try {
                    this.saveSettings();
                    Patcher.unpatchAll(this.getName());
                    PluginUtilities.removeStyle(this.getName());
                } catch (e) {
                    Logger.error(`Error in onStop: ${e}`);
                }
            }

            objectValues(object) {
                if (!object) return [];
                const res = [];
                for (const [k, v] of Object.entries(object)) {
                    if (typeof v === 'object' && v !== null) {
                        res.push(...this.objectValues(v));
                    } else {
                        res.push(v);
                    }
                }
                return res;
            }

            handleMessage(_, args) {
                try {
                    const guilds = Object.values(GuildStore.getGuilds() || {});
                    let event = args[0];
                    if (event.type !== 'MESSAGE_CREATE') return;
                    let { message } = event;
                    let channel = Modules.ChannelStore.getChannel(message.channel_id);
                    if (!message.author) {
                        message = Modules.MessageStore.getMessage(channel.id, message.id);
                        if (!message || !message.author) return;
                    }
                    if (this.settings.allowSelf === false && message.author.id === this.userId) return;
                    if (this.settings.ignoredUsers.includes(message.author.id)) return;

                    if (!message.content && (!message.embeds || message.embeds.length === 0)) return;
                    if (message.author.bot && !this.settings.allowBots) return;
                    if (event.optimistic === true) return;

                    if (!channel.guild_id) return;
                    if (!message.guild_id) message.guild_id = channel.guild_id;

                    if (this.settings.guilds[channel.guild_id] == null) {
                        let g = guilds.find(g => g.id === channel.guild_id);
                        if (!g) return;
                        this.settings.guilds[g.id] = {
                            channels: g.channels
                                ?.filter(c => c.type === 'GUILD_TEXT')
                                .reduce((obj, c) => {
                                    obj[c.id] = true;
                                    return obj;
                                }, {}) || {},
                            enabled: true
                        };
                        this.saveSettings();
                    }

                    if (!this.settings.guilds[channel.guild_id].channels[channel.id]) return;

                    let whitelistedUserFound = !this.settings.whitelistedUsers.every((userId) => {
                        if (message.author.id === userId) {
                            const guild = guilds.find(g => g.id === channel.guild_id);
                            this.pingWhitelistMatch(message, channel, guild?.name || 'Unknown Guild');
                            return false;
                        }
                        return true;
                    });

                    if (whitelistedUserFound) {
                        return;
                    }

                    this.settings.keywords.every((keyword) => {
                        let regex = undefined;
                        let filter = undefined;
                        let isFiltered = /^([@#]?)(\d+):(.*)$/g.exec(keyword);
                        if (isFiltered != null) {
                            filter = {
                                type: isFiltered[1],
                                id: isFiltered[2],
                            };
                            keyword = isFiltered[3];
                        }
                        let isSlashRegex = /^\/(.*)\/([a-z]*)$/g.exec(keyword);
                        if (isSlashRegex != null) {
                            let text = isSlashRegex[1];
                            let flags = isSlashRegex[2];
                            regex = new RegExp(text, flags);
                        } else {
                            regex = new RegExp(RegexEscape(keyword), 'i');
                        }

                        if (filter != undefined && !this.passesFilter(filter, message)) {
                            return true;
                        }

                        if (regex.test(message.content) || (
                            message.embeds &&
                            this.settings.allowEmbeds &&
                            regex.test(JSON.stringify(this.objectValues(message.embeds)))
                        )) {
                            let guild = guilds.find(g => g.id === channel.guild_id);
                            this.pingSuccess(message, channel, guild?.name || 'Unknown Guild', regex);
                            return false;
                        }
                        return true;
                    });
                } catch (e) {
                    Logger.error(`Error in handleMessage: ${e}`);
                }
            }

            passesFilter({ type, id }, message) {
                switch (type) {
                    case '@':
                        return message.author.id === id;
                    case '#':
                        return message.channel_id === id;
                    case '':
                        return message.guild_id === id;
                    default:
                        return false;
                }
            }

            sendMatchNotification(thumbnail, title, text, redirect, message) {
                try {
                    const fullRedirect = redirect;
                    const channelRedirect = `/channels/${message.guild_id}/${message.channel_id}`;

                    NotificationModule.showNotification(
                        thumbnail,
                        title,
                        text,
                        {},
                        {
                            sound: this.settings.notifications ? 'message1' : null,
                            onClick: () => {
                                if (this.settings.markJumpedRead) {
                                    delete this.settings.unreadMatches[message.id];
                                }
                                this.saveSettings();
                                if (Modules.NavigationUtils) {
                                    Modules.NavigationUtils.transitionTo(fullRedirect);
                                }
                            }
                        }
                    );

                    const currentTime = Date.now();
                    const timeSinceLastNavigate = currentTime - this.settings.lastNavigateTime;

                    if (this.settings.autoNavigate && timeSinceLastNavigate >= this.settings.navigationCooldown) {
                        this.settings.lastNavigateTime = currentTime;

                        if (this.settings.markJumpedRead) {
                            delete this.settings.unreadMatches[message.id];
                        }
                        this.saveSettings();

                        if (Modules.NavigationUtils) {
                            Modules.NavigationUtils.transitionTo(channelRedirect);
                        }

                        if (this.settings.navigationCooldown > 0) {
                            Toast.show(`Auto-navigated to channel. Next navigation available in ${this.settings.navigationCooldown/1000} seconds.`, {
                                type: "info",
                                timeout: 3000
                            });
                        }
                    } else if (this.settings.autoNavigate) {
                        const remainingCooldown = Math.ceil((this.settings.navigationCooldown - timeSinceLastNavigate) / 1000);
                        Toast.show(`Auto-navigation on cooldown. Available in ${remainingCooldown} seconds.`, {
                            type: "info",
                            timeout: 2000
                        });
                    }
                } catch (e) {
                    Logger.error(`Error in sendMatchNotification: ${e}`);
                }
            }

            pingWhitelistMatch(message, channel, guild) {
                log('Whitelist match found!');
                const avatarURL = this.getAvatarUrl(message.author);

                this.sendMatchNotification(
                    avatarURL,
                    `User match in ${guild}!`,
                    `${message.author.username} typed in #${channel.name}.`,
                    `/channels/${message.guild_id}/${channel.id}/${message.id}`,
                    message
                );
                message._match = `User ID ${message.author.id}`;
                this.settings.unreadMatches[message.id] = message;
                this.saveSettings();
            }

            pingSuccess(message, channel, guild, match) {
                log('Match found!');
                const avatarURL = this.getAvatarUrl(message.author);

                this.sendMatchNotification(
                    avatarURL,
                    `Keyword match in ${guild}!`,
                    `${message.author.username} matched ${match} in #${channel.name}.`,
                    `/channels/${message.guild_id}/${channel.id}/${message.id}`,
                    message
                );
                message._match = `${match}`;
                this.settings.unreadMatches[message.id] = message;
                this.saveSettings();
            }

            makeSwitch(iv, callback) {
                let label = document.createElement('label');
                label.className = 'switch';
                let input = document.createElement('input');
                input.setAttribute('type', 'checkbox');
                input.checked = iv;
                let div = document.createElement('div');
                label.append(input);
                label.append(div);
                input.addEventListener('input', function(e) {
                    callback(this.checked);
                });
                return label;
            }

            getAvatarUrl(user) {
                if (!user) return '';
                return user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=256`
                    : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;
            }

            buildInboxPanel() {
                try {
                    const button = document.createElement('div');
                    button.className = 'keyword-tracker-button';
                    button.setAttribute('is-keyword-tracker-inbox', true);
                    button.setAttribute('aria-label', 'Keyword Matches');
                    button.setAttribute('role', 'button');
                    button.setAttribute('tabindex', '0');

                    button.style.display = 'flex';
                    button.style.justifyContent = 'center';
                    button.style.alignItems = 'center';
                    button.style.width = '24px';
                    button.style.height = '24px';
                    button.style.margin = '0 8px';
                    button.style.cursor = 'pointer';

                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('viewBox', '0 0 122 96');
                    svg.setAttribute('width', '24');
                    svg.setAttribute('height', '24');
                    svg.innerHTML = iconSVG;
                    svg.style.color = 'var(--interactive-normal)';

                    button.appendChild(svg);

                    button.addEventListener('mouseenter', () => {
                        svg.style.color = 'var(--interactive-hover)';
                    });

                    button.addEventListener('mouseleave', () => {
                        svg.style.color = 'var(--interactive-normal)';
                    });

                    try {
                        new Tooltip(button, 'Keyword Matches');
                    } catch (e) {
                        Logger.error(`Tooltip creation failed: ${e}`);
                    }

                    const ModalCloseEvent = new Event('modalclose');

                    const openModal = () => {
                        try {
                            const closeModal = () => {
                                try {
                                    const closeButton = document.querySelector('.bd-modal-footer button');
                                    if (closeButton) closeButton.click();
                                } catch (e) {
                                    Logger.error(`Close modal error: ${e}`);
                                }
                            };

                            this.showModal('Keyword Matches', this.renderInbox(closeModal), {
                                confirmText: 'Close',
                                cancelText: 'Mark as Read',
                                onCancel: () => {
                                    this.settings.unreadMatches = {};
                                    this.saveSettings();
                                },
                                onConfirm: () => {
                                    this.saveSettings();
                                }
                            });

                            button.removeEventListener('modalclose', closeModal);
                            button.addEventListener('modalclose', closeModal);
                        } catch (e) {
                            Logger.error(`Error opening modal: ${e}`);
                        }
                    };

                    button.removeEventListener('click', openModal);
                    button.addEventListener('click', openModal);

                    return ReactTools.createWrappedElement(button);
                } catch (e) {
                    Logger.error(`Error building inbox panel: ${e}`);
                    return null;
                }
            }

            renderInbox(closeModal) {
                try {
                    let root = document.createElement('div');
                    root.className = 'kt-inbox-container';

                    const styleEl = document.createElement('style');
                    styleEl.textContent = `
                        .kt-inbox-container {
                            max-height: 400px;
                            overflow-y: auto;
                            padding: 10px;
                        }
                        .kt-content {
                            word-break: break-word;
                            overflow-wrap: break-word;
                        }
                    `;
                    root.appendChild(styleEl);

                    const EntryFlushEvent = new Event('entryflush');

                    const setupEntries = () => {
                        try {
                            const validMatches = Object.values(this.settings.unreadMatches || {})
                                .filter(msg => msg && msg.timestamp);

                            let sortedMatches = validMatches
                                .sort((a, b) => {
                                    try {
                                        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                                    } catch (e) {
                                        return 0;
                                    }
                                })
                                .filter(msg => {
                                    try {
                                        let timeDiff = Math.abs(new Date(msg.timestamp).getTime() - new Date().getTime());
                                        let daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                        return daysDiff <= 60;
                                    } catch (e) {
                                        return false;
                                    }
                                });

                            Array.from(root.children)
                                .filter(child => !child.tagName || child.tagName.toLowerCase() !== 'style')
                                .forEach(child => root.removeChild(child));

                            if (sortedMatches.length === 0) {
                                const noMatches = document.createElement('div');
                                noMatches.textContent = 'No recent matches.';
                                noMatches.style.lineHeight = '90px';
                                noMatches.style.textAlign = 'center';
                                noMatches.style.color = 'var(--text-normal)';
                                root.appendChild(noMatches);
                            } else {
                                for (let msg of sortedMatches) {
                                    root.appendChild(this.createMatchEntry(msg, closeModal));
                                }
                            }
                        } catch (e) {
                            Logger.error(`Error in setupEntries: ${e}`);
                            const errorDiv = document.createElement('div');
                            errorDiv.textContent = 'Error loading matches. Please check console for details.';
                            errorDiv.style.color = 'var(--text-danger)';
                            errorDiv.style.padding = '10px';
                            root.appendChild(errorDiv);
                        }
                    };

                    setupEntries();

                    root.addEventListener('entryflush', () => {
                        setupEntries();
                    });

                    return ReactTools.createWrappedElement(root);
                } catch (e) {
                    Logger.error(`Error rendering inbox: ${e}`);
                    const errorDiv = document.createElement('div');
                    errorDiv.textContent = 'Error rendering inbox. Check console for details.';
                    return ReactTools.createWrappedElement(errorDiv);
                }
            }

            createMatchEntry(msg, closeModal) {
                try {
                    if (!msg || !msg.author) {
                        Logger.error("Invalid message in createMatchEntry:", msg);
                        return document.createElement('div');
                    }

                    const entry = document.createElement('div');
                    entry.className = 'kt-inbox-entry';

                    const avatarUrl = this.getAvatarUrl(msg.author);

                    entry.innerHTML = `
                        <div class="kt-entry-row">
                            <img class="kt-usericon" src="${avatarUrl}" />
                            <span class="kt-username"></span>
                            <span class="kt-timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="kt-content"></div>
                        <div class="kt-entry-row">
                            <span class="kt-matched">Matched <code></code></span>
                            <span class="kt-spacer"></span>
                            <div class="kt-button kt-read">
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M21.7 5.3a1 1 0 0 1 0 1.4l-12 12a1 1 0 0 1-1.4 0l-6-6a1 1 0 1 1 1.4-1.4L9 16.58l11.3-11.3a1 1 0 0 1 1.4 0Z"></path></svg>
                            </div>
                            <div class="kt-button kt-jump">
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M15 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V4.41l-4.3 4.3a1 1 0 1 1-1.4-1.42L19.58 3H16a1 1 0 0 1-1-1Z" class=""></path><path fill="currentColor" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6a1 1 0 1 0-2 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 1 0 0-2H5Z"></path></svg>
                            </div>
                        </div>
                    `;

                    const usernameEl = entry.querySelector('.kt-username');
                    if (usernameEl) usernameEl.textContent = msg.author.username || 'Unknown User';

                    const contentEl = entry.querySelector('.kt-content');
                    if (contentEl) contentEl.textContent = msg.content || '';

                    const matchedEl = entry.querySelector('.kt-matched > code');
                    if (matchedEl) matchedEl.textContent = msg._match || 'unknown';

                    try {
                        let read_btn = entry.querySelector('.kt-read');
                        if (read_btn) {
                            new Tooltip(read_btn, 'Mark as read');
                            read_btn.addEventListener('click', e => {
                                delete this.settings.unreadMatches[msg.id];
                                this.saveSettings();
                                entry.parentNode.dispatchEvent(new Event('entryflush'));
                            });
                        }

                        let jump_btn = entry.querySelector('.kt-jump');
                        if (jump_btn) {
                            new Tooltip(jump_btn, 'Jump to message');
                            jump_btn.addEventListener('click', e => {
                                if (this.settings.markJumpedRead) {
                                    delete this.settings.unreadMatches[msg.id];
                                }
                                this.saveSettings();
                                closeModal();
                                if (Modules.NavigationUtils) {
                                    Modules.NavigationUtils.transitionTo(
                                        `/channels/${msg.guild_id}/${msg.channel_id}/${msg.id}`
                                    );
                                }
                            });
                        }
                    } catch (e) {
                        Logger.error(`Error setting up button events: ${e}`);
                    }

                    return entry;
                } catch (e) {
                    Logger.error(`Error creating match entry: ${e}`);
                    return document.createElement('div');
                }
            }

            getSettingsPanel() {
                try {
                    return this.buildSettings().getElement();
                } catch (e) {
                    Logger.error(`Error building settings panel: ${e}`);
                    const errorDiv = document.createElement('div');
                    errorDiv.textContent = 'Error loading settings panel. Check console for details.';
                    errorDiv.style.color = 'var(--text-danger)';
                    errorDiv.style.padding = '20px';
                    return errorDiv;
                }
            }

            saveSettings() {
                try {
                    if (Array.isArray(this.settings.keywords)) {
                        this.settings.keywords = this.settings.keywords.filter((v) => v && v.trim && v.trim().length > 0);
                    } else {
                        this.settings.keywords = [];
                    }

                    if (this.settings.unreadMatches) {
                        for (const key in this.settings.unreadMatches) {
                            try {
                                JSON.stringify(this.settings.unreadMatches[key]);
                            } catch (e) {
                                delete this.settings.unreadMatches[key];
                                Logger.warn(`Removed unserializable message from unreadMatches: ${key}`);
                            }
                        }
                    }

                    PluginUtilities.saveSettings('KeywordTracker', this.settings);
                } catch (e) {
                    Logger.error(`Error saving settings: ${e}`);
                    Toast.show('Failed to save settings. Check console for details.', {
                        type: 'error',
                        timeout: 5000
                    });
                }
            }

            loadSettings() {
                try {
                    this.settings = Utilities.deepclone(PluginUtilities.loadSettings('KeywordTracker', defaultSettings));

                    if (this.settings.lastNavigateTime === undefined) {
                        this.settings.lastNavigateTime = 0;
                    }
                    if (this.settings.navigationCooldown === undefined) {
                        this.settings.navigationCooldown = 5000;
                    }
                    if (this.settings.autoNavigate === undefined) {
                        this.settings.autoNavigate = true;
                    }
                    if (!Array.isArray(this.settings.keywords)) {
                        this.settings.keywords = [];
                    }
                    if (!Array.isArray(this.settings.whitelistedUsers)) {
                        this.settings.whitelistedUsers = [];
                    }
                    if (!Array.isArray(this.settings.ignoredUsers)) {
                        this.settings.ignoredUsers = [];
                    }
                    if (typeof this.settings.unreadMatches !== 'object' || this.settings.unreadMatches === null) {
                        this.settings.unreadMatches = {};
                    }
                    if (typeof this.settings.guilds !== 'object' || this.settings.guilds === null) {
                        this.settings.guilds = {};
                    }
                } catch (e) {
                    Logger.error(`Error loading settings: ${e}`);
                    this.settings = Utilities.deepclone(defaultSettings);
                }
            }

            showModal(title, children, options = {}) {
                try {
                    const {
                        danger = false,
                        confirmText = "Okay",
                        cancelText = "Cancel",
                        onConfirm = () => {},
                        onCancel = () => {}
                    } = options;

                    return UI.showConfirmationModal(
                        title,
                        children,
                        {
                            danger: danger,
                            confirmText: confirmText,
                            cancelText: cancelText,
                            onConfirm: onConfirm,
                            onCancel: onCancel
                        }
                    );
                } catch (e) {
                    Logger.error(`Modal error: ${e}`);
                    Toast.show('Error showing modal. Check console for details.', {
                        type: 'error',
                        timeout: 3000
                    });
                    return null;
                }
            }

            buildSettings() {
                try {
                    const { Textbox, SettingPanel, SettingGroup, Keybind, SettingField } = Settings;

                    let guilds = [];
                    try {
                        if (GuildStore && GuildStore.getGuilds) {
                            guilds = Object.values(GuildStore.getGuilds())
                                .sort((a, b) => `${a.id}`.localeCompare(`${b.id}`));
                            guilds = guilds.map(g => {
                                try {
                                    if (GuildChannelsStore && GuildChannelsStore.getChannels) {
                                        const channelData = GuildChannelsStore.getChannels(g.id);
                                        g.channels = channelData?.SELECTABLE?.map(c => c.channel)
                                            .filter(c => c && c.id) || [];
                                    } else {
                                        g.channels = [];
                                    }
                                } catch (channelErr) {
                                    Logger.error(`Error getting channels for guild ${g.id}: ${channelErr}`);
                                    g.channels = [];
                                }
                                return g;
                            });
                        }
                    } catch (guildErr) {
                        Logger.error(`Error getting guilds: ${guildErr}`);
                    }

                    const { parseHTML } = DOM;
                    const GuildFlushEvent = new Event('guildflushevent');

                    let panel = new SettingPanel();
                    let keywords = new SettingGroup('Keywords');
                    panel.append(keywords);

                    let tip = new SettingField('', 'One keyword per line. Regex syntax allowed, eg. /sarah/i. Keywords are case-insensitive by default unless using regex. You can filter to specific users, channels, or servers. Examples:', null, document.createElement('div'));
                    keywords.append(tip);
                    let tip2 = new SettingField('', '@12345678:Keyword watches for "Keyword" from user id 12345678 (Right click user -> Copy User ID, requires developer mode)', null, document.createElement('div'));
                    keywords.append(tip2);
                    let tip3 = new SettingField('', '#442312345:/case-insensitive/i watches messages in channel id 442312345 (Right click channel -> Copy Channel ID, requires developer mode)', null, document.createElement('div'));
                    keywords.append(tip3);
                    let tip4 = new SettingField('', '1239871234:/\d+/i watches numbers from server id 1239871234 (Right click server -> Copy Server ID, requires developer mode)', null, document.createElement('div'));
                    keywords.append(tip4);

                    let textbox = document.createElement('textarea');
                    textbox.value = this.settings.keywords.join('\n');
                    textbox.addEventListener('change', () => {
                        this.settings.keywords = textbox.value.split('\n');
                        this.saveSettings();
                    });
                    textbox.setAttribute('rows', '8');
                    textbox.style.width = '95%';
                    textbox.style.resize = 'none';
                    textbox.style.marginLeft = '2.5%';
                    textbox.style.borderRadius = '3px';
                    textbox.style.border = '2px solid grey';
                    textbox.style.backgroundColor = '#ddd';
                    textbox.style.color = '#000';
                    textbox.style.padding = '8px';
                    textbox.style.fontFamily = 'monospace';
                    keywords.append(textbox);

                    let channels = new SettingGroup('Channels');
                    panel.append(channels);

                    if (this.settings.enabled == null) {
                        this.settings.enabled = true;
                    }

                    let masstoggleSwitch = this.makeSwitch(this.settings.enabled, (v) => {
                        this.settings.enabled = v;
                        for (let gid in this.settings.guilds) {
                            if (this.settings.guilds[gid]) {
                                this.settings.guilds[gid].enabled = v;
                                if (this.settings.guilds[gid].channels) {
                                    for (let cid in this.settings.guilds[gid].channels) {
                                        this.settings.guilds[gid].channels[cid] = v;
                                    }
                                }
                            }
                        }
                        groups.forEach(g => g());
                        this.saveSettings();
                    });

                    let masstoggle = new SettingField('', 'Toggle every single guild and channel on / off (careful!)', null, masstoggleSwitch, { noteOnTop: true });
                    channels.append(masstoggle);

                    var groups = [];

                    if (guilds.length > 0) {
                        guilds.forEach(g => {
                            if (!g || !g.id) return;

                            let guildGroup = new SettingGroup(g.name || `Guild ${g.id}`);
                            guildGroup.getElement().style.minHeight = '34px';
                            groups.push(() => guildGroup.getElement().dispatchEvent(GuildFlushEvent));

                            if (g.icon != null) {
                                try {
                                    let thumbnail = parseHTML(
                                        `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=256}" alt="${g.name}" />`
                                    );
                                    thumbnail.style.width = '32px';
                                    thumbnail.style.height = '32px';
                                    thumbnail.style.float = 'left';
                                    thumbnail.style.borderRadius = '50%';
                                    thumbnail.style.align = 'left';
                                    channels.append(thumbnail);
                                } catch (iconErr) {
                                    Logger.error(`Error creating guild icon: ${iconErr}`);
                                    guildGroup.getElement().style.paddingLeft = '16px';
                                }
                            } else {
                                guildGroup.getElement().style.paddingLeft = '16px';
                            }

                            if (!this.settings.guilds[g.id]) {
                                this.settings.guilds[g.id] = {
                                    channels: {},
                                    enabled: true
                                };
                            }

                            if (g.channels && g.channels.length > 0) {
                                g.channels.forEach(c => {
                                    if (c && c.id && !this.settings.guilds[g.id].channels[c.id]) {
                                        this.settings.guilds[g.id].channels[c.id] = true;
                                    }
                                });
                            }

                            if (this.settings.guilds[g.id].enabled == null) {
                                this.settings.guilds[g.id].enabled = true;
                            }

                            let guildSwitch = this.makeSwitch(this.settings.guilds[g.id].enabled, (v) => {
                                this.settings.guilds[g.id].enabled = v;
                                for (let cid in this.settings.guilds[g.id].channels) {
                                    this.settings.guilds[g.id].channels[cid] = v;
                                }
                                guildGroup.getElement().dispatchEvent(GuildFlushEvent);
                                this.saveSettings();
                            });
                            guildSwitch.style.marginLeft = '4px';
                            if (g.icon == null) {
                                guildSwitch.style.marginLeft = '36px';
                            }
                            guildGroup.getElement().addEventListener('guildflushevent', () => {
                                guildSwitch.firstElementChild.checked = this.settings.guilds[g.id].enabled;
                            }, false);

                            channels.append(guildSwitch);
                            channels.append(guildGroup);

                            let channelLoader = () => {
                                if (g.channels && g.channels.length > 0) {
                                    g.channels.forEach((c, i) => {
                                        if (!c || !c.id) return;
                                        let status = this.settings.guilds[g.id].channels[c.id];
                                        if (status == null) {
                                            Logger.warn(`channel ${c.id} of guild ${g.id} doesn't exist. creating it.`);
                                            this.settings.guilds[g.id].channels[c.id] = true;
                                        }
                                        let channelSwitch = this.makeSwitch(status, (v) => {
                                            this.settings.guilds[g.id].channels[c.id] = v;
                                            this.saveSettings();
                                        });
                                        let channelSwitchContainer = document.createElement('div');
                                        channelSwitchContainer.className = 'kt-channel-container';
                                        let channelSwitchText = document.createElement('h2');
                                        channelSwitchText.className = 'kt-channel-name';
                                        channelSwitchText.innerText = `${c.name || 'Unknown Channel'}`;
                                        channelSwitchContainer.append(channelSwitchText);
                                        channelSwitchContainer.append(channelSwitch);
                                        guildGroup.append(channelSwitchContainer);
                                        guildGroup.getElement().addEventListener('guildflushevent', () => {
                                            channelSwitch.firstElementChild.checked = this.settings.guilds[g.id].enabled;
                                        }, false);
                                    });
                                }
                                guildGroup.getElement().removeEventListener('click', channelLoader);
                            };
                            guildGroup.getElement().addEventListener('click', channelLoader);
                        });
                    }

                    let other = new SettingGroup('Other');
                    panel.append(other);

                    let cooldownInput = document.createElement('input');
                    cooldownInput.type = 'number';
                    cooldownInput.min = '0';
                    cooldownInput.value = this.settings.navigationCooldown / 1000;
                    cooldownInput.style.width = '50px';
                    cooldownInput.style.marginLeft = '10px';
                    cooldownInput.addEventListener('change', () => {
                        this.settings.navigationCooldown = parseInt(cooldownInput.value) * 1000;
                        this.saveSettings();
                    });

                    let cooldownField = new SettingField('Navigation Cooldown', 'Seconds to wait before auto-navigating to another channel (prevents Discord lag from frequent navigation).', null, cooldownInput);
                    other.append(cooldownField);

                    let markJumpedReadSwitch = this.makeSwitch(this.settings.markJumpedRead, (v) => {
                        this.settings.markJumpedRead = v;
                        this.saveSettings();
                    });

                    let notificationSwitch = this.makeSwitch(this.settings.notifications, (v) => {
                        this.settings.notifications = v;
                        this.saveSettings();
                    });

                    let selfPingSwitch = this.makeSwitch(this.settings.allowSelf, (v) => {
                        this.settings.allowSelf = v;
                        this.saveSettings();
                    });

                    let botSwitch = this.makeSwitch(this.settings.allowBots, (v) => {
                        this.settings.allowBots = v;
                        this.saveSettings();
                    });

                    let embedSwitch = this.makeSwitch(this.settings.allowEmbeds, (v) => {
                        this.settings.allowEmbeds = v;
                        this.saveSettings();
                    });

                    let autoNavigateSwitch = this.makeSwitch(this.settings.autoNavigate, (v) => {
                        this.settings.autoNavigate = v;
                        this.saveSettings();
                    });

                    let markJumpedReadToggle = new SettingField('', 'Mark messages as read when jumping to them.', null, markJumpedReadSwitch, { noteOnTop: true });
                    other.append(markJumpedReadToggle);

                    let notificationToggle = new SettingField('', 'Enable notification sounds', null, notificationSwitch, { noteOnTop: true });
                    other.append(notificationToggle);

                    let embedToggle = new SettingField('', 'Enable matching embed content.', null, embedSwitch, { noteOnTop: true });
                    other.append(embedToggle);

                    let botToggle = new SettingField('', 'Enable bots to trigger notifications.', null, botSwitch, { noteOnTop: true });
                    other.append(botToggle);

                    let selfPingToggle = new SettingField('', 'Enable own messages to trigger notifications.', null, selfPingSwitch, { noteOnTop: true });
                    other.append(selfPingToggle);

                    let autoNavigateToggle = new SettingField('', 'Automatically navigate to channel on keyword match.', null, autoNavigateSwitch, { noteOnTop: true });
                    other.append(autoNavigateToggle);

                    let ignoreuseridstip = new SettingField('', 'Ignore users here. One user ID per line. (Right click name -> Copy ID). Be sure developer options are on.', null, document.createElement('div'));
                    other.append(ignoreuseridstip);

                    let ignoreuserids = document.createElement('textarea');
                    ignoreuserids.value = this.settings.ignoredUsers.join('\n');
                    ignoreuserids.addEventListener('change', () => {
                        this.settings.ignoredUsers = ignoreuserids.value.split('\n').filter(id => id.trim());
                        this.saveSettings();
                    });
                    ignoreuserids.setAttribute('rows', '8');
                    ignoreuserids.style.width = '95%';
                    ignoreuserids.style.resize = 'none';
                    ignoreuserids.style.marginLeft = '2.5%';
                    ignoreuserids.style.borderRadius = '3px';
                    ignoreuserids.style.border = '2px solid grey';
                    ignoreuserids.style.backgroundColor = '#ddd';
                    other.append(ignoreuserids);

                    let whitelistuseridstip = new SettingField('', 'Whitelist users here (all their messages will trigger notifications). One user ID per line. (Right click name -> Copy ID). Be sure developer options are on.', null, document.createElement('div'));
                    other.append(whitelistuseridstip);

                    let whitelistuserids = document.createElement('textarea');
                    whitelistuserids.value = this.settings.whitelistedUsers.join('\n');
                    whitelistuserids.addEventListener('change', () => {
                        this.settings.whitelistedUsers = whitelistuserids.value.split('\n').filter(id => id.trim());
                        this.saveSettings();
                    });
                    whitelistuserids.setAttribute('rows', '8');
                    whitelistuserids.style.width = '95%';
                    whitelistuserids.style.resize = 'none';
                    whitelistuserids.style.marginLeft = '2.5%';
                    whitelistuserids.style.borderRadius = '3px';
                    whitelistuserids.style.border = '2px solid grey';
                    whitelistuserids.style.backgroundColor = '#ddd';
                    other.append(whitelistuserids);

                    this.saveSettings();
                    return panel;
                } catch (e) {
                    Logger.error(`Error building settings: ${e}`);
                    const errorDiv = document.createElement('div');
                    errorDiv.textContent = 'Error building settings panel. Check console for details.';
                    errorDiv.style.color = 'var(--text-danger)';
                    errorDiv.style.padding = '20px';
                    return errorDiv;
                }
            }
        };
    };
    return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
/*@end@*/