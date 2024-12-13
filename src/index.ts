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
            addEmptyLines: false // 新增添加空行选项
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
        let siyuan = event.detail.siyuanHTML;
        if (this.data[STORAGE_NAME].latexConversion) {
            console.log()
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
        event.detail.resolve({
            textPlain: text,
            textHTML: html,
            siyuanHTML: siyuan
        });
    }

    private addMenu(rect?: DOMRect) {
        const menu = new Menu("pasteProcess", () => {});
        menu.addItem({
            icon: this.data[STORAGE_NAME].latexConversion ? "iconSelect" : "iconClose",
            label: this.i18n.latexConversion,
            click: (detail, event) => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleOption("latexConversion", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeNewlines ? "iconSelect" : "iconClose",
            label: this.i18n.removeNewlines,
            click: (detail, event) => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleOption("removeNewlines", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeSpaces ? "iconSelect" : "iconClose",
            label: this.i18n.removeSpaces,
            click: (detail, event) => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleOption("removeSpaces", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].removeEmptyLines ? "iconSelect" : "iconClose",
            label: this.i18n.removeEmptyLines,
            click: (detail, event) => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleOption("removeEmptyLines", detail);
            }
        });
        menu.addItem({
            icon: this.data[STORAGE_NAME].addEmptyLines ? "iconSelect" : "iconClose",
            label: this.i18n.addEmptyLines,
            click: (detail, event) => {
                event.preventDefault();
                event.stopPropagation();
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
        console.log(this.data[STORAGE_NAME]);
    }

    private updateTopBarBackground() {
        if (this.data[STORAGE_NAME].latexConversion || this.data[STORAGE_NAME].removeNewlines || this.data[STORAGE_NAME].removeSpaces || this.data[STORAGE_NAME].removeEmptyLines || this.data[STORAGE_NAME].addEmptyLines) {
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
                            const updatedContent = content.replace(/•/g, '- ');
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
