export function convertOfficeListToHtml(htmlString: string, type = 'auto'): string {
    // 自动检测文档类型
    const isWord = htmlString.includes('mso-list:l0 level');
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

function convertWordListToHtml(htmlString: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const elements = Array.from(doc.body.children);
    const result = [];
    let listElements = [];

    // 判断列表类型
    function determineListType(element: Element): string {
        const listMarker = element.querySelector('span[style*="mso-list:Ignore"]');
        if (!listMarker) return 'ul';

        const markerText = listMarker.textContent.trim();
        const isOrderedList = markerText.length > 1;
        return isOrderedList ? 'ol' : 'ul';
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
            const currentLevel = parseInt(levelMatch[1]);
            const listType = determineListType(p);

            if (!currentList) {
                currentList = document.createElement(listType);
                fragment.appendChild(currentList);
                listStack.push({ element: currentList, type: listType });
            } else if (currentLevel > previousLevel) {
                const newList = document.createElement(listType);
                currentList.lastElementChild.appendChild(newList);
                currentList = newList;
                listStack.push({ element: currentList, type: listType });
            } else if (currentLevel < previousLevel) {
                for (let i = 0; i < previousLevel - currentLevel; i++) {
                    listStack.pop();
                    currentList = listStack[listStack.length - 1].element;
                }
            } else if (currentLevel === previousLevel && listType !== listStack[listStack.length - 1].type) {
                const newList = document.createElement(listType);
                if (listStack.length > 1) {
                    currentList.parentElement.parentElement.appendChild(newList);
                } else {
                    fragment.appendChild(newList);
                }
                currentList = newList;
                listStack[listStack.length - 1] = { element: currentList, type: listType };
            }

            const li = document.createElement('li');
            const pClone = p.cloneNode(true);
            pClone.querySelectorAll('span[style*="mso-list:Ignore"]').forEach(span => {
                span.remove();
            });
            li.innerHTML = pClone.innerHTML;
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

    function determineListType(element: Element): string {
        const bulletSpan = element.querySelector('span[style*="mso-special-format"]');
        if (!bulletSpan) return 'ul';

        const style = bulletSpan.getAttribute('style') || '';
        const isOrderedList = style.includes('numbullet');
        return isOrderedList ? 'ol' : 'ul';
    }

    function processListGroup(elements: Element[]): string {
        if (elements.length === 0) return '';

        const fragment = document.createDocumentFragment();
        let currentList = null;
        let previousMargin = 0;
        let listStack = [];

        elements.forEach(div => {
            const style = div.getAttribute('style') || '';
            const marginMatch = style.match(/margin-left:([.\d]+)in/);
            const currentMargin = parseFloat(marginMatch[1]);
            const listType = determineListType(div);

            if (!currentList) {
                currentList = document.createElement(listType);
                fragment.appendChild(currentList);
                listStack.push({ element: currentList, type: listType, margin: currentMargin });
            } else if (currentMargin > previousMargin) {
                const newList = document.createElement(listType);
                currentList.lastElementChild.appendChild(newList);
                currentList = newList;
                listStack.push({ element: currentList, type: listType, margin: currentMargin });
            } else if (currentMargin < previousMargin) {
                while (listStack.length > 0 && listStack[listStack.length - 1].margin > currentMargin) {
                    listStack.pop();
                }
                currentList = listStack[listStack.length - 1].element;
            } else if (currentMargin === previousMargin && listType !== listStack[listStack.length - 1].type) {
                const newList = document.createElement(listType);
                if (listStack.length > 1) {
                    currentList.parentElement.parentElement.appendChild(newList);
                } else {
                    fragment.appendChild(newList);
                }
                currentList = newList;
                listStack[listStack.length - 1] = { element: currentList, type: listType, margin: currentMargin };
            }

            const li = document.createElement('li');
            const divClone = div.cloneNode(true);
            divClone.querySelectorAll('span[style*="mso-special-format"]').forEach(span => {
                span.remove();
            });
            li.innerHTML = divClone.innerHTML;
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
