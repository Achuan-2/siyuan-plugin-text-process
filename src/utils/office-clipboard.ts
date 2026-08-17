const OFFICE_MATH_HTML = /(?:<m:oMath(?:Para)?\b|msEquation)/i;

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
