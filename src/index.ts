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

import SettingExample from "@/setting-example.svelte";

import { SettingUtils } from "./libs/setting-utils";
import { svelteDialog } from "./libs/dialog";

const STORAGE_NAME = "config";

export default class PluginSample extends Plugin {
    private isMobile: boolean;
    private settingUtils: SettingUtils;
    private data: { [key: string]: any } = {};
    private topBarElement: HTMLElement;

    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 设置配置默认值
        this.data[STORAGE_NAME] = {
            latexConversion: false,
            removeNewlines: false,
            removeSpaces: false,
            removeEmptyLines: false, // 新增去除空行选项
            addEmptyLines: false, // 新增添加空行选项
            pptList: false
        }
        await this.loadData(STORAGE_NAME);
        console.log(this.data[STORAGE_NAME]);

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
        console.log("onunload");
    }


    uninstall() {
        this.eventBus.off("paste", this.eventBusPaste.bind(this));
        console.log("uninstall");
    }

    private eventBusPaste(event: any) {
        // 如果需异步处理请调用 preventDefault， 否则会进行默认处理
        event.preventDefault();
        // 如果使用了 preventDefault，必须调用 resolve，否则程序会卡死
        // console.log(this.data[STORAGE_NAME])
        console.log(event.detail)
        let text = event.detail.textPlain;
        let html = event.detail.textHTML;
        if (this.data[STORAGE_NAME].latexConversion) {
            text = text.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$'); // latex 行间数学公式块，允许中间有换行
            text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // latex 行内数学公式
            siyuan = siyuan.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$'); // latex 行间数学公式块，允许中间有换行
            siyuan = siyuan.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // latex 行内数学公式
        }
        if (this.data[STORAGE_NAME].removeNewlines) {
            text = text.replace(/\n/g, ''); // 去除换行
            // html 把br和\n替换为空字符
            html = html.replace(/<br>/g, ''); // 去除换行
            // html 把p标签的内容都合并为一个
            html = html.replace(/<\/p><p[^>]*>/g, ''); // 合并p标签内容

        }
        if (this.data[STORAGE_NAME].removeSpaces) {
            text = text.replace(/\s/g, ''); // 去除空格
            html = html.replace(/\s/g, ''); // 去除空格
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
            text = text.replace(/[•○▪▫◆◇►▻❖✦✴✿❀⚪☐][\s]*/g, '- ');// 富文本列表符号转markdown列表
            // 替换<span style='mso-special-format:bullet;font-family:Wingdings'>l</span>为-
            console.log("1")
            html = this.convertOfficeListToHtml(html);
            // console.log(html);

        }
        event.detail.resolve({
            textPlain: text,
            textHTML: html,
        });
    }
    private convertOfficeListToHtml(htmlString, type = 'auto') {
        // 自动检测文档类型
        const isWord = htmlString.includes('mso-list:l0 level');
        const isPpt = htmlString.includes('mso-special-format');

        // 如果没有检测到任何列表结构，直接返回原始HTML
        if (!isWord && !isPpt) {
            return htmlString;
        }

        // 自动判断类型
        if (type === 'auto') {
            if (isWord) type = 'word';
            else if (isPpt) type = 'ppt';
        }

        // 根据类型调用对应的处理函数
        switch (type.toLowerCase()) {
            case 'word':
                return isWord ? this.convertWordListToHtml(htmlString) : htmlString;
            case 'ppt':
                return isPpt ? this.convertPPTListToHtml(htmlString) : htmlString;
            default:
                return htmlString;
        }
    }

    private convertWordListToHtml(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        const elements = Array.from(doc.body.children);
        const result = [];
        let listElements = [];

        // 判断列表类型
        function determineListType(element) {
            const listMarker = element.querySelector('span[style*="mso-list:Ignore"]');
            if (!listMarker) return 'ul'; // 默认无序列表

            // 获取列表标记的实际文本内容
            const markerText = listMarker.textContent.trim();

            // 检查是否为有序列表的常见标记
            // const isOrderedList = /^[0-9]+[.)]|^[a-zA-Z][.)]/.test(markerText);
            const isOrderedList = markerText.length > 1;
            return isOrderedList ? 'ol' : 'ul';
        }

        // 处理连续的列表组
        function processListGroup(elements) {
            if (elements.length === 0) return '';

            const fragment = document.createDocumentFragment();
            let currentList = null;
            let previousLevel = 0;
            let listStack = []; // 用于跟踪列表类型

            elements.forEach(p => {
                const style = p.getAttribute('style') || '';
                const levelMatch = style.match(/level(\d+)/);
                const currentLevel = parseInt(levelMatch[1]);
                const listType = determineListType(p);

                if (!currentList) {
                    // 创建第一个列表
                    currentList = document.createElement(listType);
                    fragment.appendChild(currentList);
                    listStack.push({ element: currentList, type: listType });
                } else if (currentLevel > previousLevel) {
                    // 创建新的嵌套列表
                    const newList = document.createElement(listType);
                    currentList.lastElementChild.appendChild(newList);
                    currentList = newList;
                    listStack.push({ element: currentList, type: listType });
                } else if (currentLevel < previousLevel) {
                    // 返回上层列表
                    for (let i = 0; i < previousLevel - currentLevel; i++) {
                        listStack.pop();
                        currentList = listStack[listStack.length - 1].element;
                    }
                } else if (currentLevel === previousLevel && listType !== listStack[listStack.length - 1].type) {
                    // 同级但列表类型不同，创建新列表
                    const newList = document.createElement(listType);
                    if (listStack.length > 1) {
                        // 如果在嵌套中，添加到父列表项
                        currentList.parentElement.parentElement.appendChild(newList);
                    } else {
                        // 顶层列表，直接添加到片段
                        fragment.appendChild(newList);
                    }
                    currentList = newList;
                    listStack[listStack.length - 1] = { element: currentList, type: listType };
                }

                // 创建列表项
                const li = document.createElement('li');
                const pClone = p.cloneNode(true);
                // 删除Word特有的列表标记
                pClone.querySelectorAll('span[style*="mso-list:Ignore"]').forEach(span => {
                    span.remove();
                });
                li.innerHTML = pClone.innerHTML;
                currentList.appendChild(li);

                previousLevel = currentLevel;
            });

            const wrapper = document.createElement('div');
            wrapper.appendChild(fragment);
            return wrapper.innerHTML;
        }

        // 遍历所有元素
        elements.forEach((element) => {
            const style = element.getAttribute('style') || '';
            const isListItem = style.includes('level') && style.includes('mso-list:');

            if (isListItem) {
                listElements.push(element);
            } else {
                if (listElements.length > 0) {
                    result.push(processListGroup(listElements));
                    listElements = [];
                }
                result.push(element.outerHTML);
            }
        });

        // 处理最后一组列表元素
        if (listElements.length > 0) {
            result.push(processListGroup(listElements));
        }

        return result.join('\n');
    }




    private convertPPTListToHtml(htmlString) {
        // 创建一个DOM解析器
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        // 找到所有元素
        const elements = Array.from(doc.body.children);
        const result = [];
        let listElements = [];

        // 判断列表类型
        function determineListType(element) {
            const bulletSpan = element.querySelector('span[style*="mso-special-format"]');
            if (!bulletSpan) return 'ul'; // 默认无序列表

            const style = bulletSpan.getAttribute('style') || '';
            // PPT中有序列表通常包含"numbullet"
            const isOrderedList = style.includes('numbullet');
            console.log(isOrderedList);
            return isOrderedList ? 'ol' : 'ul';
        }

        // 处理连续的列表组
        function processListGroup(elements) {
            if (elements.length === 0) return '';

            const fragment = document.createDocumentFragment();
            let currentList = null;
            let previousMargin = 0;
            let listStack = []; // 用于跟踪列表类型

            elements.forEach(div => {
                const style = div.getAttribute('style') || '';
                const marginMatch = style.match(/margin-left:([.\d]+)in/);
                const currentMargin = parseFloat(marginMatch[1]);
                const listType = determineListType(div);

                if (!currentList) {
                    // 创建第一个列表
                    currentList = document.createElement(listType);
                    fragment.appendChild(currentList);
                    listStack.push({ element: currentList, type: listType, margin: currentMargin });
                } else if (currentMargin > previousMargin) {
                    // 创建新的嵌套列表
                    const newList = document.createElement(listType);
                    currentList.lastElementChild.appendChild(newList);
                    currentList = newList;
                    listStack.push({ element: currentList, type: listType, margin: currentMargin });
                } else if (currentMargin < previousMargin) {
                    // 返回上层列表
                    while (listStack.length > 0 && listStack[listStack.length - 1].margin > currentMargin) {
                        listStack.pop();
                    }
                    currentList = listStack[listStack.length - 1].element;
                } else if (currentMargin === previousMargin && listType !== listStack[listStack.length - 1].type) {
                    // 同级但列表类型不同，创建新列表
                    const newList = document.createElement(listType);
                    if (listStack.length > 1) {
                        // 如果在嵌套中，添加到父列表项
                        currentList.parentElement.parentElement.appendChild(newList);
                    } else {
                        // 顶层列表，直接添加到片段
                        fragment.appendChild(newList);
                    }
                    currentList = newList;
                    listStack[listStack.length - 1] = { element: currentList, type: listType, margin: currentMargin };
                }

                // 创建列表项
                const li = document.createElement('li');
                const divClone = div.cloneNode(true);
                // 删除PPT特有的列表标记
                divClone.querySelectorAll('span[style*="mso-special-format"]').forEach(span => {
                    span.remove();
                });
                li.innerHTML = divClone.innerHTML;
                currentList.appendChild(li);

                previousMargin = currentMargin;
            });

            const wrapper = document.createElement('div');
            wrapper.appendChild(fragment);
            return wrapper.innerHTML;
        }

        // 遍历所有元素
        elements.forEach((element) => {
            const style = element.getAttribute('style') || '';
            const hasBullet = element.querySelector('span[style*="mso-special-format"]');

            if (hasBullet && style.includes('margin-left')) {
                // 收集列表元素
                listElements.push(element);
            } else {
                // 如果有待处理的列表元素，先处理它们
                if (listElements.length > 0) {
                    result.push(processListGroup(listElements));
                    listElements = [];
                }
                // 保持非列表元素不变
                result.push(element.outerHTML);
            }
        });

        // 处理最后一组列表元素
        if (listElements.length > 0) {
            result.push(processListGroup(listElements));
        }

        return result.join('\n');
    }



    private addMenu(rect?: DOMRect) {
        const menu = new Menu("pasteProcess", () => { });
        menu.addItem({
            icon: this.data[STORAGE_NAME].latexConversion ? "iconSelect" : "iconClose",
            label: this.i18n.latexConversion,
            click: (detail, event) => {

                this.toggleOption("latexConversion", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeNewlines ? "iconSelect" : "iconClose",
            label: this.i18n.removeNewlines,
            click: (detail, event) => {

                this.toggleOption("removeNewlines", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeSpaces ? "iconSelect" : "iconClose",
            label: this.i18n.removeSpaces,
            click: (detail, event) => {

                this.toggleOption("removeSpaces", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeEmptyLines ? "iconSelect" : "iconClose",
            label: this.i18n.removeEmptyLines,
            click: (detail, event) => {

                this.toggleOption("removeEmptyLines", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].addEmptyLines ? "iconSelect" : "iconClose",
            label: this.i18n.addEmptyLines,
            click: (detail, event) => {

                this.toggleOption("addEmptyLines", detail);
            }
        });

        // Add new list conversion option
        menu.addItem({
            icon: this.data[STORAGE_NAME].pptList ? "iconSelect" : "iconClose",
            label: "富文本列表转换",
            click: async (detail, event) => {

                this.toggleOption("pptList", detail);
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
        console.log(this.data[STORAGE_NAME]);
    }

    private updateTopBarBackground() {
        if (this.data[STORAGE_NAME].latexConversion || this.data[STORAGE_NAME].removeNewlines || this.data[STORAGE_NAME].removeSpaces || this.data[STORAGE_NAME].removeEmptyLines || this.data[STORAGE_NAME].addEmptyLines || this.data[STORAGE_NAME].pptList) {
            this.topBarElement.style.backgroundColor = "var(--b3-toolbar-hover)";
        } else {
            this.topBarElement.style.backgroundColor = "";
        }
    }
    private async handleBlockMenu({ detail }) {
        let menu = detail.menu;
        console.log(detail.blockElements)
        const menuItems = [];

        // Only show merge option when multiple blocks are selected
        if (detail.blockElements && detail.blockElements.length > 1) {
            menuItems.push({
                label: "合并块",
                click: async () => {
                    try {
                        const firstBlockId = detail.blockElements[0].dataset.nodeId;
                        let mergedContent = '';

                        // Gather content from all blocks using SQL
                        for (const block of detail.blockElements) {
                            const blockId = block.dataset.nodeId;
                            const sqlResult = await sql(`SELECT content FROM blocks WHERE id = '${blockId}'`);
                            if (sqlResult && sqlResult.length > 0) {
                                mergedContent += sqlResult[0].content + '\n';
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

        menuItems.push({
            icon: "",
            label: "拆分块",
            click: async () => {
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const sqlResult = await sql(`SELECT content FROM blocks WHERE id = '${blockId}'`);
                        if (sqlResult && sqlResult.length > 0) {
                            const content = sqlResult[0].content;
                            // Split content into lines
                            const lines = content.split('\n');
                            if (lines.length > 1) {
                                // Update original block with first line
                                await updateBlock('markdown', lines[0], blockId);
                                // Insert remaining lines as new blocks
                                let previousId = blockId;
                                for (let i = 1; i < lines.length; i++) {
                                    if (lines[i].trim()) { // Skip empty lines

                                        // const newBlock = await insertBlock(
                                        //     'markdown',
                                        //     lines[i],
                                        //     null, // parentId
                                        //     previousId, // previousId
                                        //     null // nextId
                                        // );
                                        const newBlock = await appendBlock('markdown', lines[i], previousId)
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
            icon: "",
            label: "富文本列表符号转markdown列表",
            click: async () => {
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const sqlResult = await sql(`SELECT content FROM blocks WHERE id = '${blockId}'`);
                        if (sqlResult && sqlResult.length > 0) {
                            const content = sqlResult[0].content;
                            // Replace bullet points with markdown list syntax
                            const updatedContent = content.replace(/[•○▪▫◆◇►▻❖✦✴✿❀⚪☐][\s]*/g, '- ');
                            await updateBlock('markdown', updatedContent, blockId);
                        }
                    }
                } catch (e) {
                    console.error('Error converting list:', e);
                }
            }
        });

        menu.addItem({
            label: "文本处理",
            submenu: menuItems
        });
    }
}
