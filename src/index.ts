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

    private settingUtils: SettingUtils;

    async onload() {
        // 监听粘贴事件
        this.eventBus.on("paste", this.eventBusPaste);
    }
    

    onLayoutReady() {

    }

    async onunload() {
        this.eventBus.off("paste", this.eventBusPaste);
        console.log("onunload");
    }


    uninstall() {
        this.eventBus.off("paste", this.eventBusPaste);
        console.log("uninstall");
    }

    private eventBusPaste(event: any) {
        // 如果需异步处理请调用 preventDefault， 否则会进行默认处理
        event.preventDefault();
        // 如果使用了 preventDefault，必须调用 resolve，否则程序会卡死
        let text = event.detail.textPlain;
        text = text.replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$'); // latex 行间数学公式块
        text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // latex 行内数学公式
        event.detail.resolve({
            // 把laxtex公式变为markdown数学公式
            textPlain: text
        });
    }
}
