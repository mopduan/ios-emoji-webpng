var convertUTF32MToUTF16m = require('./lib/convert').convertUTF32MToUTF16m;
var fs = require('fs');
var path = require('path');

(function (dir) {
    var emojiPNGFileNameList = {};
    var emojiMapResult = {};
    var fileList = fs.readdirSync(dir);
    //性别标识值
    var isSexNumberStr = /2640|2642/;
    var totalCount = 0;

    for (var i = 0; i < fileList.length; i++) {
        var filePath = path.join(dir, fileList[i]);
        var stat = fs.statSync(filePath);

        if (stat.isFile() && filePath.indexOf('.png') > -1) {
            var basename = path.basename(filePath, '.png');
            //用于处理性别标识
            var resultOfParseItemEmojiCode = [];
            //原始表情图片文件名
            var partsOfItemEmojiCode = [];
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
            totalCount++;
        }
    }

    //按最长匹配降序
    var keysList = Object.keys(emojiPNGFileNameList);
    keysList = keysList.sort(function (a, b) {
        return b.length - a.length;
    });

    for (var x = 0; x < keysList.length; x++) {
        emojiMapResult[keysList[x]] = emojiPNGFileNameList[keysList[x]];
    }

    var newEmojiMap = {};

    for (var k in emojiMapResult) {
        var item = emojiMapResult[k];
        //需要对表情key进行escape处理,以便与最终文本进行匹配
        newEmojiMap[escape(k).replace(/%u/ig, '\\u')] = item;
    }

    fs.writeFileSync("./map.json", JSON.stringify(newEmojiMap).replace(/\\\\u/ig, '\\u').replace(/%/ig, '\\u00').toLowerCase());

    console.log('已成功处理表情文件: ' + totalCount + '个');
})('./emoji_png')