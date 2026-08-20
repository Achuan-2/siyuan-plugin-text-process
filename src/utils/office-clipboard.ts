const OFFICE_MATH_HTML = /(?:<m:oMath(?:Para)?\b|msEquation)/i;

export function isOfficeHTML(html: string, officeMath?: any): boolean {
    if (officeMath) {
        return true;
    }
    if (!html || typeof html !== "string") {
        return false;
    }

    // 微信公众号等网页排版工具在粘贴时可能包含从 Word 复制残留的某些 mso 样式，
    // 但属于网页来源富文本，不应判定为 Office 来源。
    const isWechatOrWebRichEditor = /(?:<span[^>]*\bleaf\b|\bleaf=""|\bdata-tools-id=|\bdata-ratio=|\brich_media\b|\bjs_uneditable\b|\brich_pages\b)/i.test(html);
    if (isWechatOrWebRichEditor) {
        return false;
    }

    // 1. Office XML 命名空间与架构声明
    if (/(?:urn:schemas-microsoft-com:office|xmlns:(?:o|w|x|p|v|m)\s*=\s*["'][^"']+["'])/i.test(html)) {
        return true;
    }

    // 2. Office 生成器与 ProgId 元数据标签（仅在 meta 标签中匹配，避免正文中包含 "Microsoft Word" 等普通文字被误判）
    if (/<meta\s+[^>]*(?:ProgId|Generator|Originator)[^>]*content=["']?(?:(?:Microsoft\s+)?(?:Word|Excel|PowerPoint|OneNote)|WPS)[^>]*>/i.test(html)
        || /<meta\s+[^>]*content=["']?(?:(?:Microsoft\s+)?(?:Word|Excel|PowerPoint|OneNote)|WPS)[^>]*[^>]*(?:ProgId|Generator|Originator)[^>]*>/i.test(html)) {
        return true;
    }

    // 3. Office 专属 XML 标签（如 <w:WordDocument>, <x:ExcelWorkbook>, <p:Presentation>, <o:p>, <m:oMath> 等）
    if (/<(?:w:WordDocument|x:ExcelWorkbook|p:Presentation|o:p|o:smarttagtype|m:oMath(?:Para)?)\b/i.test(html)) {
        return true;
    }

    // 4. Office 专属条件注释（如 <!--[if gte mso 9]>, <![if !msEquation]> 等）
    if (/<!--\[if\s+(?:gte?\s+)?(?:mso|vml|msEquation)\b|<!\[if\s+!(?:mso|vml|msEquation)\]>/i.test(html)) {
        return true;
    }

    // 5. Office 专属 CSS Class（如 MsoNormal, MsoListParagraph 等）
    if (/\bclass=["']?Mso(?:Normal|ListParagraph|TableGrid|BodyText|Header|Footer|Title|Subtitle|Acetate)\b/i.test(html)) {
        return true;
    }

    // 6. 真实的 Office 专属列表/结构样式规则（普通网页从 Word 粘贴残留的 mso-para-margin 等不作为判定依据）
    if (/(?:mso-list:\s*l\d+\s+level\d+|mso-special-format:\s*(?:bullet|numbullet)|mso-element:\s*(?:header|footer|comment|field))/i.test(html)) {
        return true;
    }

    return false;
}

function normalizeClipboardText(text: string): string {
    return text.replace(/\r\n?/g, "\n");
}

export function extractHTMLFromClipboardBuffer(rawHTML: string): string {
    const content = rawHTML.replace(/\0+$/, "");
    const startHTMLMatch = content.match(/StartHTML:\s*(\d+)/i);
    if (startHTMLMatch) {
        const startHTML = Number.parseInt(startHTMLMatch[1], 10);
        if (Number.isFinite(startHTML) && startHTML >= 0 && startHTML < content.length) {
            return content.slice(startHTML);
        }
    }

    const htmlStart = content.search(/<!doctype\s+html\b|<html\b|<!--StartFragment-->/i);
    return htmlStart >= 0 ? content.slice(htmlStart) : content;
}

export function readNativeOfficeMathHTML(textPlain: string, capturedHTML = ""): string {
    try {
        const windowRequire = (window as any).require;
        if (typeof windowRequire !== "function") {
            return capturedHTML;
        }

        const clipboard = windowRequire("electron")?.clipboard
            ?? windowRequire("@electron/remote")?.clipboard;
        if (!clipboard) {
            return capturedHTML;
        }

        const nativeText = clipboard.readText?.();
        if (typeof nativeText === "string" &&
            normalizeClipboardText(nativeText) !== normalizeClipboardText(textPlain || "")) {
            return capturedHTML;
        }

        const html = clipboard.readHTML?.() || "";
        if (OFFICE_MATH_HTML.test(html)) {
            return html;
        }

        const htmlBuffer = clipboard.readBuffer?.("HTML Format");
        if (htmlBuffer?.length) {
            const rawHTML = extractHTMLFromClipboardBuffer(htmlBuffer.toString("utf8"));
            if (OFFICE_MATH_HTML.test(rawHTML)) {
                return rawHTML;
            }
        }
    } catch (error) {
        console.warn("读取原生 Office 剪贴板失败", error);
    }

    return capturedHTML;
}
