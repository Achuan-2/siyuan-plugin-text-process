export function convertOfficeListToHtml(htmlString: string, type = 'auto'): string {
    // 自动检测文档类型
    const isWord = /mso-list:l\d+\s+level\d+/i.test(htmlString);
    const isPpt = htmlString.includes('mso-special-format');

    // 如果没有检测到任何列表结构，直接返回原始HTML
    if (!isWord && !isPpt) {
        return htmlString;
    }

    // 自动判断类型
    if (type === 'auto') {
        if (isWord) type = 'word';
        else if (isPpt) type = 'ppt';
    }

    // 根据类型调用对应的处理函数
    switch (type.toLowerCase()) {
        case 'word':
            return isWord ? convertWordListToHtml(htmlString) : htmlString;
        case 'ppt':
            return isPpt ? convertPPTListToHtml(htmlString) : htmlString;
        default:
            return htmlString;
    }
}

type ListInfo = { type: string; checked?: boolean };

function detectTaskMarker(marker: Element): boolean | undefined {
    const markerStyle = marker.getAttribute('style') || '';
    const ancestorStyles: string[] = [];
    let ancestor = marker.parentElement;
    while (ancestor && ancestor.tagName.toLowerCase() !== 'body') {
        ancestorStyles.push(`${ancestor.getAttribute('style') || ''};${ancestor.getAttribute('face') || ''}`);
        ancestor = ancestor.parentElement;
    }
    const markerFont = [
        markerStyle,
        marker.getAttribute('face') || '',
        ...ancestorStyles,
        ...Array.from(marker.querySelectorAll('[style], [face]')).map(child =>
            `${child.getAttribute('style') || ''};${child.getAttribute('face') || ''}`
        )
    ].join(';').toLowerCase();
    const content = marker.textContent.trim().replace(/[\uFE0E\uFE0F]/g, '');

    if (new Set(['□', '☐']).has(content)) return false;
    if (new Set(['✔', '✓', '☑', '☒']).has(content)) return true;

    if (/wingdings\s*2/i.test(markerFont)) {
        // Wingdings 2：£/U+F0A3 为空方块，P/U+F050 为勾，R/U+F052 为带勾方框。
        if (content === '£' || content === '\uF0A3') return false;
        if (content === 'P' || content === '\uF050' || content === 'R' || content === '\uF052') return true;
    } else if (/wingdings/i.test(markerFont)) {
        // Wingdings：PowerPoint/Word 常用 p 或 q 表示空方块，ü 表示勾。
        if (content === 'p' || content === '\uF070' || content === 'q' || content === '\uF071') return false;
        if (content === 'ü' || content === '\uF0FC') return true;
    }

    return undefined;
}

function createListElement(listInfo: ListInfo): HTMLElement {
    const list = document.createElement(listInfo.type === 'task' ? 'ul' : listInfo.type);
    if (listInfo.type === 'task') {
        list.setAttribute('data-type', 'task');
    }
    return list;
}

function convertWordListToHtml(htmlString: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const elements = Array.from(doc.body.children);
    const result = [];
    let listElements = [];

    // 判断列表类型
    function determineListType(element: Element): ListInfo {
        const listMarker = element.querySelector('span[style*="mso-list:Ignore"]');
        if (!listMarker) return { type: 'ul' };

        const checked = detectTaskMarker(listMarker);
        if (checked !== undefined) {
            return { type: 'task', checked };
        }

        const markerText = listMarker.textContent.trim();
        const isOrderedList = markerText.length > 1;
        return { type: isOrderedList ? 'ol' : 'ul' };
    }

    // 处理连续的列表组
    function processListGroup(elements: Element[]): string {
        if (elements.length === 0) return '';

        const fragment = document.createDocumentFragment();
        let currentList = null;
        let previousLevel = 0;
        let listStack = [];

        elements.forEach(p => {
            const style = p.getAttribute('style') || '';
            const levelMatch = style.match(/level(\d+)/);
            const currentLevel = parseInt(levelMatch?.[1] || '1');
            const listInfo = determineListType(p);

            if (!currentList) {
                currentList = createListElement(listInfo);
                fragment.appendChild(currentList);
                listStack.push({ element: currentList, type: listInfo.type, level: currentLevel });
            } else if (currentLevel > previousLevel) {
                const newList = createListElement(listInfo);
                const parentItem = currentList.lastElementChild;
                if (parentItem) {
                    parentItem.appendChild(newList);
                } else {
                    fragment.appendChild(newList);
                }
                currentList = newList;
                listStack.push({ element: currentList, type: listInfo.type, level: currentLevel });
            } else if (currentLevel < previousLevel) {
                // 根列表不能弹出。复制内容可能从 level 3 开始再回到 level 1，
                // 此时原实现会清空 listStack 并访问 undefined.element。
                while (listStack.length > 1 && listStack[listStack.length - 1].level > currentLevel) {
                    listStack.pop();
                }
                currentList = listStack[listStack.length - 1].element;
                listStack[listStack.length - 1].level = Math.min(
                    listStack[listStack.length - 1].level,
                    currentLevel
                );
            } else if (currentLevel === previousLevel && listInfo.type !== listStack[listStack.length - 1].type) {
                const newList = createListElement(listInfo);
                if (listStack.length > 1) {
                    currentList.parentElement.parentElement.appendChild(newList);
                } else {
                    fragment.appendChild(newList);
                }
                currentList = newList;
                listStack[listStack.length - 1] = { element: currentList, type: listInfo.type, level: currentLevel };
            }

            const li = document.createElement('li');
            const pClone = p.cloneNode(true);
            pClone.querySelectorAll('span[style*="mso-list:Ignore"]').forEach(span => {
                span.remove();
            });
            if (listInfo.type === 'task') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                if (listInfo.checked) checkbox.setAttribute('checked', 'checked');
                li.appendChild(checkbox);
                li.classList.add('task-list-item');

                const contentSpan = document.createElement('span');
                contentSpan.innerHTML = pClone.innerHTML;
                li.appendChild(contentSpan);
            } else {
                li.innerHTML = pClone.innerHTML;
            }
            currentList.appendChild(li);

            previousLevel = currentLevel;
        });

        const wrapper = document.createElement('div');
        wrapper.appendChild(fragment);
        return wrapper.innerHTML;
    }

    elements.forEach((element) => {
        const style = element.getAttribute('style') || '';
        const isListItem = style.includes('level') && style.includes('mso-list:');

        if (isListItem) {
            listElements.push(element);
        } else {
            if (listElements.length > 0) {
                result.push(processListGroup(listElements));
                listElements = [];
            }
            result.push(element.outerHTML);
        }
    });

    if (listElements.length > 0) {
        result.push(processListGroup(listElements));
    }

    return result.join('\n');
}

