import {
    Plugin,
    showMessage,
    confirm,
    Dialog,
    Menu,
    openTab,
    adaptHotkey,
    getFrontend,
    getBackend,
    IModel,
    Protyle,
    openWindow,
    IOperation,
    Constants,
    openMobileFileById,
    lockScreen,
    ICard,
    ICardData
} from "siyuan";

import { appendBlock, deleteBlock, setBlockAttrs, getBlockAttrs, pushMsg, pushErrMsg, sql, refreshSql, renderSprig, getChildBlocks, insertBlock, renameDocByID, prependBlock, updateBlock, createDocWithMd, getDoc, getBlockKramdown, getBlockDOM } from "./api";
import "@/index.scss";


import { SettingUtils } from "./libs/setting-utils";
import { convertOfficeListToHtml } from "./utils/list-converter";

const STORAGE_NAME = "config";
const SETTINGS_NAME = "settings";

export default class PluginText extends Plugin {
    private isMobile: boolean;
    private settingUtils: SettingUtils;
    private topBarElement: HTMLElement;

    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 设置配置默认值
        this.data[STORAGE_NAME] = {
            LaTeXConversion: false,
            removeNewlines: false,
            removeSpaces: false,
            removeEmptyLines: false, // 新增去除空行选项
            addEmptyLines: false, // 新增添加空行选项
            pptList: false,
            removeSuperscript: false,  // Add new option
            removeLinks: false // Add new option
        }
        await this.loadData(STORAGE_NAME);
        console.log(this.data[STORAGE_NAME]);

        this.settingUtils = new SettingUtils({
            plugin: this, name: SETTINGS_NAME
        });


        this.settingUtils.addItem({
            key: "copyFirstLevelSymbol",
            value: "■",
            type: "textinput",
            title: this.i18n.settings.copyFirstLevelSymbol.title,
            description: this.i18n.settings.copyFirstLevelSymbol.description,
        });
        this.settingUtils.addItem({
            key: "copyMultiLevelSymbol",
            value: "💡■",
            type: "textinput",
            title: this.i18n.settings.copyMultiLevelSymbol.title,
            description: this.i18n.settings.copyMultiLevelSymbol.description,
        });
        await this.settingUtils.load(); //导入配置并合并
        // 监听粘贴事件
        this.eventBus.on("paste", this.eventBusPaste.bind(this));
        const topBarElement = this.addTopBar({
            icon: "iconPaste",
            title: this.i18n.addTopBarIcon,
            position: "right",
            callback: () => {
                if (this.isMobile) {
                    this.addMenu();
                } else {
                    let rect = topBarElement.getBoundingClientRect();
                    // 如果被隐藏，则使用更多按钮
                    if (rect.width === 0) {
                        rect = document.querySelector("#barMore").getBoundingClientRect();
                    }
                    if (rect.width === 0) {
                        rect = document.querySelector("#barPlugins").getBoundingClientRect();
                    }
                    this.addMenu(rect);
                }
            }
        });
        this.topBarElement = topBarElement;
        // 更新顶栏按钮背景色
        this.updateTopBarBackground();

