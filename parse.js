const convertUTF32MToUTF16m = require('./lib/convert').convertUTF32MToUTF16m;
const fs = require('fs');
const path = require('path');

(function (dir) {
    const emojiPNGFileNameList = {};
    const emojiMapResult = {};
    const fileList = fs.readdirSync(dir);
    //性别标识值
    const isSexNumberStr = /2640|2642/;
    let totalCount = 0;

    for (let i = 0; i < fileList.length; i++) {
        const filePath = path.join(dir, fileList[i]);
        const stat = fs.statSync(filePath);

        if (stat.isFile() && filePath.indexOf('.png') > -1) {
            const basename = path.basename(filePath, '.png');
            //用于处理性别标识
            const resultOfParseItemEmojiCode = [];
            //原始表情图片文件名
            let partsOfItemEmojiCode = [];
            if (basename.indexOf('-') > -1) {
                partsOfItemEmojiCode = basename.split('-');
                partsOfItemEmojiCode.forEach(function (item) {
                    //如果发现性别标识值
                    if (isSexNumberStr.test(item)) {
                        resultOfParseItemEmojiCode.push('200D');
                        resultOfParseItemEmojiCode.push(item);
                    } else {
                        resultOfParseItemEmojiCode.push(item);
                    }
                });
            } else {
                resultOfParseItemEmojiCode.push(basename);
            }

            emojiPNGFileNameList[convertUTF32MToUTF16m(resultOfParseItemEmojiCode.join('-').replace(/\-/ig, ' '))] = basename;
            totalCount += 1;
        }
    }

    //按最长匹配降序
    let keysList = Object.keys(emojiPNGFileNameList);
    keysList = keysList.sort(function (a, b) {
        return b.length - a.length;
    });

    for (let x = 0; x < keysList.length; x++) {
        emojiMapResult[keysList[x]] = emojiPNGFileNameList[keysList[x]];
    }

    const newEmojiMap = {};

    for (const k in emojiMapResult) {
        const item = emojiMapResult[k];
        //需要对表情key进行escape处理,以便与最终文本进行匹配
        newEmojiMap[escape(k).replace(/%u/ig, '\\u')] = item;
    }

    fs.writeFileSync("./map.json", JSON.stringify(newEmojiMap).replace(/\\\\u/ig, '\\u').replace(/%/ig, '\\u00').toLowerCase());

    console.log('已成功处理表情文件: ' + totalCount + '个');
})('./emoji_png');