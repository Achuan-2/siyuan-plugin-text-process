import assert from "node:assert/strict";
import test from "node:test";
import { convertLatexMath, forceMarkdownPasteHTML } from "../src/utils/latex-converter.ts";

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