        // 添加块菜单
        this.eventBus.on('click-blockicon', this.handleBlockMenu.bind(this));
    }


    onLayoutReady() {

    }

    async onunload() {
        this.eventBus.off("paste", this.eventBusPaste.bind(this));
        this.eventBus.off('click-blockicon', this.handleBlockMenu.bind(this));
        console.log("onunload");
    }


    uninstall() {
        this.eventBus.off("paste", this.eventBusPaste.bind(this));
        this.eventBus.off('click-blockicon', this.handleBlockMenu.bind(this));
        console.log("uninstall");
    }

    private eventBusPaste(event: any) {
        // 如果需异步处理请调用 preventDefault， 否则会进行默认处理
        event.preventDefault();
        // 如果使用了 preventDefault，必须调用 resolve，否则程序会卡死
        let text = event.detail.textPlain;
        let html = event.detail.textHTML;
        let siyuan = event.detail.siyuanHTML;
        console.log(event.detail);
        if (this.data[STORAGE_NAME].LaTeXConversion) {
            text = text.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$'); // LaTeX 行间数学公式块，允许中间有换行
            text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式
            siyuan = siyuan.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$'); // LaTeX 行间数学公式块，允许中间有换行
            siyuan = siyuan.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式

        }
        if (this.data[STORAGE_NAME].removeNewlines) {
            text = text.replace(/\n/g, ''); // 去除换行
            // html 把br和\n替换为空字符
            html = html.replace(/<br>/g, ''); // 去除换行
            // html 把p标签的内容都合并为一个
            html = html.replace(/<\/p><p[^>]*>/g, ''); // 合并p标签内容

        }
        if (this.data[STORAGE_NAME].removeSpaces) {
            // Skip block reference patterns ((id 'text'))
            if (text.match(/\(\([0-9]{14}-[a-zA-Z0-9]{7}\s+'[^']+'\)\)/)) {
                // Don't process spaces for block references
            } else if (text.match(/\{\{\s*select\s+[^\}]+\}\}/)) {
                // Don't process spaces for block embeds
            } else {
                text = text.replace(/\s/g, ''); // Remove all spaces for non-block references
            }
            // html = html.replace(/\s/g, ''); // 去除空格
        }
        if (this.data[STORAGE_NAME].removeEmptyLines) {
            text = text.replace(/^\s*[\r\n]/gm, ''); // 去除空行
            html = html.replace(/<\/p><p[^>]*>/g, '</br>'); // 合并p标签内容
        }
        if (this.data[STORAGE_NAME].addEmptyLines) {
            text = text.replace(/([^\n])\n([^\n])/g, '$1\n\n$2'); // 添加空行，只匹配只有一个换行的
            html = html.replace(/(<br>)(?!<br>)/g, '$1<br>'); // 添加空行，只匹配只有一个<br>的
        }
        if (this.data[STORAGE_NAME].pptList) {
            text = text.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');// 富文本列表符号转markdown列表
            html = html.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');// 富文本列表符号转markdown列表
            // 替换<span style='mso-special-format:bullet;font-family:Wingdings'>l</span>为-
            html = convertOfficeListToHtml(html);

        }
        if (this.data[STORAGE_NAME].removeSuperscript) {
            // text = text.replace(/\^([^\s^]+)(?=\s|$)/g, ''); // Remove superscript markers
            html = html.replace(/<sup[^>]*>.*?<\/sup>/g, ''); // Remove HTML superscript tags with any attributes
        }
        if (this.data[STORAGE_NAME].removeLinks) {
            text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove markdown links
            html = html.replace(/<a[^>]*>(.*?)<\/a>/g, '$1'); // Remove HTML links
        }
        event.detail.resolve({
            textPlain: text,
            textHTML: html,
            siyuanHTML: siyuan
        });
    }

    private addMenu(rect?: DOMRect) {
        const menu = new Menu("pasteProcess", () => { });
        menu.addItem({
            icon: this.data[STORAGE_NAME].LaTeXConversion ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.LaTeXConversion,
            click: (detail, event) => {
                this.toggleOption("LaTeXConversion", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].pptList ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.convertList,
            click: async (detail, event) => {
                this.toggleOption("pptList", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeSuperscript ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.removeSuperscript,
            click: (detail, event) => {
                this.toggleOption("removeSuperscript", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeLinks ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.removeLinks,
            click: (detail, event) => {
                this.toggleOption("removeLinks", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeNewlines ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.removeNewlines,
            click: (detail, event) => {
                this.toggleOption("removeNewlines", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeSpaces ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.removeSpaces,
            click: (detail, event) => {
                this.toggleOption("removeSpaces", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeEmptyLines ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.removeEmptyLines,
            click: (detail, event) => {
                this.toggleOption("removeEmptyLines", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].addEmptyLines ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.addEmptyLines,
            click: (detail, event) => {
                this.toggleOption("addEmptyLines", detail);
            }
        });

        if (this.isMobile) {
            menu.fullscreen();
        } else {
            menu.open({
                x: rect.right,
                y: rect.bottom,
                isLeft: true,
            });
        }
    }

    private toggleOption(option: string, detail: any) {
        this.data[STORAGE_NAME][option] = !this.data[STORAGE_NAME][option];
        this.saveData(STORAGE_NAME, this.data[STORAGE_NAME]);
        const useElement = detail.querySelector("use");
        if (this.data[STORAGE_NAME][option]) {
            useElement.setAttribute("xlink:href", "#iconSelect");
        } else {
            useElement.setAttribute("xlink:href", "#iconClose");
        }
        this.updateTopBarBackground();
    }

    private updateTopBarBackground() {
        const hasActiveOption = Object.values(this.data[STORAGE_NAME]).some(value => value === true);
        this.topBarElement.style.backgroundColor = hasActiveOption ? "var(--b3-toolbar-hover)" : "";
    }
    private async handleBlockMenu({ detail }) {
        let menu = detail.menu;
        const menuItems = [];
        // Only show merge option when multiple blocks are selected
        if (detail.blockElements && detail.blockElements.length > 1) {
            menuItems.push({
                label: this.i18n.blockOperations.mergeBlocks,
                click: async () => {
                    try {
                        const firstBlockId = detail.blockElements[0].dataset.nodeId;
                        let mergedContent = '';

                        // Gather content from all blocks using SQL
                        for (const block of detail.blockElements) {
                            const blockId = block.dataset.nodeId;
                            const content = (await getBlockKramdown(blockId)).kramdown;
                            // Split content into lines
                            function cleanText(text) {
                                let lines = text.split('\n');
                                lines.pop(); // Remove last line
                                return lines.join('\n');
                            }

                            let contentClean = cleanText(content);
                            if (contentClean && contentClean.length > 0) {
                                mergedContent += contentClean + '\n';
                            }
                        }

                        // Update first block with merged content
                        await updateBlock('markdown', mergedContent.trim(), firstBlockId);

                        // Delete other blocks
                        for (let i = 1; i < detail.blockElements.length; i++) {
                            const blockId = detail.blockElements[i].dataset.nodeId;
                            await deleteBlock(blockId);
                        }
                    } catch (e) {
                        console.error('Error merging blocks:', e);
                    }
                }
            });
        }

        if (detail.blockElements && detail.blockElements.length === 1) {
            const block = detail.blockElements[0];

            if (block.dataset.type === "NodeList") {
                menuItems.push({
                    label: this.i18n.blockOperations.copyFirstLevel,
                    click: async () => {
                        try {
                            const blockId = block.dataset.nodeId;
                            const listprefix = this.settingUtils.get("copyFirstLevelSymbol");
                            const defaultSymbol = '■';
                            
                            // Helper function to convert numbers to emoji digits
                            function numberToEmoji(num) {
                                const emojiDigits = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
                                return num.toString().split('').map(d => emojiDigits[parseInt(d)]).join('');
                            }

                            // Get root list element
                            const rootList = document.querySelector(`[data-node-id="${blockId}"]`);
                            const isOrdered = rootList.getAttribute('data-subtype') === 'o';
                            
                            // Get all top level list items
                            const firstLevelItems = Array.from(rootList.querySelectorAll(':scope > .li > .p'))
                                .map((li, index) => {
                                    const prefix = isOrdered ? 
                                        numberToEmoji(index + 1) : 
                                        (listprefix || defaultSymbol);
                                    return `${prefix} ${li.textContent.trim()}`;
                                })
                                .join('\n');

                            if (firstLevelItems) {
                                navigator.clipboard.writeText(firstLevelItems);
                                showMessage(this.i18n.messages.firstLevelCopied);
                            }
                        } catch (e) {
                            console.error('Error extracting first level items:', e);
                        }
                    }
                });


            }
        }

        menuItems.push({
            icon: "",
            label: this.i18n.blockOperations.splitBlocks,
            click: async () => {
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const content = (await getBlockKramdown(blockId)).kramdown;
                        if (content && content.length > 0) {
                            // Split content into lines
                            function cleanText(text) {
                                return text
                                    .split('\n')
                                    .map(line => line.replace(/^[\s]*\{:[^}]*id="[^"]*"[^}]*\}/g, '').trim())
                                    .filter(line => line) // 移除空行
                                    .join('\n');
                            }

                            let contentClean = cleanText(content);
                            const lines = contentClean.split('\n');
                            if (lines.length > 1) {
                                // Update original block with first line
                                await updateBlock('markdown', lines[0], blockId);
                                // Insert remaining lines as new blocks
                                let previousId = blockId;
                                for (let i = 1; i < lines.length; i++) {
                                    if (lines[i].trim()) { // Skip empty lines
                                        await refreshSql();
                                        const newBlock = await insertBlock('markdown', lines[i], null, previousId, null)
                                        if (newBlock) {
                                            previousId = newBlock[0].doOperations[0].id;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error splitting blocks:', e);
                }
            }
        });
        
        menuItems.push({
            label: this.i18n.blockOperations.copyMultiLevel,
            click: async () => {
                try {
                    const symbols = [...this.settingUtils.get("copyMultiLevelSymbol")];
                    let allBlocksContent = [];

                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;

                        // Check if block is a list
                        if (block.dataset.type === "NodeList") {
                            // Helper function to convert numbers to emoji digits
                            function numberToEmoji(num) {
                                const emojiDigits = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
                                return num.toString().split('').map(d => emojiDigits[parseInt(d)]).join('');
                            }

                            function getListItemInfo(element) {
                                let level = 0;
                                let counters = new Map();
                                let listTypes = [];

                                const rootList = document.querySelector(`[data-node-id="${blockId}"]`);

                                let parent = element.parentElement;
                                while (parent && !parent.isSameNode(rootList.parentElement)) {
                                    if (parent.classList.contains('list')) {
                                        level++;
                                        const isOrdered = parent.getAttribute('data-subtype') === 'o';
                                        listTypes.unshift(isOrdered);

                                        if (isOrdered) {
                                            let count = 1;
                                            let sibling = element.closest('.li');
                                            while (sibling.previousElementSibling) {
                                                count++;
                                                sibling = sibling.previousElementSibling;
                                            }
                                            counters.set(level, count);
                                        }
                                    }
                                    parent = parent.parentElement;
                                }
                                return {
                                    level: level - 1,
                                    listTypes: listTypes,
                                    counters: counters
                                };
                            }

                            function getSymbolForLevel(info) {
                                const level = info.level;
                                const listType = info.listTypes[level];

                                if (listType) {
                                    return numberToEmoji(info.counters.get(level + 1));
                                } else {
                                    return symbols.length === 0 ? '■' : symbols[level % symbols.length];
                                }
                            }

                            const listItems = document.querySelector(`[data-node-id="${blockId}"]`)
                                .querySelectorAll('.li > .p');

                            const formattedList = Array.from(listItems)
                                .map(item => {
                                    const info = getListItemInfo(item);
                                    const symbol = getSymbolForLevel(info);
                                    return `${symbol} ${item.textContent.trim()}`;
                                })
                                .join('\n');

                            if (formattedList) {
                                allBlocksContent.push(formattedList);
                            }
                        } else {
                            // For non-list blocks, just get the text content
                            const content = block.textContent.trim();
                            if (content) {
                                allBlocksContent.push(content);
                            }
                        }
                    }

                    if (allBlocksContent.length > 0) {
                        const finalContent = allBlocksContent.join('\n\n');
                        navigator.clipboard.writeText(finalContent);
                        showMessage(this.i18n.messages.multiLevelCopied);
                    }
                } catch (e) {
                    console.error('Error copying content:', e);
                }
            }
        });
        menuItems.push({
            icon: "",
            label: this.i18n.blockOperations.convertToMarkdownList,
            click: async () => {
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const content = (await getBlockKramdown(blockId)).kramdown;
                        if (content && content.length > 0) {
                            // Replace bullet points with markdown list syntax
                            const updatedContent = content.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');
                            await updateBlock('markdown', updatedContent, blockId);
                        }
                    }
                } catch (e) {
                    console.error('Error converting list:', e);
                }
            }
        });
        // Add new menu item for multi-level list copying
        menu.addItem({
            icon: "iconPaste",
            label: "文本处理",
            submenu: menuItems
        });
    }
}