function convertPPTListToHtml(htmlString: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const elements = Array.from(doc.body.children);
    const result = [];
    let listElements = [];

    function determineListType(element: Element): ListInfo {
        const bulletSpan = element.querySelector('span[style*="mso-special-format"]');
        if (!bulletSpan) return { type: 'ul' };

        const style = bulletSpan.getAttribute('style') || '';
        const checked = detectTaskMarker(bulletSpan);

        if (checked !== undefined) {
            return {
                type: 'task',
                checked
            };
        }

        // Check for numbered list
        const isOrderedList = style.includes('numbullet');
        return { type: isOrderedList ? 'ol' : 'ul' };
    }

    function processListGroup(elements: Element[]): string {
        if (elements.length === 0) return '';

        const fragment = document.createDocumentFragment();
        let currentList = null;
        let previousMargin = 0;
        let listStack = [];

        function parseMarginLeft(style: string, fallback: number): number {
            const match = style.match(/margin-left\s*:\s*(-?[.\d]+)\s*(in|pt|px|cm|mm)?/i);
            if (!match) return fallback;

            const value = parseFloat(match[1]);
            if (!Number.isFinite(value)) return fallback;

            switch ((match[2] || 'px').toLowerCase()) {
                case 'in': return value * 96;
                case 'pt': return value * 96 / 72;
                case 'cm': return value * 96 / 2.54;
                case 'mm': return value * 96 / 25.4;
                default: return value;
            }
        }

        elements.forEach(div => {
            const style = div.getAttribute('style') || '';
            const currentMargin = parseMarginLeft(style, previousMargin);
            const listInfo = determineListType(div);

            // Create appropriate list element
            if (!currentList) {
                currentList = createListElement(listInfo);
                fragment.appendChild(currentList);
                listStack.push({ element: currentList, type: listInfo.type, margin: currentMargin });
            } else if (currentMargin > previousMargin) {
                const newList = createListElement(listInfo);
                const parentItem = currentList.lastElementChild;
                if (parentItem) {
                    parentItem.appendChild(newList);
                } else {
                    fragment.appendChild(newList);
                }
                currentList = newList;
                listStack.push({ element: currentList, type: listInfo.type, margin: currentMargin });
            } else if (currentMargin < previousMargin) {
                // 始终保留根列表，避免缩进小于首项缩进时 listStack 被弹空。
                while (listStack.length > 1 && listStack[listStack.length - 1].margin > currentMargin) {
                    listStack.pop();
                }
                currentList = listStack[listStack.length - 1].element;
                listStack[listStack.length - 1].margin = Math.min(
                    listStack[listStack.length - 1].margin,
                    currentMargin
                );
            }

            const li = document.createElement('li');
            if (listInfo.type === 'task') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                if (listInfo.checked) {
                    checkbox.setAttribute('checked', 'checked');  // 使用setAttribute来设置checked属性
                }
                li.appendChild(checkbox);
                li.classList.add('task-list-item');
            }

            const divClone = div.cloneNode(true);
            divClone.querySelectorAll('span[style*="mso-special-format"]').forEach(span => {
                span.remove();
            });
            const contentSpan = document.createElement('span');
            contentSpan.innerHTML = divClone.innerHTML;
            li.appendChild(contentSpan);
            currentList.appendChild(li);

            previousMargin = currentMargin;
        });

        const wrapper = document.createElement('div');
        wrapper.appendChild(fragment);
        return wrapper.innerHTML;
    }

    elements.forEach((element) => {
        const style = element.getAttribute('style') || '';
        const hasBullet = element.querySelector('span[style*="mso-special-format"]');

        if (hasBullet && style.includes('margin-left')) {
            listElements.push(element);
        } else {
            if (listElements.length > 0) {
                result.push(processListGroup(listElements));
                listElements = [];
            }
            result.push(element.outerHTML);
        }
    });

    if (listElements.length > 0) {
        result.push(processListGroup(listElements));
    }

    return result.join('\n');
}
