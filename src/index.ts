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

import { appendBlock, deleteBlock, setBlockAttrs, getBlockAttrs, pushMsg, pushErrMsg, sql, refreshSql, renderSprig, getChildBlocks, insertBlock, renameDocByID, prependBlock, updateBlock, createDocWithMd, getDoc, getBlockKramdown, getBlockDOM, exportPreview } from "./api";
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
            inlineLatex: false,  // Add inlineLatex here
            preserveColors: false, // 添加保留Word颜色选项
            fullWidthToHalfWidth: false // 添加全角转半角选项
        }
        await this.loadData(STORAGE_NAME);
        // console.log(this.data[STORAGE_NAME]);

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

        const processedOps: string[] = [];
        let lastText = text;
        let lastHtml = html;
        let lastSiyuan = siyuan;

        const checkChange = (label: string) => {
            if (text !== lastText || html !== lastHtml || siyuan !== lastSiyuan) {
                processedOps.push(label);
                lastText = text;
                lastHtml = html;
                lastSiyuan = siyuan;
            }
        };

        // console.log(event.detail);
        if (this.data[STORAGE_NAME].LaTeXConversion) {
            if (this.data[STORAGE_NAME].inlineLatex) { // Change from this.settingUtils.get("inlineLatex")
                // Convert block math to inline math and remove newlines
                text = text.replace(/\\\[(.*?)\\\]/gs, (_, p1) => `$${p1.replace(/\n/g, '')}$`); // LaTeX block to inline
                text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式
                // markdown数学公式块也要变为inline
                text = text.replace(/\$\$(.*?)\$\$/gs, (_, p1) => `$${p1.replace(/\n/g, '')}$`); // Markdown block to inline

            } else {
                text = text.replace(/\\\[(.*?)\\\]/gs, '\n$$$$$1$$$$\n'); // LaTeX block math
                text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$'); // LaTeX 行内数学公式
            }
            checkChange((this.i18n.pasteOptions as any).LaTeXConversion);
        }
        if (this.data[STORAGE_NAME].removeNewlines) {
            text = text.replace(/\n(?=[a-zA-Z])/g, ' ').replace(/\n/g, ''); // 去除换行，如果换行后是英文单词开头则加空格
            // html 把br和\n替换为空字符
            html = html.replace(/<br>/g, ''); // 去除换行
            // html 把p标签的内容都合并为一个
            html = html.replace(/<\/p><p[^>]*>/g, ''); // 合并p标签内容
            checkChange((this.i18n.pasteOptions as any).removeNewlines);
        }
        if (this.data[STORAGE_NAME].removeSpaces) {
            // Skip block reference patterns ((id 'text')), asset references <<assets/xxx "xxxx">>, 
            // and other special patterns
            if (text.match(/\(\([0-9]{14}-[a-zA-Z0-9]{7}\s+'[^']+'\)\)/) ||
                text.match(/<<\s*assets\/[^>]*\s+"[^"]*"\s*>>/) ||
                text.match(/\{\{\s*select\s+[^\}]+\}\}/)) {
                // Don't process spaces for special references
            } else {
                // Remove spaces but preserve newline characters
                text = text.replace(/[^\S\n]/g, ''); // Removes all whitespace except newlines
            }
            // html = html.replace(/\s/g, ''); // 去除空格
            checkChange((this.i18n.pasteOptions as any).removeSpaces);
        }
        if (this.data[STORAGE_NAME].removeEmptyLines) {
            text = text.replace(/^\s*[\r\n]/gm, ''); // 去除空行
            html = html.replace(/<\/p><p[^>]*>/g, '</br>'); // 合并p标签内容
            checkChange((this.i18n.pasteOptions as any).removeEmptyLines);
        }
        if (this.data[STORAGE_NAME].addEmptyLines) {
            text = text.replace(/([^\n])\n([^\n])/g, '$1\n\n$2'); // 添加空行，只匹配只有一个换行的
            html = html.replace(/(<br>)(?!<br>)/g, '$1<br>'); // 添加空行，只匹配只有一个<br>的
            checkChange((this.i18n.pasteOptions as any).addEmptyLines);
        }
        if (this.data[STORAGE_NAME].pptList) {
            // text = text.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');// 富文本列表符号转markdown列表
            // html = html.replace(/(^|\n)[✨✅⭐️💡⚡️•○▪▫◆◇►▻❖✦✴✿❀⚪■☐🔲][\s]*/g, '$1- ');// 富文本列表符号转markdown列表
            // 替换<span style='mso-special-format:bullet;font-family:Wingdings'>l</span>为-
            // console.log(html);
            html = convertOfficeListToHtml(html);
            checkChange((this.i18n.pasteOptions as any).convertList);
        }
        if (this.data[STORAGE_NAME].removeSuperscript) {
            // text = text.replace(/\^([^\s^]+)(?=\s|$)/g, ''); // Remove superscript markers
            html = html.replace(/<sup[^>]*>.*?<\/sup>/g, ''); // Remove HTML superscript tags with any attributes
            checkChange((this.i18n.pasteOptions as any).removeSuperscript);
        }
        if (this.data[STORAGE_NAME].removeLinks) {
            text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove markdown links
            html = html.replace(/<a[^>]*>(.*?)<\/a>/g, '$1'); // Remove HTML links
            checkChange((this.i18n.pasteOptions as any).removeLinks);
        }

        if (this.data[STORAGE_NAME].fullWidthToHalfWidth) {
            // Convert full-width characters to half-width
            function toHalfWidth(str: string): string {
                return str.replace(/[\u2000-\u200b\u202f\u205f\u3000\uff00-\uffef]/g, function (char) {
                    const code = char.charCodeAt(0);
                    // Full-width space and other space characters -> half-width space (U+0020)
                    if (code >= 0x2000 && code <= 0x200B || code === 0x202F || code === 0x205F || code === 0x3000) {
                        return ' ';
                    }
                    // Full-width characters (U+FF01 to U+FF5E) -> half-width (U+0021 to U+007E)
                    if (code >= 0xFF01 && code <= 0xFF5E) {
                        return String.fromCharCode(code - 0xFEE0);
                    }
                    // Full-width digits (U+FF10 to U+FF19) -> half-width (U+0030 to U+0039)
                    if (code >= 0xFF10 && code <= 0xFF19) {
                        return String.fromCharCode(code - 0xFEE0);
                    }
                    return char;
                });
            }
            text = toHalfWidth(text);
            html = toHalfWidth(html);
            siyuan = toHalfWidth(siyuan);
            checkChange((this.i18n.pasteOptions as any).fullWidthToHalfWidth);
        }

        // Word颜色处理：如果没启用保留颜色，则移除所有颜色样式
        if (this.data[STORAGE_NAME].preserveColors) {

            // 如果html包含id="20250313235736-ywdz6cn" （时间+随机字母），updated="20250313235747"（14位数字），则不继续替换下面内容
            if (!html.match(/id="\d{14}-[a-z0-9]{7}" updated="\d{14}"/)) {
                // 添加一个功能，<span style="color:xx">xxx</span>的文本替换为<span data-type='text style="color:xx">xxx</span>
                // First convert color spans to links
                function color2link(html) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // 找到所有具有 style 属性的 span 元素
                    const spans = doc.querySelectorAll('span[style]');

                    spans.forEach(span => {
                        // 检查文本内容是否只有一个空格
                        const textContent = span.textContent;
                        if (textContent === ' ') {
                            // 如果只有一个空格，跳过这个 span
                            return;
                        }

                        const style = span.getAttribute('style');
                        const colorMatch = style.match(/color\s*:\s*([^;]+)/i);
                        const bgColorMatch = style.match(/background-color\s*:\s*([^;]+)/i) || style.match(/background\s*:\s*([^;]+)/i);

                        if (colorMatch || bgColorMatch) {
                            // 创建 <a> 元素
                            const a = doc.createElement('a');

                            if (colorMatch) {
                                let color = colorMatch[1].trim();
                                color = color.split(';')[0]; // 清理颜色值
                                a.href += `color:${color};`;
                            }

                            if (bgColorMatch) {
                                let bgColor = bgColorMatch[1].trim();
                                bgColor = bgColor.split(';')[0]; // 清理颜色值
                                a.href += "background-color:" + bgColor + ";";
                            }

                            // 将 span 的所有子节点移动到 a 元素中
                            while (span.firstChild) {
                                a.appendChild(span.firstChild);
                            }

                            // 用 a 元素替换 span 元素
                            span.parentNode.replaceChild(a, span);
                        }
                    });

                    // 将修改后的 DOM 树序列化回 HTML 字符串
                    return doc.body.innerHTML;
                }





                html = color2link(html);

                // Remove language-specific spans
                html = html.replace(/<span lang="EN-US"><o:p>\s+<\/o:p><\/span>/g, '');
                // console.log(html);
                // Convert to BlockDOM using Lute
                // Convert to BlockDOM using Lute
                let lute = window.Lute.New();
                lute.SetSpellcheck(window.siyuan.config.editor.spellcheck);
                lute.SetProtyleMarkNetImg(true);
                lute.SetHTMLTag2TextMark(true); // HTMLTag2TextMark 设置是否打开 HTML 某些标签解析为 TextMark 节点支持。
                lute.SetTextMark(true);// TextMark 设置是否打开通用行级节点解析支持。
                lute.SetHeadingID(false);
                lute.SetYamlFrontMatter(false);
                lute.SetInlineMathAllowDigitAfterOpenMarker(true);
                lute.SetToC(false); // 设置是否打开“目录”支持。
                lute.SetIndentCodeBlock(false);
                lute.SetParagraphBeginningSpace(true);
                lute.SetSetext(true);
                lute.SetFootnotes(false);
                lute.SetLinkRef(true);
                lute.SetImgPathAllowSpace(true);
                lute.SetKramdownIAL(true);
                lute.SetTag(true);
                lute.SetSuperBlock(true);
                lute.SetMark(true);
                lute.SetSub(true);
                lute.SetSup(true);
                lute.SetProtyleWYSIWYG(true); // 这个开了可以防止错误解析，比如斜体有时候会识别为markdown文本，但是开启之后u会丢失a链接，遇到[，a链接会变为markdown格式
                lute.SetKramdownSpanIAL(true); // KramdownSpanIAL 设置是否打开 kramdown 行级内联属性列表支持。
                // lute.SetInlineUnderscore(true);
                lute.SetGFMStrikethrough(true);
                lute.SetGFMStrikethrough1(true);
                lute.SetSpin(true);

                let result = lute.HTML2BlockDOM(html);
                // 处理意外产生的`[[](bacground-color:xx)`和`[[](color:xx)`，改为<span data-type="a" href="xxx">[<span>标签

                result = result.replace(/\[(.*?)\]\(((?:background-color|color):.*?)\)/g,
                    '<span data-type="a" data-href="$2">$1<span>');

                // console.log(result)
                // Convert the color links back to styled spans using DOM parser

                function processColorLinks(html) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');


                    // 创建带有指定样式和类型的 span 元素
                    function createSpan(text, types, style) {
                        const span = document.createElement('span');
                        const uniqueTypes = Array.from(new Set(types)); // 再次确保去重
                        if (uniqueTypes.length > 0) {
                            span.setAttribute('data-type', uniqueTypes.join(' '));
                        }
                        if (style) {
                            span.setAttribute('style', style);
                        }
                        span.textContent = text;
                        return span;
                    }

                    // 平铺嵌套结构并合并样式
                    function flattenFormatting(element, inheritedTypes = [], inheritedStyle = '') {
                        const fragment = document.createDocumentFragment();
                        const elementTypes = (element.getAttribute('data-type') || '').split(' ').filter(Boolean);
                        const currentTypes = Array.from(new Set([...inheritedTypes, ...elementTypes])); // 去重
                        const currentStyle = element.getAttribute('style') || inheritedStyle;

                        Array.from(element.childNodes).forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                                const span = createSpan(node.textContent, currentTypes, currentStyle);
                                fragment.appendChild(span);
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                const tag = node.tagName.toLowerCase();
                                if (['span', 'strong', 'em', 'u', 'b', 'i', 'sup', 'sub', 'mark', 's'].includes(tag)) {
                                    const nestedFragment = flattenFormatting(node, currentTypes, currentStyle);
                                    fragment.appendChild(nestedFragment);
                                } else {
                                    fragment.appendChild(node.cloneNode(true));
                                }
                            }
                        });

                        return fragment;
                    }

                    // 处理 color link
                    function handleColorLink(link) {
                        const href = link.getAttribute('data-href'); // 提取颜色值
                        const colorStyle = href; // 例如 "color:red;"
                        const style = link.getAttribute('style') || '';
                        const combinedStyle = `${style} ${colorStyle}`.trim();

                        // 获取原始 data-type，去掉 'a'
                        const originalDataType = link.getAttribute('data-type') || '';
                        const dataTypes = originalDataType.split(' ').filter(type => type !== 'a' && type !== '');

                        // 创建新 span，保留非 'a' 的 data-type
                        const span = document.createElement('span');
                        if (dataTypes.length > 0) {
                            span.setAttribute('data-type', dataTypes.join(' '));
                        }
                        span.setAttribute('style', combinedStyle);

                        // 移动子节点到新 span
                        while (link.firstChild) {
                            span.appendChild(link.firstChild);
                        }

                        // 替换原始 link
                        link.parentNode.replaceChild(span, link);

                        // 平铺嵌套样式
                        const fragment = flattenFormatting(span);
                        span.parentNode.insertBefore(fragment, span);
                        span.parentNode.removeChild(span);
                    }

                    // 处理所有带有 data-type="a" 的 span
                    const formattedLinks = doc.querySelectorAll('span[data-type*="a"][data-href^="color:"], span[data-type*="a"][data-href^="background-color:"]');
                    formattedLinks.forEach(link => {
                        const dataType = link.getAttribute('data-type') || '';
                        if (dataType.split(' ').includes('a')) {
                            handleColorLink(link);
                        }
                    });

                    // 处理带有 color: 或 background-color: 的 span
                    const colorLinks = doc.querySelectorAll('span[data-href^="color:"], span[data-href^="background-color:"]');
                    colorLinks.forEach(link => {
                        const dataType = link.getAttribute('data-type') || '';
                        if (dataType.split(' ').includes('a')) {
                            handleColorLink(link);
                        }
                    });

                    // 处理带有 color: 或 background-color: 的 a 元素
                    const aColorLinks = doc.querySelectorAll('a[data-href^="color:"], a[data-href^="background-color:"]');
                    aColorLinks.forEach(link => {
                        handleColorLink(link);
                    });

                    // 平铺所有剩余的嵌套样式
                    const allSpans = doc.querySelectorAll('span');
                    allSpans.forEach(span => {
                        if (span.querySelector('span, strong, em, u, b, i')) {
                            const fragment = flattenFormatting(span);
                            span.parentNode.insertBefore(fragment, span);
                            span.parentNode.removeChild(span);
                        }
                    });

                    //修复$不能添加颜色： span[data-type]有"backslash"，改为span[data-type]="text"
                    const backslashSpans = doc.querySelectorAll("span[data-type*='backslash']");
                    backslashSpans.forEach(span => {
                        const dataType = span.getAttribute('data-type').replace(/backslash/g, 'text');
                        span.setAttribute('data-type', dataType);
                    });

                    return doc.body.innerHTML;
                }

                console.log(result);
                result = processColorLinks(result);
                console.log(result);
                siyuan = result;
                // html = null;

            }
            checkChange((this.i18n.pasteOptions as any).preserveColors);
        }

        event.detail.resolve({
            textPlain: text,
            textHTML: html,
            siyuanHTML: siyuan
        });

        if (processedOps.length > 0) {
            pushMsg(`siyuan-plugin-text-process: ${processedOps.join(', ')}`);
        }
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
        // 添加保留Word颜色选项
        menu.addItem({
            icon: this.data[STORAGE_NAME].preserveColors ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.preserveColors,
            click: (detail, event) => {
                this.toggleOption("preserveColors", detail);
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



        menu.addItem({
            icon: this.data[STORAGE_NAME].fullWidthToHalfWidth ? "iconSelect" : "iconClose",
            label: this.i18n.pasteOptions.fullWidthToHalfWidth,
            click: (detail, event) => {
                this.toggleOption("fullWidthToHalfWidth", detail);
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
        const hasListSelection = detail.blockElements?.some(
            block => block.dataset.type === "NodeList" || block.dataset.type === "NodeListItem"
        );

        if (detail.blockElements.some(block => block.dataset.type === "NodeList")) {
            menuItems.push({
                label: this.i18n.blockOperations.copyFirstLevelMarkdown,
                click: async () => {
                    try {
                        let allFirstLevelItems = [];
                        for (const block of detail.blockElements) {
                            if (block.dataset.type === "NodeList") {
                                const blockId = block.dataset.nodeId;
                                const rootList = document.querySelector(`[data-node-id="${blockId}"]`);
                                const isOrdered = rootList.getAttribute('data-subtype') === 'o';
                                const isTaskList = rootList.getAttribute('data-subtype') === 't';

                                const firstLevelItems = Array.from(rootList.querySelectorAll(':scope > .li'))
                                    .map((li, index) => {
                                        const text = li.querySelector('.p')?.textContent?.trim() || '';
                                        if (isOrdered) {
                                            return `${index + 1}. ${text}`;
                                        } else if (isTaskList) {
                                            const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement;
                                            const checked = checkbox?.checked;
                                            const symbol = checked ? '- [x]' : '- [ ]';
                                            return `${symbol} ${text}`;
                                        } else {
                                            return `- ${text}`;
                                        }
                                    });
                                allFirstLevelItems.push(...firstLevelItems);
                            }
                        }
                        if (allFirstLevelItems.length > 0) {
                            const content = allFirstLevelItems.join('\n');
                            navigator.clipboard.writeText(content);
                            showMessage(this.i18n.messages.firstLevelCopied);
                        }
                    } catch (e) {
                        console.error('Error copying first level items:', e);
                    }
                }
            });
        }

        if (detail.blockElements && detail.blockElements.length === 1) {
            const block = detail.blockElements[0];

            if (block.dataset.type === "NodeList") {
                menuItems.push({
                    label: this.i18n.blockOperations.copyFirstLevel,
                    hotkey: "",
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
                    const symbols = [...this.settingUtils.get("copyMultiLevelSymbol")].filter(char => char !== '️');
                    const headingSymbols = [...this.settingUtils.get("copyHeadingSymbol")].filter(char => char !== '️');
                    let allBlocksContent = [];

                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;

                        // 处理标题
                        if (block.dataset.type === "NodeHeading") {
                            const level = parseInt(Array.from(block.classList)
                                .find(c => c.match(/h[1-6]/))
                                .substring(1)) - 1;
                            const symbol = headingSymbols.length > 0 ?
                                headingSymbols[level % headingSymbols.length] :
                                '❤️';
                            allBlocksContent.push(`${symbol} ${block.textContent.trim()}`);
                        }
                        // 处理列表（包括 NodeList 和 NodeListItem）
                        else if (block.dataset.type === "NodeList" || block.dataset.type === "NodeListItem") {
                            function numberToEmoji(num) {
                                // ⓿ ❶、❷、❸、❹、❺、❻、❼、❽、❾、❿、⓫、⓬、⓭、⓮、⓯、⓰、⓱、⓲、⓳、⓴
                                const emojiDigits = ['⓿', '➊', '➋', '➌', '➍', '➎', '➏', '➐', '➑', '➒', '➓', '⓫', '⓬', '⓭', '⓮', '⓯', '⓰', '⓱', '⓲', '⓳', '⓴'];

                                if (num <= 20) {
                                    return emojiDigits[num];
                                } else {
                                    return num.toString().split('').map(d => emojiDigits[parseInt(d)]).join('');
                                }
                            }

                            function processListItem(item, rootElement, results = [], level = 0, counters = {}) {
                                const li = item.closest('.li') || item;
                                const parentList = li.parentElement.closest('.list');
                                const isOrdered = parentList?.getAttribute('data-subtype') === 'o';
                                const isTaskList = parentList?.getAttribute('data-subtype') === 't';

                                // 计算当前项的序号（仅对有序列表）
                                let symbol;
                                if (isTaskList) {
                                    const taskSymbols = [['✅', '⬜']];
                                    const levelSymbols = taskSymbols[level % taskSymbols.length];
                                    symbol = li.classList.contains('protyle-task--done') ? levelSymbols[0] : levelSymbols[1];
                                } else if (isOrdered) {
                                    // 为当前层级初始化计数器
                                    if (!counters[level]) counters[level] = 0;
                                    // 计算当前项在同级中的位置
                                    let sibling = li;
                                    counters[level] = 1;
                                    while (sibling.previousElementSibling) {
                                        counters[level]++;
                                        sibling = sibling.previousElementSibling;
                                    }
                                    symbol = numberToEmoji(counters[level]);
                                } else {
                                    symbol = symbols.length === 0 ? '■' : symbols[level % symbols.length];
                                }

                                const indentation = ' '.repeat(2 * Math.max(0, level));

                                // 处理当前项的文本内容
                                const pElements = li.querySelectorAll(':scope > .p');
                                if (pElements.length > 0) {
                                    Array.from(pElements).forEach((p, index) => {
                                        let textContent = p.textContent.trim().replace(/\u200B/g, '');
                                        if (textContent) {
                                            const itemSymbol = index === 0 ? symbol : ' ';
                                            results.push(`${indentation}${itemSymbol} ${textContent}`);
                                        }
                                    });
                                }

                                // 递归处理子列表
                                const subList = li.querySelector(':scope > .list');
                                if (subList) {
                                    const subItems = subList.querySelectorAll(':scope > .li');
                                    subItems.forEach(subItem => {
                                        processListItem(subItem, rootElement, results, level + 1, counters);
                                    });
                                }

                                return results;
                            }

                            let formattedList;
                            if (block.dataset.type === "NodeList") {
                                const listItems = document.querySelector(`[data-node-id="${blockId}"]`)
                                    .querySelectorAll(':scope > .li');
                                formattedList = [];
                                listItems.forEach(item => {
                                    processListItem(item, block, formattedList);
                                });
                            } else {
                                // 处理 NodeListItem，包括其所有子层级
                                formattedList = processListItem(block, block.closest('[data-type="NodeList"]') || block);
                            }

                            if (formattedList.length > 0) {
                                allBlocksContent.push(formattedList.join('\n'));
                            }
                        } else {
                            // 处理其他类型的块
                            const content = block.textContent.trim();
                            if (content) {
                                allBlocksContent.push(content);
                            }
                        }
                    }

                    if (allBlocksContent.length > 0) {
                        const finalContent = allBlocksContent.join('\n').replace(/\u200B/g, '');
                        navigator.clipboard.writeText(finalContent);
                        showMessage(this.i18n.messages.multiLevelCopied);
                    }
                } catch (e) {
                    console.error('Error copying content:', e);
                }
            }
        });
        // Only show merge option when multiple non-list blocks are selected
        if (detail.blockElements && detail.blockElements.length > 1 && !hasListSelection) {
            menuItems.push({
                label: this.i18n.blockOperations.mergeBlocks,
                click: async () => {
                    let protyle = detail.protyle;
                    try {
                        const firstBlockId = detail.blockElements[0].dataset.nodeId;
                        const firstBlockOldDom = detail.blockElements[0].outerHTML;
                        // Merge editable DOM fragments instead of plain text to keep links/styles.
                        const editableContents = detail.blockElements
                            .map(block => block.querySelector('[contenteditable="true"]') as HTMLElement | null)
                            .filter((el): el is HTMLElement => !!el)
                            .map(el => el.innerHTML);

                        const mergedContent = editableContents.join('<br>');

                        // Frontend update for first block
                        const firstBlock = detail.blockElements[0];
                        const editableDiv = firstBlock.querySelector('[contenteditable="true"]') as HTMLElement | null;
                        if (editableDiv) {
                            editableDiv.innerHTML = mergedContent;
                        }

                        const newFirstBlockDom = firstBlock.outerHTML;
                        await updateBlock('dom', newFirstBlockDom, firstBlockId);

                        // Remove other blocks from DOM
                        let doOperations: IOperation[] = [];
                        let undoOperations: IOperation[] = [];

                        // Store first block update
                        doOperations.push({
                            action: "update",
                            id: firstBlockId,
                            data: newFirstBlockDom
                        });
                        undoOperations.push({
                            action: "update",
                            id: firstBlockId,
                            data: firstBlockOldDom
                        });

                        // Remove other blocks
                        for (let i = 1; i < detail.blockElements.length; i++) {
                            const block = detail.blockElements[i];
                            const blockId = block.dataset.nodeId;
                            const blockOldDom = block.outerHTML;

                            // Frontend: remove block from DOM
                            block.remove();

                            // Add delete operation
                            doOperations.push({
                                action: "delete",
                                id: blockId,
                                data: null
                            });
                            undoOperations.push({
                                action: "insert",
                                id: blockId,
                                data: blockOldDom,
                                previousID: firstBlockId,
                                parentID: protyle.block.id
                            });
                        }

                        // Execute transaction
                        protyle.getInstance().transaction(doOperations, undoOperations);

                    } catch (e) {
                        console.error('Error merging blocks:', e);
                    }
                }
            });
        }

        if (!hasListSelection) {
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
                                            // Generate new block DOM
                                            let newDom = lute.Md2BlockDOM(lines[i]);
                                            let newId = newDom.match(/data-node-id="([^"]*)"/)[1];

                                            // Insert the block directly in DOM
                                            // 🐛Fix(拆分块): 拆分块的时候transaction的insert和inserBlock API会冲突，想到了新方法，可以直接前端更新内容，后端更新慢，就让它后端慢慢更新吧
                                            const previousElement = protyle.wysiwyg.element.querySelector(`div[data-node-id="${previousId}"]`);
                                            if (previousElement) {
                                                const tempDiv = document.createElement('div');
                                                tempDiv.innerHTML = newDom;
                                                previousElement.after(tempDiv.firstChild);
                                            }

                                            // Add to transaction operations
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

                                    // Execute transaction after all blocks are inserted
                                    protyle.getInstance().transaction(doOperations, undoOperations);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Error splitting blocks:', e);
                    }
                }
            });
        }


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
                            // console.log(newBlockDom)
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
        // Add after the removeSpaces menu item in handleBlockMenu
        menuItems.push({
            label: this.i18n.blockOperations.removeNewlines,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            // Remove br tags and merge p tags
                            let updatedContent = blockHTML.replace(/<br\s*\/?>(?=[a-zA-Z])/g, ' ').replace(/<br\s*\/?>/g, '')
                                .replace(/<\/p>\s*<p[^>]*>/g, '')
                                .replace(/\n(?=[a-zA-Z])/g, ' ').replace(/\n/g, '');
                            if (updatedContent !== blockHTML) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error removing newlines:', e);
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
                            const regex = /(?<!<[^>]*)(['\"]|[.,;:!?()\[\]{}<>])(?![^<]*>)/g;

                            // 记录引号状态
                            let singleQuoteIsOpen = false;
                            let doubleQuoteIsOpen = false;

                            // 符号映射表
                            const symbolMap = {
                                ".": "。",
                                ",": "，",
                                ":": "：",
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

        // Add new menu item for converting Chinese punctuation to English
        menuItems.push({
            label: this.i18n.blockOperations.convertChineseToEnglish,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            // 匹配不在HTML标签内的中文符号
                            const regex = /(?<!<[^>]*)(。|，|；|！|？|（|）|：|“|”|‘|’|【|】|｛|｝)(?![^<]*>)/g;

                            // 中文符号到英文符号的映射表
                            const symbolMap = {
                                "。": ".",
                                "，": ",",
                                "；": ";",
                                "！": "!",
                                "？": "?",
                                "（": "(",
                                "）": ")",
                                "：": ":",
                                "‘": "'",
                                "’": "'",
                                "“": '"',
                                "”": '"',
                                "【": "[",
                                "】": "]",
                                "｛": "{",
                                "｝": "}"
                            };

                            let updatedContent = blockHTML.replace(regex, (match) => {
                                return symbolMap[match] || match;
                            });

                            // 更新块内容
                            if (updatedContent !== blockHTML) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error converting Chinese punctuation to English:', e);
                }
            }
        });

        // Add new menu item for full-width to half-width conversion
        menuItems.push({
            label: this.i18n.blockOperations.fullWidthToHalfWidth,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            // Convert full-width characters to half-width
                            function toHalfWidth(str: string): string {
                                return str.replace(/[\u2000-\u200b\u202f\u205f\u3000\uff00-\uffef]/g, function (char) {
                                    const code = char.charCodeAt(0);
                                    // Full-width space and other space characters -> half-width space (U+0020)
                                    if (code >= 0x2000 && code <= 0x200B || code === 0x202F || code === 0x205F || code === 0x3000) {
                                        return ' ';
                                    }
                                    // Full-width characters (U+FF01 to U+FF5E) -> half-width (U+0021 to U+007E)
                                    if (code >= 0xFF01 && code <= 0xFF5E) {
                                        return String.fromCharCode(code - 0xFEE0);
                                    }
                                    // Full-width digits (U+FF10 to U+FF19) -> half-width (U+0030 to U+0039)
                                    if (code >= 0xFF10 && code <= 0xFF19) {
                                        return String.fromCharCode(code - 0xFEE0);
                                    }
                                    return char;
                                });
                            }

                            let updatedContent = toHalfWidth(blockHTML);

                            // 更新块内容
                            if (updatedContent !== blockHTML) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error converting full-width to half-width:', e);
                }
            }
        });
        // 新增：半角转全角（只转换文本节点，保留 HTML 标签）
        menuItems.push({
            label: '半角转全角',
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const blockHTML = block.outerHTML;
                        if (blockHTML) {
                            function toFullWidthChar(ch: string) {
                                if (ch === ' ') return '\u3000';
                                const code = ch.charCodeAt(0);
                                // 跳过英文字母 A-Z 和 a-z
                                if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
                                    return ch;
                                }
                                // 跳过数字 0-9
                                if (code >= 0x30 && code <= 0x39) {
                                    return ch;
                                }
                                // 转换其他可映射的 ASCII 可见字符到全角
                                if (code >= 0x21 && code <= 0x7E) {
                                    return String.fromCharCode(code + 0xFEE0);
                                }
                                return ch;
                            }

                            function convertTextNodesHtml(html: string): string {
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(html, 'text/html');
                                const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
                                const nodes: Node[] = [];
                                while (walker.nextNode()) {
                                    nodes.push(walker.currentNode);
                                }
                                nodes.forEach(node => {
                                    if (node.nodeValue && node.nodeValue.trim() !== '') {
                                        node.nodeValue = node.nodeValue.replace(/[\x20-\x7E]/g, (m) => toFullWidthChar(m));
                                    }
                                });
                                return doc.body.innerHTML;
                            }

                            const updatedContent = convertTextNodesHtml(blockHTML);
                            if (updatedContent !== blockHTML) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, blockHTML);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error converting half-width to full-width:', e);
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


        menuItems.push({
            label: this.i18n.blockOperations.convertReference,
            click: async () => {
                let protyle = detail.protyle;
                try {
                    for (const block of detail.blockElements) {
                        const blockId = block.dataset.nodeId;
                        const oldBlockDom = block.outerHTML;

                        // Find all block reference spans
                        const refSpans = block.querySelectorAll('span[data-type="block-ref"]');

                        if (refSpans.length > 0) {
                            let updatedContent = oldBlockDom;

                            for (const refSpan of refSpans) {
                                const refId = refSpan.getAttribute('data-id');
                                const refText = refSpan.textContent;

                                // Create new link element
                                const linkHTML = `<span data-type="a" data-href="siyuan://blocks/${refId}">${refText}</span>`;

                                // Replace ref span with link span in HTML
                                updatedContent = updatedContent.replace(refSpan.outerHTML, linkHTML);
                            }

                            // Update block with new content
                            if (updatedContent !== oldBlockDom) {
                                await updateBlock('dom', updatedContent, blockId);
                                protyle.getInstance().updateTransaction(blockId, updatedContent, oldBlockDom);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error converting references to links:', e);
                }
            }
        });

        menuItems.push({
            label: "复制为富文本",
            click: async () => {
                try {
                    let combinedHTML = '';
                    for (const block of detail.blockElements) {
                        // Use the export preview API to get the HTML for the block
                        const blockId = block.dataset.nodeId;
                        try {
                            const res: any = await exportPreview(blockId);
                            let html = res && res.html ? res.html : '';
                            if (!html) continue;

                            // Parse the HTML and convert <span data-type="strong" ...> to <strong ...>
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');

                            // Find spans containing strong in their data-type (could be multiple types)
                            const spans = doc.querySelectorAll('span[data-type*="strong"]');
                            spans.forEach(span => {
                                const strong = doc.createElement('strong');

                                // Copy attributes except data-type
                                for (let i = 0; i < span.attributes.length; i++) {
                                    const attr = span.attributes[i];
                                    if (attr.name === 'data-type') continue;
                                    // keep style and other attrs
                                    strong.setAttribute(attr.name, attr.value);
                                }

                                // preserve inner HTML
                                strong.innerHTML = span.innerHTML;

                                // replace span with strong
                                span.parentNode.replaceChild(strong, span);
                            });

                            // Replace siyuan CSS variables in inline styles with concrete values
                            const cssVarMap: { [key: string]: string } = {
                                '--b3-font-color1': '#e21e11',
                                '--b3-font-color2': '#f1781c',
                                '--b3-font-color3': '#2183ce',
                                '--b3-font-color4': '#11ad81',
                                '--b3-font-color5': '#878484',
                                '--b3-font-color6': '#3fada5',
                                '--b3-font-color7': '#faad14',
                                '--b3-font-color8': '#a3431f',
                                '--b3-font-color9': '#596ab7',
                                '--b3-font-color10': '#944194',
                                '--b3-font-color11': '#d447c5',
                                '--b3-font-color12': '#ee2e68',
                                '--b3-font-color13': '#fff',
                                '--b3-font-color14': '#6d7c11',
                                '--b3-font-background1': '#FEDADE',
                                '--b3-font-background2': '#fce4d2',
                                '--b3-font-background3': '#F0F4F9',
                                '--b3-font-background4': '#e5fae5',
                                '--b3-font-background5': '#e2e3e4',
                                '--b3-font-background6': '#d8faff',
                                '--b3-font-background7': '#fef7d2',
                                '--b3-font-background8': '#f0ede0',
                                '--b3-font-background9': '#e9e9ff',
                                '--b3-font-background10': '#e5daff',
                                '--b3-font-background11': '#f5c7f0',
                                '--b3-font-background12': '#FFD8E4',
                                '--b3-font-background13': '#202124',
                                '--b3-font-background14': '#f3f5e7'
                            };

                            function resolveStyleVars(styleStr: string): string {
                                if (!styleStr) return styleStr;
                                // Replace var(--name[,fallback]) patterns
                                styleStr = styleStr.replace(/var\(\s*(--b3-[^) ,]+)\s*(?:,\s*([^\)]+)\s*)?\)/g, (_, varName, fallback) => {
                                    const key = varName.trim();
                                    if (cssVarMap[key]) return cssVarMap[key];
                                    return fallback ? fallback.trim() : _;
                                });
                                // Also replace direct occurrences of the variable name (e.g., --b3-font-color1)
                                styleStr = styleStr.replace(/(--b3-[a-z0-9-]+)/g, (m) => cssVarMap[m] || m);
                                return styleStr;
                            }

                            // Walk all elements with style attribute and replace variables
                            const styledEls = doc.querySelectorAll('[style]');
                            styledEls.forEach(el => {
                                const s = el.getAttribute('style');
                                const resolved = resolveStyleVars(s || '');
                                if (resolved !== s) {
                                    el.setAttribute('style', resolved);
                                }
                            });

                            // Append processed HTML
                            combinedHTML += doc.body.innerHTML + '\n';
                        } catch (err) {
                            console.error('Error fetching preview for block', block.dataset.nodeId, err);
                        }
                    }

                    // Copy combined HTML to clipboard as rich text
                    if (combinedHTML.trim()) {
                        await navigator.clipboard.write([
                            new ClipboardItem({
                                'text/html': new Blob([combinedHTML.trim()], { type: 'text/html' }),
                            })
                        ]);
                        showMessage("已复制为富文本");
                    } else {
                        showMessage("没有可复制的富文本内容");
                    }
                } catch (e) {
                    console.error('Error copying as rich text:', e);
                    showMessage("复制为富文本失败");
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
