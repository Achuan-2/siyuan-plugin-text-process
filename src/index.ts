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

import { appendBlock, deleteBlock, setBlockAttrs, getBlockAttrs, pushMsg, pushErrMsg, sql, renderSprig, getChildBlocks, insertBlock, renameDocByID, prependBlock, updateBlock, createDocWithMd, getDoc, getBlockKramdown, getBlockDOM } from "./api";
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
            removeEmptyLines: false // 新增去除空行选项
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
        console.log(this.data[STORAGE_NAME])
        let text = event.detail.textPlain;
        let html = event.detail.textHTML;
        if (this.data[STORAGE_NAME].latexConversion) {
            console.log()
            text = text.replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$'); // latex 行间数学公式块
            text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // latex 行内数学公式
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
        event.detail.resolve({
            textPlain: text,
            textHTML: html
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
        if (this.data[STORAGE_NAME].latexConversion || this.data[STORAGE_NAME].removeNewlines || this.data[STORAGE_NAME].removeSpaces || this.data[STORAGE_NAME].removeEmptyLines) {
            this.topBarElement.style.backgroundColor = "var(--b3-toolbar-hover)";
        } else {
            this.topBarElement.style.backgroundColor = "";
        }
    }
}
