import assert from "node:assert/strict";
import test from "node:test";
import {
    convertLatexMath,
    extractWordMath,
    forceMarkdownPasteHTML,
    shouldUseOfficeMathBlock,
} from "../src/utils/latex-converter.ts";
import { extractHTMLFromClipboardBuffer } from "../src/utils/office-clipboard.ts";

test("converts a multiline SiYuan note correctly", () => {
    const input = `锁定后 VCO 控制电压的平均值：

\\[
V_{\\mathrm{cont,static}}
=
\\frac{1}{T_2-T_1}
\\int_{T_1}^{T_2}V_{\\mathrm{cont}}(t)\\,dt
\\]

\`\`\`lisp
average(vcont_settled)
\`\`\`

确定当前工作点对应的 \\(K_{\\mathrm{VCO}}\\)。`;
    const output = convertLatexMath(input);

    assert.match(output, /\n\$\$\nV_\{\\mathrm\{cont,static\}\}/);
    assert.match(output, /\\,dt\n\$\$\n/);
    assert.match(output, /\$K_\{\\mathrm\{VCO\}\}\$/);
    assert.match(output, /```lisp\naverage\(vcont_settled\)\n```/);
});

test("converts paired inline and display markers", () => {
    assert.equal(
        convertLatexMath("before \\[x^2\\] after and \\(y\\)"),
        "before \n$$\nx^2\n$$\n after and $y$",
    );
});

test("preserves fenced and inline code", () => {
    const input = `正文 \\(x\\)

\`\`\`text
示例 \\(keep\\) 和 \\[keep\\]
\`\`\`

\`\\(also_keep\\)\``;
    const expected = `正文 $x$

\`\`\`text
示例 \\(keep\\) 和 \\[keep\\]
\`\`\`

\`\\(also_keep\\)\``;

    assert.equal(convertLatexMath(input), expected);
});

test("supports converting all formulas to inline math", () => {
    const input = `\\[a
b\\] and \\(c\\) and $$d
e$$`;
    assert.equal(convertLatexMath(input, { inlineAll: true }), "$ab$ and $c$ and $de$");
});

test("leaves unmatched and escaped markers unchanged", () => {
    const input = String.raw`unmatched \(x and escaped \\(y\\)`;
    assert.equal(convertLatexMath(input), input);
});

test("forces rich clipboard content through SiYuan's Markdown paste path", () => {
    const markdown = `## Formula

$$
x < y && y > 0
$$`;

    assert.equal(
        forceMarkdownPasteHTML(markdown),
        "<pre>## Formula\n\n$$\nx &lt; y &amp;&amp; y &gt; 0\n$$</pre>",
    );
});

test("extracts a Word OMML equation and removes its fallback image", () => {
    const html = `<!--StartFragment--><p>before</p>
<!--[if gte msEquation 12]><m:oMathPara><m:oMath>
<m:r><m:rPr><m:nor/></m:rPr>SNR (dB)</m:r><m:r>=</m:r><m:r>20</m:r><m:r>×</m:r>
<m:sSub><m:e><m:r>log</m:r></m:e><m:sub><m:r>10</m:r></m:sub></m:sSub>
<m:d><m:e><m:f><m:num><m:r>S</m:r></m:num><m:den><m:r>N</m:r></m:den></m:f></m:e></m:d>
</m:oMath></m:oMathPara><![endif]-->
<![if !msEquation]><img src="data:image/png;base64,fallback"><![endif]>
<p>after</p><!--EndFragment-->`;
    const result = extractWordMath(html);

    assert.ok(result);
    assert.doesNotMatch(result.html, /img|base64|oMath/i);
    assert.equal(result.formulas.length, 1);
    assert.equal(
        result.formulas[0].markdown,
        "$$\n\\mathrm{SNR\\ (dB)}=20\\times \\log_{10}\\left(\\frac{S}{N}\\right)\n$$",
    );
});

test("converts Word inline OMML to inline math", () => {
    const html = `<!--StartFragment--><span>A</span><!--[if gte msEquation 12]><m:oMath><m:sSup><m:e><m:r>x</m:r></m:e><m:sup><m:r>2</m:r></m:sup></m:sSup></m:oMath><![endif]--><![if !msEquation]><img src="fallback.png"><![endif]><!--EndFragment-->`;
    const result = extractWordMath(html);

    assert.ok(result);
    assert.equal(result.formulas[0].markdown, "$x^{2}$");
});

test("preserves styled Office text around an extracted equation", () => {
    const html = `<!--StartFragment--><p><span style="color:#c00000">before</span></p><!--[if gte msEquation 12]><m:oMath><m:r>x</m:r></m:oMath><![endif]--><![if !msEquation]><img src="fallback.png"><![endif]><p><span style="color:#0070c0">after</span></p><!--EndFragment-->`;
    const result = extractWordMath(html);

    assert.ok(result);
    assert.match(result.html, /color:#c00000/);
    assert.match(result.html, /color:#0070c0/);
    assert.match(result.html, /SIYUANWORDMATH0TOKEN/);
    assert.doesNotMatch(result.html, /fallback\.png/);
});

test("normalizes Office mathematical alphabet characters", () => {
    const html = `<!--[if gte msEquation 12]><m:oMath><m:f><m:num><m:r>&#119878;</m:r></m:num><m:den><m:r>&#119873;</m:r></m:den></m:f></m:oMath><![endif]-->`;
    const result = extractWordMath(html);

    assert.ok(result);
    assert.equal(result.formulas[0].markdown, "$\\frac{S}{N}$");
});

test("removes nested VML and image fallbacks for a Word equation", () => {
    const html = `<!--StartFragment--><p>before</p><!--[if gte msEquation 12]><m:oMath><m:r>x</m:r></m:oMath><![endif]--><![if !msEquation]><span><!--[if gte vml 1]><v:shape><v:imagedata src="word-equation.png"></v:imagedata></v:shape><![endif]--><![if !vml]><img src="word-equation.png"><![endif]></span><![endif]><p>after</p><!--EndFragment-->`;
    const result = extractWordMath(html);

    assert.ok(result);
    assert.match(result.html, /before/);
    assert.match(result.html, /after/);
    assert.match(result.html, /SIYUANWORDMATH0TOKEN/);
    assert.doesNotMatch(result.html, /(?:img|imagedata|v:shape|word-equation\.png|!msEquation|!vml)/i);
});

test("extracts Office HTML from a native CF_HTML clipboard buffer", () => {
    const html = '<html><body><!--StartFragment--><!--[if gte msEquation 12]><m:oMath><m:r>x</m:r></m:oMath><![endif]--><!--EndFragment--></body></html>';
    const header = `Version:1.0\r\nStartHTML:${String(55).padStart(10, "0")}\r\n`;
    const rawHTML = `${header.padEnd(55, " ")}${html}\0\0`;

    assert.equal(extractHTMLFromClipboardBuffer(rawHTML), html);
});

test("uses block math only when the formula occupies the whole line", () => {
    const token = "SIYUANWORDMATH0TOKEN";

    assert.equal(shouldUseOfficeMathBlock(`  ${token}\n`, token), true);
    assert.equal(shouldUseOfficeMathBlock(`prefix ${token}`, token), false);
    assert.equal(shouldUseOfficeMathBlock(`${token} suffix`, token), false);
    assert.equal(shouldUseOfficeMathBlock(token, token, true), false);
});
