const FENCED_CODE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE = /(`+)([\s\S]*?)\1/g;

export interface LatexConversionOptions {
    inlineAll?: boolean;
}

/**
 * Convert paired LaTeX math markers without touching Markdown code.
 *
 * Display math uses standalone dollar-marker lines because SiYuan's Markdown
 * parser does not reliably recognize a multiline formula when the markers are
 * attached to the formula body.
 */
export function convertLatexMath(text: string, options: LatexConversionOptions = {}): string {
    let output = "";
    let plainText = "";
    let fenceMarker = "";

    for (const line of text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) ?? []) {
        if (!line) {
            continue;
        }

        const fenceMatch = line.match(FENCED_CODE_LINE);
        if (!fenceMarker && fenceMatch) {
            output += convertOutsideInlineCode(plainText, options);
            plainText = "";
            fenceMarker = fenceMatch[1];
            output += line;
            continue;
        }

        if (fenceMarker) {
            output += line;
            const closingFence = line.match(FENCED_CODE_LINE)?.[1];
            if (closingFence?.[0] === fenceMarker[0] && closingFence.length >= fenceMarker.length) {
                fenceMarker = "";
            }
            continue;
        }

        plainText += line;
    }

    return output + convertOutsideInlineCode(plainText, options);
}

/**
 * SiYuan prefers rich HTML over text/plain during paste. A single pre element
 * tells its paste pipeline to parse the accompanying plain text as Markdown.
 */
export function forceMarkdownPasteHTML(markdown: string): string {
    return `<pre>${escapeHTML(markdown)}</pre>`;
}

function convertOutsideInlineCode(text: string, options: LatexConversionOptions): string {
    let output = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    INLINE_CODE.lastIndex = 0;
    while ((match = INLINE_CODE.exec(text)) !== null) {
        output += convertMath(text.slice(lastIndex, match.index), options);
        output += match[0];
        lastIndex = match.index + match[0].length;
    }

    return output + convertMath(text.slice(lastIndex), options);
}

function convertMath(text: string, options: LatexConversionOptions): string {
    let converted = text.replace(
        /(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g,
        (match: string, body: string, offset: number, source: string) => {
            const formula = normalizeFormula(body, options.inlineAll);
            if (!formula) {
                return match;
            }
            if (options.inlineAll) {
                return `$${formula}$`;
            }

            const before = offset > 0 ? source[offset - 1] : "";
            const afterIndex = offset + match.length;
            const after = afterIndex < source.length ? source[afterIndex] : "";
            const leadingNewline = before && before !== "\n" && before !== "\r" ? "\n" : "";
            const trailingNewline = after && after !== "\n" && after !== "\r" ? "\n" : "";

            return `${leadingNewline}$$\n${formula}\n$$${trailingNewline}`;
        },
    );

    converted = converted.replace(
        /(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g,
        (match: string, body: string) => {
            const formula = normalizeFormula(body, options.inlineAll);
            return formula ? `$${formula}$` : match;
        },
    );

    if (options.inlineAll) {
        converted = converted.replace(
            /(?<!\$)\$\$([\s\S]*?)\$\$(?!\$)/g,
            (match: string, body: string) => {
                const formula = normalizeFormula(body, true);
                return formula ? `$${formula}$` : match;
            },
        );
    }

    return converted;
}

function normalizeFormula(formula: string, singleLine = false): string {
    const trimmed = formula.trim();
    return singleLine ? trimmed.replace(/\r?\n/g, "") : trimmed;
}

function escapeHTML(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
