## 🤔 Development Background

When pasting content from external sources into SiYuan Notes, processing is required. The aim is to automate these processes to eliminate repetitive tasks, save time, and allow more time for thinking and creation.

Examples:
- AI-generated mathematical formulas are often in LaTeX format and need conversion to Markdown math format
- List structures are lost when copying from PowerPoint or Word to SiYuan, requiring manual list recreation
- Text copied from PDF contains extra line breaks and spaces that need to be automatically removed
- And more...

## ✨ Plugin Features

The plugin has two main functions:

* Automatic processing during pasting
* Block processing

### Automatic Processing During Pasting

A button is added to SiYuan's top bar where you can enable or disable specific processing features.

![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-14_18-53-29-2024-12-14.png)

Current features include:

* Convert LaTeX display math (`\[...\]`) to `$$...$$` format, and inline math (`\(...\)`) to `$...$` format
* Remove line breaks (useful for removing extra line breaks from PDF copies)
* Remove spaces (useful for removing extra spaces from PDF copies)
* Remove empty lines (useful for keeping pasted content in a single block)
* Add empty lines (useful for separating pasted content into blocks by paragraph)
* Rich text list conversion (supports maintaining list styles and hierarchy when pasting lists from PowerPoint or Word, and converts bullet symbols like •○▪▫◆◇►▻❖✦✴✿❀⚪☐ to SiYuan Notes list format)

![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-14_19-02-01-2024-12-14.png)

> Note: The plugin only affects external plain text pasting and some HTML pasting. It may not affect HTML copying and rich text pasting within SiYuan Notes. If it's not working, you can use the plain text paste option in the right-click menu to achieve automatic processing (although formatting will be lost, this is currently unavoidable).

### Block Processing

The plugin adds the following buttons to the block menu:

* Merge blocks (appears when two or more blocks are selected)
* Split blocks
* Convert list symbols to Markdown list format
  * Converts bullet symbols like •○▪▫◆◇►▻❖✦✴✿❀⚪☐ to SiYuan Notes list format
* Copy list as plain text with symbols (appears when a list block is selected)
  * Useful for sharing on platforms like social media that only support plain text
  * Note: Ordered lists use number emojis (1️⃣2️⃣3️⃣), unordered lists can use custom symbols specified in settings. By default, first level uses ■, multi-level uses 💡■
  ![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-15_10-55-21-2024-12-15.png)
  ![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-15_10-56-09-2024-12-15.png)

## ❤️ Support

If you like my plugin, please star the GitHub repository and consider making a donation. This will motivate me to continue improving this plugin and developing new ones.

![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/20241118182532-2024-11-18.png)

For the list of donors, please visit: https://www.yuque.com/achuan-2