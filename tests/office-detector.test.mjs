import assert from "node:assert/strict";
import test from "node:test";
import { isOfficeHTML } from "../src/utils/office-clipboard.ts";

test("identifies WeChat official account content as non-office", () => {
    const wechatHtml = `<html>
<body>
<!--StartFragment--><html><head></head><body><p style="margin-top:0.0000pt;margin-right:0.0000pt;margin-bottom:0.0000pt;mso-para-margin-right:0.0000gd;mso-para-margin-left:0.0000gd;mso-pagination:widow-orphan;text-align:left;"><span style="font-family:Helvetica;letter-spacing:0pt;font-size:10.5pt;background:#FFFFFF;background-clip:initial;-webkit-background-clip:initial;"><span style="font-family:Helvetica;"><span leaf="">办公类：</span></span><span leaf="">doc、docx（Word）、xlsx（Excel）、PPT、PDF，压缩后不影响排版和内容，发邮件时附件加载更快；</span></span><span leaf=""><br></span></p><p style="margin-top:0.0000pt;margin-right:0.0000pt;margin-bottom:0.0000pt;mso-para-margin-right:0.0000gd;mso-para-margin-left:0.0000gd;mso-pagination:widow-orphan;text-align:left;"><span style="font-family:Helvetica;letter-spacing:0pt;font-size:10.5pt;background:#FFFFFF;background-clip:initial;-webkit-background-clip:initial;"><span style="font-family:Helvetica;"><span leaf="">音视频类：</span></span><span leaf="">mp3、mp4、FLAC，压缩后音质、画质几乎无损耗，比如手机里的短视频压缩后，存更多也不占内存；</span></span><span leaf=""><br></span></p><p style="margin-top:0.0000pt;margin-right:0.0000pt;margin-bottom:0.0000pt;mso-para-margin-right:0.0000gd;mso-para-margin-left:0.0000gd;mso-pagination:widow-orphan;text-align:left;"><span style="font-family:Helvetica;letter-spacing:0pt;font-size:10.5pt;background:#FFFFFF;background-clip:initial;-webkit-background-clip:initial;"><span style="font-family:Helvetica;"><span leaf="">图片类：</span></span><span leaf="">JPG、PNG、GIF，尤其是截图、照片，压缩后体积变小，发朋友圈、做素材不卡顿；</span></span></p></body></html><!--EndFragment-->
</body>
</html>`;

    assert.equal(isOfficeHTML(wechatHtml), false);
});

test("identifies general web pages mentioning Microsoft Word as non-office", () => {
    const webHtml = `<p>Microsoft Word and Microsoft Excel are popular Office tools.</p>`;
    assert.equal(isOfficeHTML(webHtml), false);
});

test("identifies web pages with leftover mso styles as non-office", () => {
    const webHtml = `<p style="margin-top:0pt;mso-para-margin-top:0pt;mso-pagination:widow-orphan;font-family:SimSun;mso-ascii-font-family:Arial;"><span style="color:red">Web text</span></p>`;
    assert.equal(isOfficeHTML(webHtml), false);
});

test("identifies Microsoft Word desktop clipboard HTML as office", () => {
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta name=ProgId content=Word.Document>
<meta name=Generator content="Microsoft Word 15">
<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]-->
</head>
<body>
<!--StartFragment--><p class=MsoNormal><span style="color:red">Hello Word</span><o:p></o:p></p><!--EndFragment-->
</body>
</html>`;
    assert.equal(isOfficeHTML(wordHtml), true);
});

test("identifies Microsoft Excel desktop clipboard HTML as office", () => {
    const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta name="ProgId" content="Excel.Sheet">
</head>
<body>
<table><tr><td class="xl65">Data</td></tr></table>
</body>
</html>`;
    assert.equal(isOfficeHTML(excelHtml), true);
});

test("identifies PowerPoint desktop clipboard HTML as office", () => {
    const pptHtml = `<html>
<body>
<div><span style="mso-special-format:bullet;font-family:Wingdings">l</span>PPT bullet item</div>
</body>
</html>`;
    assert.equal(isOfficeHTML(pptHtml), true);
});

test("identifies Word list clipboard HTML as office", () => {
    const wordListHtml = `<p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.</span>List item</p>`;
    assert.equal(isOfficeHTML(wordListHtml), true);
});

test("identifies Word snippet with MsoNormal class as office", () => {
    const snippetHtml = `<!--StartFragment--><p class="MsoNormal">Text<o:p></o:p></p><!--EndFragment-->`;
    assert.equal(isOfficeHTML(snippetHtml), true);
});

test("identifies presence of officeMath as office", () => {
    assert.equal(isOfficeHTML("<p>any html</p>", { html: "<p>math</p>", formulas: [] }), true);
});
