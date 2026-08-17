const FENCED_CODE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE = /(`+)([\s\S]*?)\1/g;

export interface LatexConversionOptions {
    inlineAll?: boolean;
}

interface OmmlNode {
    name: string;
    attrs: Record<string, string>;
    children: OmmlNode[];
    text: string;
}

export interface WordMathConversionResult {
    html: string;
    formulas: Array<{ token: string; markdown: string }>;
}

export function shouldUseOfficeMathBlock(blockText: string, token: string, inlineAll = false): boolean {
    return !inlineAll && blockText.trim() === token;
}

/**
 * Replace Word's conditional OMML equations with stable placeholders.
 * The caller can pass the returned HTML through Lute.HTML2Md and then restore
 * the placeholders with the matching SiYuan math Markdown.
 */
export function extractWordMath(
    html: string,
    options: LatexConversionOptions = {},
): WordMathConversionResult | null {
    if (!html || !/<m:oMath(?:Para)?\b/i.test(html)) {
        return null;
    }

    const fragmentMatch = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
    let convertedHTML = fragmentMatch ? fragmentMatch[1] : html;
    const formulas: WordMathConversionResult["formulas"] = [];
    convertedHTML = replaceOfficeEquationConditionals(convertedHTML, (omml: string) => {
        const formula = ommlToLatex(omml);
        if (!formula) {
            return null;
        }

        const token = `SIYUANWORDMATH${formulas.length}TOKEN`;
        const display = !options.inlineAll && /<m:oMathPara\b/i.test(omml);
        formulas.push({
            token,
            markdown: display ? `$$\n${formula}\n$$` : `$${formula}$`,
        });
        return display ? `<p>${token}</p>` : `<span>${token}</span>`;
    });

    return formulas.length > 0 ? { html: convertedHTML, formulas } : null;
}

interface OfficeConditionalBlock {
    contentStart: number;
    contentEnd: number;
    end: number;
}

function findOfficeConditionalBlock(source: string, start: number): OfficeConditionalBlock | null {
    const tokenPattern = /<!--\s*\[if\b[^\]]*\]\s*>|<!\s*\[if\b[^\]]*\]\s*>|<!\s*\[endif\]\s*-->|<!\s*\[endif\]\s*>/gi;
    tokenPattern.lastIndex = start;
    let depth = 0;
    let contentStart = -1;
    let match: RegExpExecArray | null;
    while ((match = tokenPattern.exec(source)) !== null) {
        if (/^<!(?:--)?\s*\[if/i.test(match[0])) {
            depth++;
            if (depth === 1) {
                contentStart = tokenPattern.lastIndex;
            }
        } else if (depth > 0) {
            depth--;
            if (depth === 0) {
                return { contentStart, contentEnd: match.index, end: tokenPattern.lastIndex };
            }
        }
    }
    return null;
}

function replaceOfficeEquationConditionals(
    source: string,
    replacement: (omml: string) => string | null,
): string {
    const equationStartPattern = /<!--\s*\[if\s+gte\s+msEquation\s+\d+\]\s*>/gi;
    let output = "";
    let sourceIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = equationStartPattern.exec(source)) !== null) {
        const equationBlock = findOfficeConditionalBlock(source, match.index);
        if (!equationBlock) {
            break;
        }
        const converted = replacement(source.slice(equationBlock.contentStart, equationBlock.contentEnd));
        if (converted === null) {
            equationStartPattern.lastIndex = equationBlock.end;
            continue;
        }

        let blockEnd = equationBlock.end;
        const fallbackStart = source.slice(blockEnd).match(/^\s*<!\s*\[if\s+!msEquation\s*\]\s*>/i);
        if (fallbackStart) {
            const fallbackIndex = blockEnd + fallbackStart[0].search(/<!/);
            const fallbackBlock = findOfficeConditionalBlock(source, fallbackIndex);
            if (fallbackBlock) {
                blockEnd = fallbackBlock.end;
            }
        }

        output += source.slice(sourceIndex, match.index) + converted;
        sourceIndex = blockEnd;
        equationStartPattern.lastIndex = blockEnd;
    }
    return output + source.slice(sourceIndex);
}

function ommlToLatex(omml: string): string {
    const root = parseLooseXML(omml);
    return root.children.map(nodeToLatex).join("").replace(/\s+/g, " ").trim();
}

function parseLooseXML(source: string): OmmlNode {
    const root: OmmlNode = { name: "root", attrs: {}, children: [], text: "" };
    const stack = [root];

    for (const token of source.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? []) {
        if (token.startsWith("<!--") || token.startsWith("<!") || token.startsWith("<?")) {
            continue;
        }
        if (token.startsWith("</")) {
            const closingName = normalizeTagName(token.slice(2, -1).trim());
            while (stack.length > 1) {
                const node = stack.pop();
                if (node.name === closingName) break;
            }
            continue;
        }
        if (token.startsWith("<")) {
            const selfClosing = /\/\s*>$/.test(token);
            const content = token.slice(1, token.length - (selfClosing ? 2 : 1)).trim();
            const nameMatch = content.match(/^([^\s/>]+)/);
            if (!nameMatch) continue;
            const node: OmmlNode = {
                name: normalizeTagName(nameMatch[1]),
                attrs: parseAttributes(content.slice(nameMatch[0].length)),
                children: [],
                text: "",
            };
            stack[stack.length - 1].children.push(node);
            if (!selfClosing) stack.push(node);
            continue;
        }

        const decoded = decodeHTMLEntities(token).replace(/\s+/g, " ");
        if (decoded.trim()) {
            stack[stack.length - 1].text += decoded;
        }
    }
    return root;
}

function normalizeTagName(name: string): string {
    return name.toLowerCase().replace(/^.*:/, "");
}

function parseAttributes(source: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
        attrs[normalizeTagName(match[1])] = decodeHTMLEntities(match[2] ?? match[3] ?? match[4] ?? "");
    }
    return attrs;
}

function child(node: OmmlNode, name: string): OmmlNode | undefined {
    return node.children.find(item => item.name === name);
}

function descendants(node: OmmlNode, name: string): OmmlNode[] {
    return node.children.flatMap(item => [
        ...(item.name === name ? [item] : []),
        ...descendants(item, name),
    ]);
}

function content(node?: OmmlNode): string {
    return node ? node.children.map(nodeToLatex).join("") + latexText(node.text) : "";
}

function grouped(node?: OmmlNode): string {
    return `{${content(node)}}`;
}

function nodeToLatex(node: OmmlNode): string {
    const ignored = new Set([
        "ctrlpr", "dpr", "fpr", "funcpr", "groupchrpr", "limlowpr", "limupppr",
        "mcs", "mcspr", "mrpr", "narypr", "radpr", "rpr", "sctrlpr", "ssubpr",
        "ssuppr", "ssubsuppr", "sty", "scr", "nor", "brk", "aln", "alnscr",
    ]);
    if (ignored.has(node.name) || node.name.endsWith("pr")) return "";

    switch (node.name) {
        case "f":
            return `\\frac${grouped(child(node, "num"))}${grouped(child(node, "den"))}`;
        case "ssub": {
            const base = content(child(node, "e"));
            return `${asScriptBase(base)}_${grouped(child(node, "sub"))}`;
        }
        case "ssup":
            return `${content(child(node, "e"))}^${grouped(child(node, "sup"))}`;
        case "ssubsup":
            return `${content(child(node, "e"))}_${grouped(child(node, "sub"))}^${grouped(child(node, "sup"))}`;
        case "rad": {
            const degree = content(child(node, "deg"));
            return degree ? `\\sqrt[${degree}]${grouped(child(node, "e"))}` : `\\sqrt${grouped(child(node, "e"))}`;
        }
        case "d": {
            const properties = child(node, "dpr");
            const begin = descendants(properties ?? node, "begchr")[0]?.attrs.val ?? "(";
            const end = descendants(properties ?? node, "endchr")[0]?.attrs.val ?? ")";
            return `\\left${delimiter(begin)}${content(child(node, "e"))}\\right${delimiter(end)}`;
        }
        case "nary": {
            const properties = child(node, "narypr");
            const symbol = descendants(properties ?? node, "chr")[0]?.attrs.val ?? "∫";
            return `${mathSymbol(symbol)}${content(child(node, "sub")) ? `_${grouped(child(node, "sub"))}` : ""}${content(child(node, "sup")) ? `^${grouped(child(node, "sup"))}` : ""}${grouped(child(node, "e"))}`;
        }
        case "func":
            return `${asFunction(content(child(node, "fname")))}${grouped(child(node, "e"))}`;
        case "limlow":
            return `${content(child(node, "e"))}_${grouped(child(node, "lim"))}`;
        case "limupp":
            return `${content(child(node, "e"))}^${grouped(child(node, "lim"))}`;
        case "acc": {
            const mark = descendants(child(node, "accpr") ?? node, "chr")[0]?.attrs.val ?? "^";
            const command = ({ "^": "hat", "¯": "bar", "→": "vec", "˜": "tilde", "˙": "dot", "¨": "ddot" } as Record<string, string>)[mark] ?? "hat";
            return `\\${command}${grouped(child(node, "e"))}`;
        }
        case "bar": {
            const position = descendants(child(node, "barpr") ?? node, "pos")[0]?.attrs.val;
            return `\\${position === "bot" ? "underline" : "overline"}${grouped(child(node, "e"))}`;
        }
        case "m":
            return `\\begin{matrix}${node.children.filter(item => item.name === "mr").map(row => row.children.filter(item => item.name === "e").map(content).join(" & ")).join(" \\\\ ")}\\end{matrix}`;
        case "eqarr":
            return `\\begin{aligned}${node.children.filter(item => item.name === "e").map(content).join(" \\\\ ")}\\end{aligned}`;
        case "r": {
            const value = node.children.filter(item => item.name !== "rpr").map(nodeToLatex).join("") + latexText(node.text);
            const roman = descendants(child(node, "rpr") ?? node, "nor").length > 0 ||
                descendants(child(node, "rpr") ?? node, "scr").some(item => item.attrs.val === "roman");
            return roman && /[A-Za-z]{2,}|\s/.test(value) ? `\\mathrm{${latexText(value, true)}}` : value;
        }
        default:
            return node.children.map(nodeToLatex).join("") + latexText(node.text);
    }
}

function latexText(value: string, textMode = false): string {
    let output = decodeHTMLEntities(value).normalize("NFKD")
        .replace(/×/g, "\\times ")
        .replace(/÷/g, "\\div ")
        .replace(/−/g, "-")
        .replace(/≤/g, "\\le ")
        .replace(/≥/g, "\\ge ")
        .replace(/≠/g, "\\ne ")
        .replace(/∞/g, "\\infty ")
        .replace(/±/g, "\\pm ")
        .replace(/∂/g, "\\partial ")
        .replace(/∇/g, "\\nabla ")
        .replace(/α/g, "\\alpha ")
        .replace(/β/g, "\\beta ")
        .replace(/γ/g, "\\gamma ")
        .replace(/δ/g, "\\delta ")
        .replace(/θ/g, "\\theta ")
        .replace(/λ/g, "\\lambda ")
        .replace(/μ/g, "\\mu ")
        .replace(/π/g, "\\pi ")
        .replace(/σ/g, "\\sigma ")
        .replace(/ω/g, "\\omega ");
    if (textMode) {
        output = output.replace(/([{}_%&#])/g, "\\$1").replace(/ /g, "\\ ");
    }
    return output;
}

function delimiter(value: string): string {
    return ({ "{": "\\{", "}": "\\}", "[": "[", "]": "]", "|": "|", "": "." } as Record<string, string>)[value] ?? value;
}

function mathSymbol(value: string): string {
    return ({ "∫": "\\int", "∑": "\\sum", "∏": "\\prod", "⋃": "\\bigcup", "⋂": "\\bigcap" } as Record<string, string>)[value] ?? value;
}

function asFunction(value: string): string {
    const name = value.replace(/^\\mathrm\{(.+)\}$/, "$1").trim();
    return ["sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min"].includes(name) ? `\\${name}` : `\\operatorname{${name}}`;
}

function asScriptBase(value: string): string {
    const name = value.trim();
    return ["sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min"].includes(name) ? `\\${name}` : value;
}

function decodeHTMLEntities(value: string): string {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
        if (entity[0] === "#") {
            const hex = entity[1].toLowerCase() === "x";
            const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return named[entity.toLowerCase()] ?? match;
    });
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
