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
            removeLinks: false, // Add new option
            inlineLatex: false  // Add inlineLatex here
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
            value: "■○",
            type: "textinput",
            title: this.i18n.settings.copyMultiLevelSymbol.title,
            description: this.i18n.settings.copyMultiLevelSymbol.description,
        });
        this.settingUtils.addItem({
            key: "copyHeadingSymbol",
            value: "❤️⭐️💡",
            type: "textinput",
            title: this.i18n.settings.copyHeadingSymbol.title,
            description: this.i18n.settings.copyHeadingSymbol.description,
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
        // console.log(event.detail);
        if (this.data[STORAGE_NAME].LaTeXConversion) {
            if (this.data[STORAGE_NAME].inlineLatex) { // Change from this.settingUtils.get("inlineLatex")
                // Convert block math to inline math and remove newlines
                text = text.replace(/\\\[(.*?)\\\]/gs, (_, p1) => `$${p1.replace(/\n/g, '')}$`); // LaTeX block to inline
                text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式
                // markdown数学公式块也要变为inline
                text = text.replace(/\$\$(.*?)\$\$/gs, (_, p1) => `$${p1.replace(/\n/g, '')}$`); // Markdown block to inline


                siyuan = siyuan.replace(/\\\[(.*?)\\\]/gs, (_, p1) => `$${p1.replace(/\n/g, '')}$`); // LaTeX block to inline
                siyuan = siyuan.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式
                // markdown数学公式块也要变为inline
                siyuan = siyuan.replace(/\$\$(.*?)\$\$/gs, (_, p1) => `$${p1.replace(/\n/g, '')}$`); // Markdown block to inline
            } else {
                text = text.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$'); // LaTeX block math
                text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式
                siyuan = siyuan.replace(/\\\[(.*?)\\\)/gs, '$$$$$1$$$$');
                siyuan = siyuan.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式
            }
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
            // text = text.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');// 富文本列表符号转markdown列表
            // html = html.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');// 富文本列表符号转markdown列表
            // 替换<span style='mso-special-format:bullet;font-family:Wingdings'>l</span>为-
            html = convertOfficeListToHtml(html);
            console.log(html);

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
            icon: this.data[STORAGE_NAME].inlineLatex ? "iconSelect" : "iconClose",  // Add menu item for inlineLatex
            label: this.i18n.settings.inlineLatex.title,
            click: (detail, event) => {
                this.toggleOption("inlineLatex", detail);
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
                                const emojiDigits = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
                                return num.toString().split('').map(d => emojiDigits[parseInt(d)]).join('');
                            }

                            // Get root list element
                            const rootList = document.querySelector(`[data-node-id="${blockId}"]`);
                            const isOrdered = rootList.getAttribute('data-subtype') === 'o';
                            const isTaskList = rootList.getAttribute('data-subtype') === 't';

                            // Get all top level list items
                            const firstLevelItems = Array.from(rootList.querySelectorAll(':scope > .li'))
                                .map((li, index) => {
                                    const textContent = li.querySelector('.p:nth-child(2)').textContent.trim();
                                    let prefix;

                                    if (isTaskList) {
                                        // Check if task is completed
                                        prefix = li.classList.contains('protyle-task--done') ? '✅' : '❌';
                                    } else if (isOrdered) {
                                        prefix = numberToEmoji(index + 1);
                                    } else {
                                        prefix = listprefix || defaultSymbol;
                                    }

                                    return `${prefix} ${textContent}`;
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
            label: this.i18n.blockOperations.copyMultiLevel,
            click: async () => {
                try {
                    const symbols = [...this.settingUtils.get("copyMultiLevelSymbol")].filter(char => char !== '️'); // Filter out empty strings and trim any extra spaces
                    // Replace all emojis with simple text characters to avoid extra spaces
                    const headingSymbols = [...this.settingUtils.get("copyHeadingSymbol")]
                        .filter(char => char !== '️');// Filter out empty strings and trim any extra spaces
                    let allBlocksContent = [];

                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;

                        // Check if block is a heading
                        if (block.dataset.type === "NodeHeading") {

                            // Get heading level (1-6)
                            const level = parseInt(Array.from(block.classList)
                                .find(c => c.match(/h[1-6]/))
                                .substring(1)) - 1;
                            console.log(level);
                            const symbol = headingSymbols.length > 0 ?
                                headingSymbols[level % headingSymbols.length] :
                                '❤️';

                            allBlocksContent.push(`${symbol} ${block.textContent.trim()}`);
                        }
                        // Check if block is a list
                        else if (block.dataset.type === "NodeList") {
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
                                        const isTaskList = parent.getAttribute('data-subtype') === 't';
                                        listTypes.unshift({ isOrdered, isTaskList });

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

                            function getSymbolForLevel(info, listItem) {
                                const level = info.level;
                                const listType = info.listTypes[level];

                                if (listType.isTaskList) {
                                    const symbols = [['✅', '❌'], ['✔', '✖️']];
                                    const levelSymbols = symbols[level % symbols.length];
                                    return listItem.parentElement.classList.contains('protyle-task--done') ? levelSymbols[0] : levelSymbols[1];
                                } else if (listType.isOrdered) {
                                    return numberToEmoji(info.counters.get(level + 1));
                                } else {
                                    return symbols.length === 0 ? '■' : symbols[level % symbols.length];
                                }
                            }


                            const listItems = document.querySelector(`[data-node-id="${blockId}"]`)
                                .querySelectorAll('.li > .p');

                            const formattedList = Array.from(listItems)
                                .map(item => {
                                    // 获取第一个 p，以确定是否要显示符号
                                    const li = item.closest('.li');
                                    const pSiblings = li.querySelectorAll(':scope > .p');
                                    const isFirstP = pSiblings.length && pSiblings[0].isSameNode(item);

                                    const info = getListItemInfo(item);
                                    // 如果是第一个 p，调用原来的符号，否则用空格代替
                                    const symbol = isFirstP ? getSymbolForLevel(info, item) : ' ';
                                    const indentation = ' '.repeat(2 * Math.max(0, info.level));

                                    let textContent = item.textContent.trim();
                                    // 去除零宽字符 U+200B
                                    textContent = textContent.replace(/\u200B/g, '').trim();

                                    return textContent ? `${indentation}${symbol} ${textContent}` : null;
                                })
                                .filter(item => item !== null)
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
                        // Remove zero-width space characters (U+200B)
                        const finalContent = allBlocksContent.join('\n').replace(/\u200B/g, '');
                        navigator.clipboard.writeText(finalContent);
                        showMessage(this.i18n.messages.multiLevelCopied);
                    }
                } catch (e) {
                    console.error('Error copying content:', e);
                }
            }
        });

        // Only show merge option when multiple blocks are selected
        if (detail.blockElements && detail.blockElements.length > 1) {
            menuItems.push({
                label: this.i18n.blockOperations.mergeBlocks,
                click: async () => {
                    let protyle = detail.protyle;
                    try {
                        const firstBlockId = detail.blockElements[0].dataset.nodeId;
                        const firstBlockOldDom = detail.blockElements[0].outerHTML;
                        let mergedContent = '';
                        let deletedBlocksData = [];

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

                            // Store block data for deletion
                            if (blockId !== firstBlockId) {
                                deletedBlocksData.push({
                                    id: blockId,
                                    dom: block.outerHTML,
                                    previousID: block.previousElementSibling ? block.previousElementSibling.dataset.nodeId : null
                                });
                            }
                        }

                        // Update first block with merged content
                        await updateBlock('markdown', mergedContent.trim(), firstBlockId);

                        // Create new DOM for merged content
                        let lute = window.Lute.New();
                        let newBlockDom = lute.Md2BlockDOM(mergedContent.trim());
                        newBlockDom = newBlockDom.replace(/data-node-id="[^"]*"/, `data-node-id="${firstBlockId}"`);

                        // Update transaction for first block
                        protyle.getInstance().updateTransaction(firstBlockId, newBlockDom, firstBlockOldDom);

                        let doOperations: IOperation[] = [];
                        let undoOperations: IOperation[] = [];
                        doOperations.push({
                            action: "update",
                            id: firstBlockId,
                            data: newBlockDom
                        });
                        undoOperations.push({
                            action: "update",
                            id: firstBlockId,
                            data: firstBlockOldDom,
                        });

                        // Reverse the array to delete blocks from bottom to top
                        for (const blockData of [...deletedBlocksData].reverse()) {

                            await deleteBlock(blockData.id);
                            doOperations.push({
                                action: "delete",
                                id: blockData.id,
                                data: null
                            });
                            undoOperations.push({
                                action: "insert",
                                id: blockData.id,
                                data: blockData.dom,
                                previousID: firstBlockId,
                                parentID: protyle.block.id
                            });

                        }
                        protyle.getInstance().transaction(doOperations, undoOperations);

                    } catch (e) {
                        console.error('Error merging blocks:', e);
                    }
                }
            });
        }


        menuItems.push({
            icon: "",
            label: this.i18n.blockOperations.splitBlocks,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const content = (await getBlockKramdown(blockId)).kramdown;
                        const oldBlockDom = block.outerHTML;

                        if (content && content.length > 0) {
                            // Split content into lines
                            function cleanText(text) {
                                return text
                                    .split('\n')
                                    .map(line => line.replace(/^[\s]*\{:[^}]*id="[^"]*"[^}]*\}/g, '').trim())
                                    .filter(line => line)
                                    .join('\n');
                            }

                            let contentClean = cleanText(content);
                            const lines = contentClean.split('\n');

                            if (lines.length > 1) {
                                let doOperations: IOperation[] = [];
                                let undoOperations: IOperation[] = [];

                                // Update original block with first line
                                const firstLine = lines[0];
                                await updateBlock('markdown', firstLine, blockId);
                                let lute = window.Lute.New();
                                let newBlockDom = lute.Md2BlockDOM(firstLine);
                                newBlockDom = newBlockDom.replace(/data-node-id="[^"]*"/, `data-node-id="${blockId}"`);

                                doOperations.push({
                                    action: "update",
                                    id: blockId,
                                    data: newBlockDom
                                });
                                undoOperations.push({
                                    action: "update",
                                    id: blockId,
                                    data: oldBlockDom
                                });

                                // Insert remaining lines as new blocks
                                let previousId = blockId;
                                for (let i = 1; i < lines.length; i++) {
                                    if (lines[i].trim()) {
                                        await refreshSql();
                                        const newBlock = await insertBlock('markdown', lines[i], null, previousId, null);
                                        if (newBlock) {
                                            const newId = newBlock[0].doOperations[0].id;
                                            let newDom = lute.Md2BlockDOM(lines[i]);
                                            newDom = newDom.replace(/data-node-id="[^"]*"/, `data-node-id="${newId}"`);

                                            doOperations.push({
                                                action: "insert",
                                                id: newId,
                                                data: newDom,
                                                previousID: previousId,
                                                parentID: protyle.block.id
                                            });
                                            undoOperations.push({
                                                action: "delete",
                                                id: newId,
                                                data: null
                                            });

                                            previousId = newId;
                                        }
                                    }
                                }

                                protyle.getInstance().transaction(doOperations, undoOperations);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error splitting blocks:', e);
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
                        const oldBlockDom = block.outerHTML;
                        if (content && content.length > 0) {
                            // Replace bullet points with markdown list syntax
                            const updatedContent = content.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');
                            let lute = window.Lute.New();
                            let newBlockDom = lute.Md2BlockDOM(updatedContent)
                            console.log(newBlockDom)
                            // 替换newBlockDom的data-node-id="xxx"为blockId
                            newBlockDom = newBlockDom.replace(/data-node-id="[^"]*"/, `data-node-id="${blockId}"`);
                            await updateBlock('markdown', updatedContent, blockId);
                            detail.protyle.getInstance().updateTransaction(blockId, newBlockDom, oldBlockDom);
                        }
                    }
                } catch (e) {
                    console.error('Error converting list:', e);
                }
            }
        });
        menuItems.push({
            label: this.i18n.blockOperations.removeSuperscript,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            // Remove HTML superscript tags
                            const updatedContent = blockHTML.replace(/<span data-type="sup"[^>]*>.*?<\/span>/g, '');
                            await updateBlock('dom', updatedContent, blockId);
                            protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                        }
                    }
                } catch (e) {
                    console.error('Error removing superscript:', e);
                }
            }
        });

        menuItems.push({
            label: this.i18n.blockOperations.removeLinks,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            // Remove span links while keeping text
                            const updatedContent = blockHTML.replace(/<span data-type="[^"]*a[^"]*"[^>]*>(.*?)<\/span>/g, '$1');
                            if (updatedContent !== blockHTML) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error removing links:', e);
                }
            }
        });

        // Add new menu item for removing spaces
        menuItems.push({
            label: this.i18n.blockOperations.removeSpaces,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            // Skip block reference patterns and embeds 
                            let updatedContent = blockHTML;
                            // Remove spaces between Chinese characters but keep other necessary spaces
                            updatedContent = blockHTML.replace(/([^\x00-\xff])\s+([^\x00-\xff])/g, '$1$2');
                            // Remove extra spaces between words
                            updatedContent = updatedContent.replace(/\s+/g, ' ');
                            if (updatedContent !== blockHTML) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error removing spaces:', e);
                }
            }
        });

        // Add new menu item for converting punctuation
        menuItems.push({
            label: "英文符号转中文符号",
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            // 匹配不在HTML标签内的英文符号
                            const regex = /(?<!<[^>]*)(['"]|[.,;!?()\[\]{}<>])(?![^<]*>)/g;

                            // 记录引号状态
                            let singleQuoteIsOpen = false;
                            let doubleQuoteIsOpen = false;

                            // 符号映射表
                            const symbolMap = {
                                ".": "。",
                                ",": "，",
                                ";": "；",
                                "!": "！",
                                "?": "？",
                                "(": "（",
                                ")": "）",
                            };

                            // 替换符号
                            // First decode HTML entities
                            const decodedHTML = blockHTML.replace(/&quot;/g, '"')
                                .replace(/&amp;/g, "&");

                            let updatedContent = decodedHTML.replace(regex, (match) => {
                                if (match === "'") {
                                    singleQuoteIsOpen = !singleQuoteIsOpen;
                                    return singleQuoteIsOpen ? '\u2018' : '\u2019';
                                }
                                if (match === '"') {
                                    doubleQuoteIsOpen = !doubleQuoteIsOpen;
                                    return doubleQuoteIsOpen ? '“' : '”';
                                }
                                return symbolMap[match] || match;
                            });
                            // updatedContent的&lt；替换为&lt;，&gt；替换为&gt;
                            updatedContent = updatedContent.replace(/&lt；/g, '&lt;').replace(/&gt；/g, '&gt;');
                            // 更新块内容
                            if (updatedContent !== blockHTML) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                            }
                        }
                    }

                } catch (e) {
                    console.error('Error converting punctuation:', e);
                }
            }
        });

        // Add new menu item for adjusting image width
        menuItems.push({
            label: this.i18n.blockOperations.adjustImageWidth,
            click: async () => {
                let protyle = detail.protyle;
                
                // Create dialog
                const dialog = new Dialog({
                    title: this.i18n.blockOperations.imageWidthDialog.title,
                    content: `<div class="b3-dialog__content">
                        <input class="b3-text-field fn__flex-center" type="number" 
                            placeholder="${this.i18n.blockOperations.imageWidthDialog.placeholder}">
                            <span style="margin-left: 1em">px<span>
                    </div>
                    <div class="b3-dialog__action">
                        <button class="b3-button b3-button--cancel">${this.i18n.blockOperations.imageWidthDialog.cancel}</button>
                        <button class="b3-button b3-button--text">${this.i18n.blockOperations.imageWidthDialog.confirm}</button>
                    </div>`,
                    width: "320px",
                });

                const input = dialog.element.querySelector('input') as HTMLInputElement;
                const confirmBtn = dialog.element.querySelector('.b3-button--text');
                const cancelBtn = dialog.element.querySelector('.b3-button--cancel');
                
                // Focus input when dialog opens
                setTimeout(() => input.focus(), 0);
                // Add enter key handling
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        confirmBtn.click();
                    }
                });
                cancelBtn.addEventListener('click', () => {
                    dialog.destroy();
                });

                confirmBtn.addEventListener('click', async () => {
                    const width = parseInt(input.value);
                    if (width > 0) {
                        try {
                            let doOperations: IOperation[] = [];
                            let undoOperations: IOperation[] = [];

                            for (const block of detail.blockElements) {
                                const blockId = block.dataset.nodeId;
                                const oldBlockDom = block.outerHTML;
                                
                                // Find all image spans and update their width
                                let updatedContent = oldBlockDom;
                                const imgHeightSpans = block.querySelectorAll('span[data-type="img"] > span>img');
                                const imgWidthSpans = block.querySelectorAll('span[data-type="img"] > span:nth-child(2)');

                                if (imgHeightSpans.length > 0) {
                                    imgHeightSpans.forEach(styleSpan => {
                                        styleSpan.setAttribute('style', "");
                                    });
                                    imgWidthSpans.forEach(styleSpan => {
                                        styleSpan.setAttribute('style', `width: ${width}px;`);
                                    });


                                    updatedContent = block.outerHTML;
                                    await updateBlock('dom', updatedContent, blockId);

                                    doOperations.push({
                                        action: "update",
                                        id: blockId,
                                        data: updatedContent
                                    });

                                    undoOperations.push({
                                        action: "update", 
                                        id: blockId,
                                        data: oldBlockDom
                                    });
                                }
                            }

                            if (doOperations.length > 0) {
                                protyle.getInstance().transaction(doOperations, undoOperations);
                            }
                        } catch (e) {
                            console.error('Error adjusting image width:', e);
                        }
                    }
                    dialog.destroy();
                });
            }
        });

        menuItems.push({
            label: this.i18n.blockOperations.adjustImageHeight,
            click: async () => {
                let protyle = detail.protyle;

                // Create dialog
                const dialog = new Dialog({
                    title: this.i18n.blockOperations.imageHeightDialog.title,
                    content: `<div class="b3-dialog__content">
                        <input class="b3-text-field fn__flex-center" type="number" 
                            placeholder="${this.i18n.blockOperations.imageHeightDialog.placeholder}">
                            <span style="margin-left: 1em">px<span>
                    </div>
                    <div class="b3-dialog__action">
                        <button class="b3-button b3-button--cancel">${this.i18n.blockOperations.imageHeightDialog.cancel}</button>
                        <button class="b3-button b3-button--text">${this.i18n.blockOperations.imageHeightDialog.confirm}</button>
                    </div>`,
                    width: "320px",
                });

                const input = dialog.element.querySelector('input') as HTMLInputElement;
                const confirmBtn = dialog.element.querySelector('.b3-button--text');
                const cancelBtn = dialog.element.querySelector('.b3-button--cancel');

                // Focus input when dialog opens
                setTimeout(() => input.focus(), 0);
                // Add enter key handling
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        confirmBtn.click();
                    }
                });
                cancelBtn.addEventListener('click', () => {
                    dialog.destroy();
                });

                confirmBtn.addEventListener('click', async () => {
                    const height = parseInt(input.value);
                    if (height > 0) {
                        try {
                            let doOperations: IOperation[] = [];
                            let undoOperations: IOperation[] = [];

                            for (const block of detail.blockElements) {
                                const blockId = block.dataset.nodeId;
                                const oldBlockDom = block.outerHTML;

                                // Find all image spans and update their height
                                let updatedContent = oldBlockDom;
                                const imgHeightSpans = block.querySelectorAll('span[data-type="img"] > span>img');
                                const imgWidthSpans = block.querySelectorAll('span[data-type="img"] > span:nth-child(2)');

                                if (imgHeightSpans.length > 0) {
                                    imgHeightSpans.forEach(styleSpan => {
                                        styleSpan.setAttribute('style', `height: ${height}px;`);
                                    });
                                    // imgWidthSpan的style设置为空
                                    imgWidthSpans.forEach(styleSpan => {
                                        styleSpan.setAttribute('style', '');
                                    });


                                    updatedContent = block.outerHTML;
                                    await updateBlock('dom', updatedContent, blockId);

                                    doOperations.push({
                                        action: "update",
                                        id: blockId,
                                        data: updatedContent
                                    });

                                    undoOperations.push({
                                        action: "update",
                                        id: blockId,
                                        data: oldBlockDom
                                    });
                                }
                            }

                            if (doOperations.length > 0) {
                                protyle.getInstance().transaction(doOperations, undoOperations);
                            }
                        } catch (e) {
                            console.error('Error adjusting image height:', e);
                        }
                    }
                    dialog.destroy();
                });
            }
        });
        // Add new menu item for setting code block language
        menuItems.push({
            label: this.i18n.blockOperations.setCodeLanguage,
            click: async () => {
                let protyle = detail.protyle;
                
                // Create dialog
                const dialog = new Dialog({
                    title: this.i18n.blockOperations.codeLanguageDialog.title,
                    content: `<div class="b3-dialog__content">
                        <input class="b3-text-field fn__flex-center" type="text"  style="width: 90%"
                            placeholder="${this.i18n.blockOperations.codeLanguageDialog.placeholder}">
                    </div>
                    <div class="b3-dialog__action">
                        <button class="b3-button b3-button--cancel">${this.i18n.blockOperations.codeLanguageDialog.cancel}</button>
                        <button class="b3-button b3-button--text">${this.i18n.blockOperations.codeLanguageDialog.confirm}</button>
                    </div>`,
                    width: "250px",
                });
                const input = dialog.element.querySelector('input') as HTMLInputElement;
                const confirmBtn = dialog.element.querySelector('.b3-button--text');
                const cancelBtn = dialog.element.querySelector('.b3-button--cancel');
                
                // Focus input when dialog opens
                setTimeout(() => input.focus(), 0);

                // Add enter key handling
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        confirmBtn.click();
                    }
                });

                cancelBtn.addEventListener('click', () => {
                    dialog.destroy();
                });

                confirmBtn.addEventListener('click', async () => {
                    const language = input.value.trim();
                    try {
                        let doOperations: IOperation[] = [];
                        let undoOperations: IOperation[] = [];

                        for (const block of detail.blockElements) {
                            const blockId = block.dataset.nodeId;
                            if (block.dataset.type === "NodeCodeBlock") {
                                const content = (await getBlockKramdown(blockId)).kramdown;
                                const oldBlockDom = block.outerHTML;
                                
                                // Extract the code content between ``` marks
                                const codeMatch = content.match(/```[^\n]*\n([\s\S]*?)```/);
                                if (codeMatch) {
                                    const codeContent = codeMatch[1];
                                    // Create new markdown with the specified language
                                    const newContent = '```' + language + '\n' + codeContent + '```';
                                    
                                    // Update block content
                                    await updateBlock('markdown', newContent, blockId);
                                    
                                    // Create new DOM for the updated content
                                    let lute = window.Lute.New();
                                    let newBlockDom = lute.Md2BlockDOM(newContent);
                                    newBlockDom = newBlockDom.replace(/data-node-id="[^"]*"/, `data-node-id="${blockId}"`);

                                    // Add to operations arrays
                                    doOperations.push({
                                        action: "update",
                                        id: blockId,
                                        data: newBlockDom
                                    });
                                    undoOperations.push({
                                        action: "update",
                                        id: blockId,
                                        data: oldBlockDom
                                    });
                                }
                            }
                        }

                        // Execute transaction if there are operations
                        if (doOperations.length > 0) {
                            protyle.getInstance().transaction(doOperations, undoOperations);
                        }
                    } catch (e) {
                        console.error('Error setting code language:', e);
                    }
                    dialog.destroy();
                });
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
