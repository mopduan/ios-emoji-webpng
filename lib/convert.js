var copyrightParseResult = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

// ParseResult Object

// Define object

ParseResult.prototype.type = null;
ParseResult.prototype.value = null;
ParseResult.prototype.position = null;

ParseResult.prototype.copy = ParseResultCopy;
ParseResult.prototype.set = ParseResultSet;
ParseResult.prototype.isError = ParseResult_isError;
ParseResult.prototype.toString = ParseResultToString;

// Define functions

function ParseResult(type, position, value) {
    this.type = type;
    this.value = value;
    this.position = position;
}

function ParseResultCopy(type, position, value) {
    this.type = type;
    this.value = value;
    this.position = position;
}

function ParseResult_isError() {
    return this.type != null;
}

function ParseResultSet(type, position, value) {
    this.type = type;
    this.value = value;
    this.position = position;
}

function ParseResultToString() {
    var result = "OK";
    if (typeof(this.type) != "undefined") {
        result = this.type;
    }
    if (typeof(this.position) != "undefined") {
        result += ": input[" + this.position + "] = ";
    }
    if (typeof(this.value) != "undefined") {
        result += "0x" + this.value.toString(16).toUpperCase();
    }
    return result;
}

var copyrightUTF = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

var ALLOW_6BYTE = true; // true means interpret 6-byte UTF-8, otherwise don't

// UTF-16: converts code point array into UTF-16 code unit array

function toUTF16(cpArray, cuArray, parseResult) {
    parseResult.set();
    var u = 0;
    var bu;
    var lastPoint = 0;
    cuArray.length = 0;

    for (var p = 0; p < cpArray.length; ++p) {
        lastPoint = point;
        var point = cpArray[p];
        if (point < 0) {
            parseResult.set("illegal code point", p, point);
            return;
        } else if (point <= 0xFFFF) {
            if (0xD800 <= lastPoint && lastPoint <= 0xDFFF
                && 0xDC00 <= point && point <= 0xDFFF) {
                parseResult.set("illegal code point - surrogate pair: ", p, point);
                return;
            }
            cuArray[u++] = point;
        } else if (point <= 0x10FFFF) {
            point = point - 0x10000;
            cuArray[u++] = 0xD800 | (point >> 10);
            cuArray[u++] = 0xDC00 | (point & 0x3FF);
        } else {
            parseResult.set("illegal code point - out of bounds: ", p, point);
            return;
        }
    }
    cuArray.length = u;
}


// Convert from UTF-16 code unit array to code point array

// Does it one code unit at a time, to show how this can
// be done without looking ahead or back in array.

function fromUTF16(cuArray, cpArray, parseResult) {
    parseResult.set();
    var high = 0;
    var p = 0;
    cpArray.length = 0;
    for (var u = 0; u < cuArray.length; ++u) {
        var unit = cuArray[u];
        if (unit < 0 || unit > 0xFFFF) {
            parseResult.set("illegal code unit: ", u, unit);
            return;
        }
        if (high != 0) {
            if (unit >= 0xDC00 && unit <= 0xDFFF) {
                cpArray[p++] = 0x10000 + ((high - 0xD800) << 10) + (unit - 0xDC00);
                high = 0;
                continue;
            } else {
                cpArray[p++] = high; // no matching low surrogate
                high = 0;
            }
        }
        if (unit >= 0xD800 && unit < 0xDC00) {
            high = unit;
        } else {
            cpArray[p++] = unit;
        }
    }
    if (high != 0) cpArray[p++] = high; // pick up last one
    cpArray.length = p;
}


// UTF-8: converts code point array into UTF-8 code unit array

function toUTF8(cpArray, cuArray, parseResult) {
    parseResult.set();
    var u = 0;
    var bu;
    var lastPoint = 0;
    cuArray.length = 0;
    for (var p = 0; p < cpArray.length; ++p) {
        lastPoint = point;
        var point = cpArray[p];

        if (point < 0) {
            parseResult.set("illegal code point - out of bounds: ", p, point);
            return;
        } else if (point <= 0x7F) {
            cuArray[u++] = point;
        } else if (point <= 0x7FF) {
            u += 2;
            bu = u;
            cuArray[--bu] = 0x80 | (point & 0x3F);
            point >>= 6;
            cuArray[--bu] = 0xC0 | (point & 0x1F);
        } else if (point <= 0xFFFF) {
            if (0xD800 <= lastPoint && lastPoint <= 0xDFFF
                && 0xDC00 <= point && point <= 0xDFFF) {
                parseResult.set("illegal code point - surrogate pair: ", p, point);
                return;
            }
            u += 3;
            bu = u;
            cuArray[--bu] = 0x80 | (point & 0x3F);
            point >>= 6;
            cuArray[--bu] = 0x80 | (point & 0x3F);
            point >>= 6;
            cuArray[--bu] = 0xE0 | (point & 0x0F);
        } else if (point <= 0x10FFFF) {
            u += 4;
            bu = u;
            cuArray[--bu] = 0x80 | (point & 0x3F);
            point >>= 6;
            cuArray[--bu] = 0x80 | (point & 0x3F);
            point >>= 6;
            cuArray[--bu] = 0x80 | (point & 0x3F);
            point >>= 6;
            cuArray[--bu] = 0xF0 | (point & 0x07);
        } else {
            new ParseResult("illegal code point - out of bounds: ", p, point);
        }
    }
    cuArray.length = u;
}

// Converts UTF-8 code unit array into code point array

// Does it one code unit at a time, to show how this can
// be done without looking ahead or back in array.

function fromUTF8(cuArray, cpArray, parseResult) {
    parseResult.set();
    var count = 0;
    var point = 0;
    var p = 0;
    var shortestFormTest = 0;
    var lastPoint = 0;
    cpArray.length = 0;

    // process single byte at a time

    for (var u = 0; u < cuArray.length; ++u) {
        var b = cuArray[u];
        switch (count) {

            case 0:
                if (b < 0 || b > 0xF7) {
                    parseResult.set("illegal lead code unit", u, b);
                }
                switch (b) {
                    // 0xxxxxxx
                    case 0x00:
                    case 0x01:
                    case 0x02:
                    case 0x03:
                    case 0x04:
                    case 0x05:
                    case 0x06:
                    case 0x07:
                    case 0x10:
                    case 0x11:
                    case 0x12:
                    case 0x13:
                    case 0x14:
                    case 0x15:
                    case 0x16:
                    case 0x17:
                    case 0x20:
                    case 0x21:
                    case 0x22:
                    case 0x23:
                    case 0x24:
                    case 0x25:
                    case 0x26:
                    case 0x27:
                    case 0x30:
                    case 0x31:
                    case 0x32:
                    case 0x33:
                    case 0x34:
                    case 0x35:
                    case 0x36:
                    case 0x37:
                    case 0x40:
                    case 0x41:
                    case 0x42:
                    case 0x43:
                    case 0x44:
                    case 0x45:
                    case 0x46:
                    case 0x47:
                    case 0x50:
                    case 0x51:
                    case 0x52:
                    case 0x53:
                    case 0x54:
                    case 0x55:
                    case 0x56:
                    case 0x57:
                    case 0x60:
                    case 0x61:
                    case 0x62:
                    case 0x63:
                    case 0x64:
                    case 0x65:
                    case 0x66:
                    case 0x67:
                    case 0x70:
                    case 0x71:
                    case 0x72:
                    case 0x73:
                    case 0x74:
                    case 0x75:
                    case 0x76:
                    case 0x77:
                        cpArray[p++] = lastPoint = b;
                        break;

                    // 110xxxxx
                    case 0xC2:
                    case 0xC3:
                    case 0xC4:
                    case 0xC5:
                    case 0xC6:
                    case 0xC7:
                    case 0xD0:
                    case 0xD1:
                    case 0xD2:
                    case 0xD3:
                    case 0xD4:
                    case 0xD5:
                    case 0xD6:
                    case 0xD7:
                        count = 1;
                        point = b & 0x1F;
                        shortestFormTest = 0x80;
                        break;

                    // 1110xxxx
                    case 0xE0:
                    case 0xE1:
                    case 0xE2:
                    case 0xE3:
                    case 0xE4:
                    case 0xE5:
                    case 0xE6:
                    case 0xE7:
                        count = 2;
                        point = b & 0xF;
                        shortestFormTest = 0x800;
                        break;

                    // 11110xxx
                    case 0xF0:
                    case 0xF1:
                    case 0xF2:
                    case 0xF3:
                    case 0xF4:
                        count = 3;
                        point = b & 0x7;
                        shortestFormTest = 0x10000;
                        break;

                    // 10xxxxxx
                    default:
                        parseResult.set("illegal lead code unit", u, b);
                        return;
                }
                break;

            case 2:
            case 3:
                b -= 0x80;
                if (b < 0 || b > 0x3F) {
                    parseResult.set("illegal trail code unit", u, b + 0x80);
                }
                point = (point << 6) | b;
                --count;
                break;

            case 1:
                b -= 0x80;
                if (b < 0 || b > 0x3F) {
                    parseResult.set("illegal trail code unit", u, b + 0x80);
                }
                point = (point << 6) | b;
                --count;

                // we have gotten the code, so check and stash it

                if (point > 0x10FFFF) {
                    parseResult.set("illegal code point: too large", u, point);
                    return;
                }
                if (point < shortestFormTest) {
                    parseResult.set("Illegal: not shortest form: ", u, point);
                    return;
                }
                if (0xD800 <= lastPoint && lastPoint <= 0xDFFF
                    && 0xDC00 <= point && point <= 0xDFFF) {
                    if (ALLOW_6BYTE) {
                        cpArray[p - 1] = 0x10000 + ((lastPoint - 0xD800) << 10) + (point - 0xDC00);
                        lastPoint = point;
                        point = 0;
                        break;
                    }
                    parseResult.set("illegal code point - surrogate pair: ", u, point);
                    return;
                }
                cpArray[p++] = lastPoint = point;
                point = 0;
                break;
        }
    }
    if (count > 0) {
        parseResult.set("truncated code units", cuArray.length);
    }
    cpArray.length = p;
}

// Check cpArray for validity

function checkUTF32(cpArray, parseResult) {
    parseResult.set();
    var lastPoint = 0;
    for (var p = 0; p < cpArray.length; ++p) {
        lastPoint = point;
        var point = cpArray[p];
        if (point < 0 || point > 0x10FFFF) {
            parseResult.set("illegal code point - out of bounds: ", p, point);
            return;
        }
        if (0xD800 <= lastPoint && lastPoint <= 0xDFFF
            && 0xDC00 <= point && point <= 0xDFFF) {
            parseResult.set("illegal code point - surrogate pair: ", p, point);
            return;
        }
    }
}

// HEX and HTML Char
var copyrightHex = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

function htmlChar(intCode) {
    switch (intCode) {
        case 60:
            return "&lt;";
        case 62:
            return "&gt;";
        case 38:
            return "&amp;";
    }
    if (intCode < 0x20 || (intCode >= 0x7F && intCode < 0xA0)) return "^?";
    if (intCode <= 0xFFFF) return String.fromCharCode(intCode);
    toUTF16(intCode, cuArrayTemp, new ParseResult());
    return String.fromCharCode(cuArrayTemp[0], cuArrayTemp[1]);
}

var zeros = "00000000000000000000000000000000000000000000000";

// if the padding length < 0, it means go by bytes!

function toRadix(intCode, radix, padMaxValue) {
    var result = intCode.toString(radix).toUpperCase();
    var maxLen = padMaxValue.toString(radix).length;

    if (result.length < maxLen) {
        result = zeros.substring(0, maxLen - result.length) + result;
    }
    return result;
}

function breakIntoBytes(intArray, size) {
    // alert("intArray " + intArray.join(", ") + ", size " + size);
    var result = [];
    var u = 0;
    for (var i = 0; i < intArray.length; ++i) {
        var v = intArray[i];
        for (var j = size - 1; j >= 0; --j) {
            result[u++] = (v >>> j * 8) & 0xFF;
        }
    }
    // fill original
    for (var i = 0; i < result.length; ++i) {
        intArray[i] = result[i];
    }
}

function joinFromBytes(intArray, size) {
    //debugger;
    //alert("intArray " + intArray.join(", ") + ", size " + size);
    var result = [];
    var u = 0;
    var temp = 0;
    for (var i = 0; i < intArray.length; ++i) {
        temp <<= 8;
        temp |= intArray[i];
        if ((i % size) == (size - 1)) {
            result[u++] = temp;
            temp = 0;
        }
    }
    // fill original
    for (var i = 0; i < result.length; ++i) {
        intArray[i] = result[i];
    }
    intArray.length = result.length;
    //alert("intArray " + intArray.join(", ") + ", size " + size);
}

function toHex(intCode, padMaxValue) {
    return toRadix(intCode, 16, padMaxValue);
}

function arrayToRadix(intArray, radix, padMaxValue, pattern) {
// "&nbsp;"
    var prefix = "";
    var infix = " ";
    var suffix = "";
    if (pattern == undefined) pattern = '@ ';
    var p = pattern.indexOf('@');
    if (p >= 0) {
        prefix = pattern.substring(0, p);
        infix = pattern.substring(p + 1);
        p = infix.indexOf('@');
        if (p >= 0) {
            suffix = infix.substring(p + 1);
            infix = infix.substring(0, p);
        }
    }
    var result = prefix;
    for (var i = 0; i < intArray.length; ++i) {
        var v = toRadix(intArray[i], radix, padMaxValue);
        if (i != 0) result += infix;
        result += v;
    }
    return result + suffix;
}

function radixToArray(str, intArray, radix, parseResult) {
    var count = 0;
    var digit = 0;
    var accumulation = 0;
    var haveAccumulation = false;
    intArray.length = 0;
    for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);
        switch (c) {
            // 0..9
            case 0x30:
            case 0x31:
            case 0x32:
            case 0x33:
            case 0x34:
            case 0x35:
            case 0x36:
            case 0x37:
            case 0x38:
            case 0x39:
                digit = c - 0x30;
                if (digit >= radix) {
                    parseResult.set("illegal character: ", i, c);
                    return;
                }
                accumulation = (accumulation * radix) + digit;
                haveAccumulation = true;
                break;

            // a..f
            case 0x61:
            case 0x62:
            case 0x63:
            case 0x64:
            case 0x65:
            case 0x66:
                digit = c - 0x61 + 10;
                if (digit >= radix) {
                    parseResult.set("illegal character: ", i, c);
                    return;
                }
                accumulation = (accumulation * radix) + digit;
                haveAccumulation = true;
                break;

            // A..F
            case 0x41:
            case 0x42:
            case 0x43:
            case 0x44:
            case 0x45:
            case 0x46:
                digit = c - 0x41 + 10;
                if (digit >= radix) {
                    parseResult.set("illegal character: ", i, c);
                    return;
                }
                accumulation = (accumulation * radix) + digit;
                haveAccumulation = true;
                break;

            // comma, whitespace
            case 0x2C:
            case 0x09:
            case 0x0A:
            case 0x0B:
            case 0x0C:
            case 0x0D:
            case 0x20:
            case 0x85:
            case 0xA0:
            case 0x1680:
            case 0x2000:
            case 0x2001:
            case 0x2002:
            case 0x2003:
            case 0x2004:
            case 0x2005:
            case 0x2006:
            case 0x2007:
            case 0x2008:
            case 0x2008:
            case 0x200A:
            case 0x200B:
            case 0x2029:
            case 0x2028:
            case 0x202F:
            case 0x3000:
                if (haveAccumulation) {
                    intArray[count++] = accumulation;
                    accumulation = 0;
                    haveAccumulation = false;
                }
                break;

            default:
                parseResult.set("illegal hex character", i, c);
                return;
        }
    }
    if (haveAccumulation) {
        intArray[count++] = accumulation;
        accumulation = 0;
        //haveAccumulation = false;
    }
    intArray.length = count;
    parseResult.set();
}


// UTILITIES

function byteSwapArray(intArray, width) {
    for (var i = 0; i < intArray.length; ++i) {
        intArray[i] = byteSwap(intArray[i], width);
    }
}

function byteSwap(intValue, width) {
    if (width == 4) {
        return ((intValue & 0xFF) << 24)
            | ((intValue & 0xFF00) << 8)
            | ((intValue & 0xFF0000) >>> 8)
            | ((intValue & 0xFF000000) >>> 24);
    } else {
        return ((intValue & 0xFF) << 8) | ((intValue & 0xFF00) >>> 24);
    }
}

function fromText(str, cpArray, parseResult) {
    var cuArray = [];
    cuArray.length = str.length;
    for (var i = 0; i < str.length; ++i) {
        cuArray[i] = str.charCodeAt(i);
    }
    fromUTF16(cuArray, cpArray, parseResult);
}

function toText(cpArray, parseResult) {
    var cuArray = [];
    toUTF16(cpArray, cuArray, parseResult);
    var result = "";
    for (var i = 0; i < cuArray.length; ++i) {
        result += String.fromCharCode(cuArray[i]);
    }
    return result;
}

function copyTo(array1, start1, count1, array2, start2) {
    for (var i = 0; i < count1; ++i) {
        array2[i + start2] = array1[i + start1];
    }
}

function copyAllTo(array1, array2) {
    array2.length = array1.length;
    copyTo(array1, 0, array1.length, array2, 0);
}

var copyrightRACE = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

/**
 * Special global flag that alters RACE to store Latin-1 unchanged
 */
var fixLatin1 = false;

/**
 * Check ACE
 * @parameter inputString
 * @return true iff only characters in string are '-', 'a'-'z', '0'-'9'
 */
function checkACE(inputString) {
    for (var i = 0; i < inputString.length; ++i) {
        var ch = inputString.charAt(i);
        if (ch == '-' || 'a' <= ch && ch <= 'z' || '0' <= ch && ch <= '9') continue;
        return false;
    }
    return true;
}

/**
 * Converts from LACE compressed format (without Base32) (to UTF-16BE array)
 * @parameter iArray Array of bytes in LACE format
 * @parameter iCount Number of elements
 * @parameter oArray Array for output of bytes, UTF16-BE.
 *   Must be at least iCount+1 long
 * @return Length of output array used
 * @parameter parseResult output error value if any
 * @author Mark Davis
 */

function fromRACE(iArray, iCount, oArray, parseResult) {
    if (iCount < 1 || iCount > 63) {
        parseResult.set("Race: count out of range", iCount);
        return;
    }
    var op = 0;

    // get header
    var U1 = iArray[0];

    // do conditions

    switch (U1) {
        case 0xD8:
            if ((iCount % 2) == 0) {
                parseResult.set("Race: odd length", iCount);
                return;
            }
            copyTo(iArray, 1, iCount - 1, oArray, 0);
            return iCount - 1;
            break;
        case 0x00: // Do Latin-1 WARNING: not in RACE-02
            if (fixLatin1) {
                for (var i = 1; i < iCount; ++i) {
                    oArray[op++] = 0;
                    oArray[op++] = iArray[i];
                }
                return op;
            } // else drop through to normal case
        default:
            for (var i = 1; i < iCount; ++i) {
                var byte1 = iArray[i];
                if (byte1 != 0xFF) {
                    oArray[op++] = U1;
                    oArray[op++] = byte1;
                } else { // is FF
                    ++i; // skip one
                    if (i >= iCount) {
                        parseResult.set("Race: truncated", iCount);
                        return;
                    }
                    byte1 = iArray[i];
                    if (byte1 == 0x99) {
                        oArray[op++] = U1;
                        oArray[op++] = FF;
                    } else {
                        oArray[op++] = 0;
                        oArray[op++] = byte1;
                    }
                }
            }
            break;
    }
    return op;
}

/**
 * Converts to RACE compression format (without Base32) (from UTF-16BE array)
 * @parameter iArray Array of bytes in UTF16-BE
 * @parameter iCount Number of elements. Must be 0..63
 * @parameter oArray Array for output of RACE bytes.
 *   Must be at least 100 octets long to provide internal working space
 * @return Length of output array used
 * @parameter parseResult output error value if any
 * @author Mark Davis
 */

function toRACE(iArray, iCount, oArray, parseResult) {
    if (iCount < 1 || iCount > 62) {
        parseResult.set("Race: count out of range", iCount);
        return;
    }
    if ((iCount % 2) == 1) {
        parseResult.set("Race: odd length", iCount);
        return;
    }
    var op = 0;

    // check for multiple high bytes

    var U1 = 0;
    for (var ip = 0; ip < iCount; ip += 2) {
        var high = iArray[ip];
        if (high != U1 && high != 0) {
            if (U1 == 0) {
                U1 = high;
            } else {
                oArray[op++] = 0xD8;
                copyTo(iArray, 0, iCount, oArray, 1);
                return iCount + 1;
            }
        }
    }

    if (U1 >= 0xD8 && U1 <= 0xDC) {
        parseResult.set("Race: illegal high value", 0, U1);
        return;
    }

    // add header byte

    oArray[op++] = U1;
    status = U1;

    // check for Latin-1 WARNING: not in RACE-02

    if (fixLatin1 && U1 == 0) { // latin-1
        copyTo(iArray, 0, iCount, oArray, 1);
        return iCount + 1;
    }

    // output processed codes

    for (var ip = 0; ip < iCount; ++ip) {
        var high = iArray[ip++];
        var low = iArray[ip];
        if (high == U1) {
            oArray[op++] = low;
            if (low == 0xFF) {
                oArray[op++] = 0x99;
            }
        } else {
            if (low == 0x99) {
                parseResult.set("Race: illegal low value", ip, low);
                return;
            }
            oArray[op++] = 0xFF;
            oArray[op++] = low;
        }
    }
    return op;
}

var copyrightLACE = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

/**
 * Converts from LACE compressed format (without Base32) to UTF-16BE array
 * @parameter iArray Array of bytes in LACE format
 * @parameter iCount Number of elements
 * @parameter oArray Array for output of bytes, UTF16-BE.
 *   Must be at least iCount+1 long
 * @return Length of output array used
 * @parameter parseResult output error value if any
 * @author Mark Davis
 */

function fromLACE(iArray, iCount, oArray, parseResult) {
    var high;
    if (iCount < 1 || iCount > 63) {
        parseResult.set("fromLACE: count out of range", iCount);
        return;
    }
    var op = 0;
    var ip = 0;
    var result = 0;
    if (iArray[ip] == 0xFF) {  // special case FF
        copyTo(iArray, 1, iCount - 1, oArray, 0);
        result = iCount - 1;
    } else {
        while (ip < iCount) {  // loop over runs
            var count = iArray[ip++];
            if (ip == iCount) {
                parseResult.set("fromLACE: truncated before high", ip);
                return;
            }
            high = iArray[ip++];
            for (var i = 0; i < count; ++i) {
                oArray[op++] = high;
                if (ip == iCount) {
                    parseResult.set("fromLACE: truncated from count", ip);
                    return;
                }
                oArray[op++] = iArray[ip++];
            }
        }
        result = op;
    }

    // check for uniqueness

    var checkArray = [];
    var checkCount = toLACE(oArray, result, checkArray, parseResult);
    if (!equals(iArray, iCount, checkArray, checkCount)) {
        parseResult.set("fromLACE: illegal input form");
        return;
    }
    return result;
}


/**
 * Converts to LACE compression format (without Base32) from UTF-16BE array
 * @parameter iArray Array of bytes in UTF16-BE
 * @parameter iCount Number of elements. Must be 0..63
 * @parameter oArray Array for output of LACE bytes.
 *   Must be at least 100 octets long to provide internal working space
 * @return Length of output array used
 * @parameter parseResult output error value if any
 * @author Mark Davis
 */

function toLACE(iArray, iCount, oArray, parseResult) {
//debugger;
    if (iCount < 1 || iCount > 62) {
        parseResult.set("Lace: count out of range", iCount);
        return;
    }
    if ((iCount % 2) == 1) {
        parseResult.set("Lace: odd length, can't be UTF-16", iCount);
        return;
    }
    var op = 0;                      // input index
    var ip = 0;                      // output index
    var lastHigh = -1;
    var lenp = 0;
    while (ip < iCount) {
        var high = iArray[ip++];
        if (high != lastHigh) {
            if (lastHigh != -1) {        // store last length
                var len = op - lenp - 2;
                oArray[lenp] = len;
            }
            lenp = op++;                 // reserve space
            oArray[op++] = high;
            lastHigh = high;
        }
        oArray[op++] = iArray[ip++];
    }

    // store last len

    var len = op - lenp - 2;
    oArray[lenp] = len;

    // see if the input is short, and we should
    // just copy

    if (op > iCount) {
        if (op > 63) {
            parseResult.set("Lace: output too long", op);
            return;
        }
        oArray[0] = 0xFF;
        copyTo(iArray, 0, iCount, oArray, 1);
        op = iCount + 1;
    }
    return op;
}

/**
 * Utility routine for comparing arrays
 * @parameter array1 first array to compare
 * @parameter count1 number of elements to compare in first array
 * @parameter array2 second array to compare
 * @parameter count1 number of elements to compare in second array
 * @return true iff counts are same, and elements from 0 to count-1 are the same
 */

function equals(array1, count1, array2, count2) {
    if (count1 != count2) return false;
    for (var i = 0; i < count1; ++i) {
        if (array1[i] != array2[i]) return false;
    }
    return true;
}

/**
 * Utility routine for getting array of bytes from UTF-16 string
 * @parameter str source string
 * @parameter oArray output array to fill in
 * @return count of bytes put into oArray
 */

function utf16FromString(str, oArray) {
    var op = 0;
    for (var i = 0; i < str.length; ++i) {
        var code = str.charCodeAt(i);
        oArray[op++] = (code >>> 8);  // top byte
        oArray[op++] = (code & 0xFF); // bottom byte
    }
    return op;
}

/**
 * Utility routine for getting array of bytes from UTF-16 string
 * @parameter str source string
 * @parameter oArray output array to fill in
 * @return count of bytes put into oArray
 */

function stringFromUtf16(iArray, iCount) {
    result = "";
    for (var i = 0; i < iCount; i += 2) {
        result += String.fromCharCode((iArray[i] << 8) + iArray[i + 1]);
    }
    return result;
}

/**
 * Utility routine to see if string doesn't need LACE
 * @parameter str source string
 * @return true if ok already
 */

function okAlready(str) {
    for (var i = 0; i < str.length; ++i) {
        var c = str.charAt(i);
        if (c == '-' || 'a' <= c && c <= 'z' || '0' <= c && c <= '9') continue;
        return false;
    }
    return true
}


var copyrightBase32 = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

var baseDebugTo = false;
var baseDebugFrom = false;

function toBase32String(iArray, parseResult) {
    var result = "bq--";
    var temp = [];
    if (baseDebugTo) alert("to32: " + iArray.join(', '));
    toBase32(iArray, iArray.length, temp, parseResult);
    if (baseDebugTo) alert("to32-ch: " + temp.join(', '));
    for (var i = 0; i < temp.length; ++i) {
        result += String.fromCharCode(temp[i]);
    }
    return result;
}

function fromBase32String(str, oArray, parseResult) {
    str = str.toLowerCase();
    if (str.substring(0, 4) != "bq--") {
        parseResult.set("Base32 - must begin with 'bq--'", 0);
        return;
    }
    var temp = [];
    for (var i = 4; i < str.length; ++i) {
        temp[i - 4] = str.charCodeAt(i);
    }
    if (baseDebugFrom) alert("from32-ch: " + temp.join(', '));
    var len = fromBase32(temp, temp.length, oArray, parseResult);
    if (parseResult.isError()) return;
    if (baseDebugFrom) alert("from32: " + oArray.join(', '));
    oArray.length = len;
}

/**
 * Convert from bytes to base32
 * @parameter input Input buffer of bytes with values 00 to FF
 * @parameter inputLength Length of input buffer
 * @parameter output Output buffer, to be filled with with values from a-z2-7.
 * Must be of at least length input*8/5 + 1
 * @return Length of output buffer used
 * @author Mark Davis
 */

function toBase32(input, inputLength, output, parseResult) {
    //debugger;
    var bits = 0;
    var bitCount = 0;
    var ip = 0;
    var op = 0;
    var val = 0;
    while (true) {

        // get bits if we don't have enough

        if (bitCount < 5) {
            if (ip >= inputLength) break;
            // get another input
            bits <<= 8;
            if (baseDebugTo) alert("byte: " + input[ip].toString(16) + ", bitCount: " + (bitCount + 8));

            bits = bits | input[ip++];
            bitCount += 8;
        }

        // emit and remove them

        bitCount -= 5;
        val = (bits >> bitCount);
        if (baseDebugTo) alert("Val: " + val.toString(16) + ", bitCount: " + bitCount);
        output[op++] = toLetter(val);
        //if (baseDebugTo) alert("out: " + output[op-1].toString(16));
        bits &= ~(0x1F << bitCount);
    }

    // add padding and output if necessary

    if (bitCount > 0) {
        if (baseDebugTo) alert("bits*: " + bits.toString(16) + ", bitCount: " + bitCount);
        val = bits << (5 - bitCount);
        if (baseDebugTo) alert("out*: " + val.toString(16));
        output[op++] = toLetter(val);
    }
    return op;
}

/**
 * Convert from base32 to bytes
 * @parameter input Input buffer of bytes with values from a-z2-7
 * @parameter inputLength Length of input buffer
 * @parameter output Output buffer, to be filled with bytes from 00 to FF.
 * Must be of at least length input*5/8 + 1
 * @return Length of output buffer used
 * @author Mark Davis
 */

function fromBase32(input, inputLength, output, parseResult) {
    //debugger;
    var inputCheck = inputLength % 8;
    if (inputCheck == 1 || inputCheck == 3 || inputCheck == 6) {
        parseResult.set("Base32 excess length", inputLength);
        return;
    }
    var bits = 0;
    var bitCount = 0;
    var ip = 0;
    var op = 0;
    var val = 0;
    while (ip < inputLength) {

        // get more bits
        var val = input[ip++];
        val = fromLetter(val);
        if (val < 0 || val > 0x3F) {
            parseResult.set("Bad Base32 byte", ip - 1, val);
            return;
        }
        if (baseDebugFrom) alert("base32: " + val.toString(16));
        bits <<= 5;
        bits = bits | val;
        bitCount += 5;
        if (baseDebugFrom) alert("from: " + val.toString(16) + ", bitCount: " + bitCount);

        // emit & remove if we can

        if (bitCount >= 8) {
            bitCount -= 8;
            output[op++] = bits >> bitCount;
            if (baseDebugFrom) alert("out2: " + (bits >> bitCount) + ", bitCount: " + bitCount);
            bits &= ~(0xFF << bitCount);
        }
    }

    // check that padding is with zero!
    if (bits != 0) return -ip;
    return op;
}

// ==================
function toLetter(val) {
    if (val > 25) return val - 26 + 0x32;
    return val + 0x61;
    // return val + (val < 26 ? 0x61 : 0x18);
}

function fromLetter(val) {
    if (val < 0x61) return val + 26 - 0x32;
    return val - 0x61;
}


var copyrightNormalize = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

/**
 * Functions for normalization. Not particularly optimized. Requires data from Normalization_data.js
 */

/**
 * Normalizes to form NFKD
 * @parameter source source string
 * @return normalized version
 */
function NFKD(source) {
    var result = "";
    var k;
    for (var i = 0; i < source.length; ++i) {
        var buffer = rawDecompose(source.charCodeAt(i));

        // add all of the characters in the decomposition.
        // (may be just the original character, if there was
        // no decomposition mapping)

        for (var j = 0; j < buffer.length; ++j) {
            var ch = buffer.charCodeAt(j);
            var chClass = canonicalClass(ch);
            if (chClass == 0) {
                result += String.fromCharCode(ch);
                continue;
            }

            // bubble-sort combining marks as necessary

            for (k = result.length - 1; k >= 0; --k) {
                //alert("k: " + k + ", CC[k]: " + CC[result.charCodeAt(k)] + ", CC[ch]: " + chClass);
                if (canonicalClass(result.charCodeAt(k)) <= chClass) break;
            }
            result = replace(result, k + 1, k + 1, String.fromCharCode(ch));
        }
    }
    return result;
}

/**
 * Normalizes to form NFKC
 * @parameter source source string
 * @return normalized version
 */
function NFKC(str) {
    return compose(NFKD(str));
}

/**
 * Internal function for NFKC
 * @parameter source source string
 * @return normalized version
 */
function compose(source) {
    //alert("compose: " + source);
    var result = "";
    if (source.length == 0) return result;

    var buffer = "";
    var starterCh = source.charCodeAt(0);
    var lastClass = canonicalClass(starterCh);
    if (lastClass != 0) lastClass = 256; // fix for strings starting with a combining mark

    // Loop on the decomposed characters, combining where possible

    for (var decompPos = 1; decompPos < source.length; ++decompPos) {
        //alert("result: '" + result + "' start: '" + String.fromCharCode(starterCh) + "' buffer: '" + buffer
        //+ "' source: '" + source.substring(decompPos) + "'");
        var ch = source.charCodeAt(decompPos);
        var chClass = canonicalClass(ch);
        var composite = rawCompose(starterCh, ch);
        if (composite != null && (lastClass < chClass || lastClass == 0)) {
            //alert("start: '" + String.fromCharCode(starterCh)
            //+ "' second: '" + String.fromCharCode(ch)
            //+ "' => '" + String.fromCharCode(composite));
            starterCh = composite;
        } else {
            if (chClass == 0) {
                result += String.fromCharCode(starterCh) + buffer;
                buffer.length = 0;
                starterCh = ch;
            } else {
                buffer += String.fromCharCode(ch);
            }
            lastClass = chClass;
        }
    }
    return result + String.fromCharCode(starterCh) + buffer;
}

/**
 * Internal utility for decomposing. Uses Javascript object as simple lookup.
 * @parameter ch source character
 * @return raw NFKD decomposition.
 */
function rawDecompose(ch) {
    if (SBase <= ch && ch < SLimit) return decomposeHangul(ch);
    var result = KD[ch];
    if (result != null) return result;
    return String.fromCharCode(ch);
}

/**
 * Internal function for composing. Uses Javascript object as simple lookup.
 * WARNING: DOESN'T DO HANGUL YET
 * @parameter char1 first character to check
 * @parameter char1 second character to check
 * @return composed character, or null if there is none.
 */
function rawCompose(char1, char2) {
    var temp = composeHangul(char1, char2);
    if (temp != null) return temp;
    return KC[(char1 << 16) | char2];
}

/**
 * Internal function for NFKC
 * Returns canonical class, using Javascript object for simple lookup.
 * @parameter ch character to check
 * @return canonical class, number from 0 to 255
 */
function canonicalClass(ch) {
    var result = CC[ch];
    if (result != null) return result;
    return 0;
}

/**
 * Utility, since Javascript doesn't have it
 * @parameter sourceString String to replace extent in
 * @parameter startPos starting position of text to delete and replace
 * @parameter endPos ending position (as with substring, index of 1 past last char to replace)
 * @parameter insertionString string to put in
 * @return string with replacement done
 */
function replace(sourceString, startPos, endPos, insertionString) {
    return sourceString.substring(0, startPos)
        + insertionString
        + sourceString.substring(endPos, sourceString.length);
}

// constants for Hangul
var SBase = 0xAC00,
    LBase = 0x1100, VBase = 0x1161, TBase = 0x11A7,
    LCount = 19, VCount = 21, TCount = 28,
    NCount = VCount * TCount,   // 588
    SCount = LCount * NCount,   // 11,172
    LLimit = LBase + LCount,    // 1113
    VLimit = VBase + VCount,    // 1176
    TLimit = TBase + TCount,    // 11C3
    SLimit = SBase + SCount;    // D7A4

/**
 * Internal utility for decomposing.
 * @parameter ch source character
 * @return raw decomposition.
 */
function decomposeHangul(s) {
    var SIndex = s - SBase;
    var L = LBase + SIndex / NCount;
    var V = VBase + (SIndex % NCount) / TCount;
    var T = TBase + SIndex % TCount;
    var result = String.fromCharCode(L) + String.fromCharCode(V);
    if (T != TBase) result += String.fromCharCode(T);
    return result;
}

/**
 * Internal function for composing.
 * @parameter char1 first character to check
 * @parameter char1 second character to check
 * @return composed character, or null if there is none.
 */
function composeHangul(char1, char2) {
    if (LBase <= char1 && char1 < LLimit && VBase <= char2 && char2 < VLimit) {
        return (SBase + ((char1 - LBase) * VCount + (char2 - VBase)) * TCount);
    }
    if (SBase <= char1 && char1 < SLimit && TBase <= char2 && char2 < TLimit
        && ((char1 - SBase) % TCount) == 0) {
        return char1 + (char2 - TBase);
    }
    return null; // no composition
}


var KD = new Object();
// NOTE: Hangul is done in code!
KD[0x00A0] = '\u0020';
KD[0x00A8] = '\u0020\u0308';
KD[0x00AA] = '\u0061';
KD[0x00AF] = '\u0020\u0304';
KD[0x00B2] = '\u0032';
KD[0x00B3] = '\u0033';
KD[0x00B4] = '\u0020\u0301';
KD[0x00B5] = '\u03BC';
KD[0x00B8] = '\u0020\u0327';
KD[0x00B9] = '\u0031';
KD[0x00BA] = '\u006F';
KD[0x00BC] = '\u0031\u2044\u0034';
KD[0x00BD] = '\u0031\u2044\u0032';
KD[0x00BE] = '\u0033\u2044\u0034';
KD[0x00C0] = '\u0041\u0300';
KD[0x00C1] = '\u0041\u0301';
KD[0x00C2] = '\u0041\u0302';
KD[0x00C3] = '\u0041\u0303';
KD[0x00C4] = '\u0041\u0308';
KD[0x00C5] = '\u0041\u030A';
KD[0x00C7] = '\u0043\u0327';
KD[0x00C8] = '\u0045\u0300';
KD[0x00C9] = '\u0045\u0301';
KD[0x00CA] = '\u0045\u0302';
KD[0x00CB] = '\u0045\u0308';
KD[0x00CC] = '\u0049\u0300';
KD[0x00CD] = '\u0049\u0301';
KD[0x00CE] = '\u0049\u0302';
KD[0x00CF] = '\u0049\u0308';
KD[0x00D1] = '\u004E\u0303';
KD[0x00D2] = '\u004F\u0300';
KD[0x00D3] = '\u004F\u0301';
KD[0x00D4] = '\u004F\u0302';
KD[0x00D5] = '\u004F\u0303';
KD[0x00D6] = '\u004F\u0308';
KD[0x00D9] = '\u0055\u0300';
KD[0x00DA] = '\u0055\u0301';
KD[0x00DB] = '\u0055\u0302';
KD[0x00DC] = '\u0055\u0308';
KD[0x00DD] = '\u0059\u0301';
KD[0x00E0] = '\u0061\u0300';
KD[0x00E1] = '\u0061\u0301';
KD[0x00E2] = '\u0061\u0302';
KD[0x00E3] = '\u0061\u0303';
KD[0x00E4] = '\u0061\u0308';
KD[0x00E5] = '\u0061\u030A';
KD[0x00E7] = '\u0063\u0327';
KD[0x00E8] = '\u0065\u0300';
KD[0x00E9] = '\u0065\u0301';
KD[0x00EA] = '\u0065\u0302';
KD[0x00EB] = '\u0065\u0308';
KD[0x00EC] = '\u0069\u0300';
KD[0x00ED] = '\u0069\u0301';
KD[0x00EE] = '\u0069\u0302';
KD[0x00EF] = '\u0069\u0308';
KD[0x00F1] = '\u006E\u0303';
KD[0x00F2] = '\u006F\u0300';
KD[0x00F3] = '\u006F\u0301';
KD[0x00F4] = '\u006F\u0302';
KD[0x00F5] = '\u006F\u0303';
KD[0x00F6] = '\u006F\u0308';
KD[0x00F9] = '\u0075\u0300';
KD[0x00FA] = '\u0075\u0301';
KD[0x00FB] = '\u0075\u0302';
KD[0x00FC] = '\u0075\u0308';
KD[0x00FD] = '\u0079\u0301';
KD[0x00FF] = '\u0079\u0308';
KD[0x0100] = '\u0041\u0304';
KD[0x0101] = '\u0061\u0304';
KD[0x0102] = '\u0041\u0306';
KD[0x0103] = '\u0061\u0306';
KD[0x0104] = '\u0041\u0328';
KD[0x0105] = '\u0061\u0328';
KD[0x0106] = '\u0043\u0301';
KD[0x0107] = '\u0063\u0301';
KD[0x0108] = '\u0043\u0302';
KD[0x0109] = '\u0063\u0302';
KD[0x010A] = '\u0043\u0307';
KD[0x010B] = '\u0063\u0307';
KD[0x010C] = '\u0043\u030C';
KD[0x010D] = '\u0063\u030C';
KD[0x010E] = '\u0044\u030C';
KD[0x010F] = '\u0064\u030C';
KD[0x0112] = '\u0045\u0304';
KD[0x0113] = '\u0065\u0304';
KD[0x0114] = '\u0045\u0306';
KD[0x0115] = '\u0065\u0306';
KD[0x0116] = '\u0045\u0307';
KD[0x0117] = '\u0065\u0307';
KD[0x0118] = '\u0045\u0328';
KD[0x0119] = '\u0065\u0328';
KD[0x011A] = '\u0045\u030C';
KD[0x011B] = '\u0065\u030C';
KD[0x011C] = '\u0047\u0302';
KD[0x011D] = '\u0067\u0302';
KD[0x011E] = '\u0047\u0306';
KD[0x011F] = '\u0067\u0306';
KD[0x0120] = '\u0047\u0307';
KD[0x0121] = '\u0067\u0307';
KD[0x0122] = '\u0047\u0327';
KD[0x0123] = '\u0067\u0327';
KD[0x0124] = '\u0048\u0302';
KD[0x0125] = '\u0068\u0302';
KD[0x0128] = '\u0049\u0303';
KD[0x0129] = '\u0069\u0303';
KD[0x012A] = '\u0049\u0304';
KD[0x012B] = '\u0069\u0304';
KD[0x012C] = '\u0049\u0306';
KD[0x012D] = '\u0069\u0306';
KD[0x012E] = '\u0049\u0328';
KD[0x012F] = '\u0069\u0328';
KD[0x0130] = '\u0049\u0307';
KD[0x0132] = '\u0049\u004A';
KD[0x0133] = '\u0069\u006A';
KD[0x0134] = '\u004A\u0302';
KD[0x0135] = '\u006A\u0302';
KD[0x0136] = '\u004B\u0327';
KD[0x0137] = '\u006B\u0327';
KD[0x0139] = '\u004C\u0301';
KD[0x013A] = '\u006C\u0301';
KD[0x013B] = '\u004C\u0327';
KD[0x013C] = '\u006C\u0327';
KD[0x013D] = '\u004C\u030C';
KD[0x013E] = '\u006C\u030C';
KD[0x013F] = '\u004C\u00B7';
KD[0x0140] = '\u006C\u00B7';
KD[0x0143] = '\u004E\u0301';
KD[0x0144] = '\u006E\u0301';
KD[0x0145] = '\u004E\u0327';
KD[0x0146] = '\u006E\u0327';
KD[0x0147] = '\u004E\u030C';
KD[0x0148] = '\u006E\u030C';
KD[0x0149] = '\u02BC\u006E';
KD[0x014C] = '\u004F\u0304';
KD[0x014D] = '\u006F\u0304';
KD[0x014E] = '\u004F\u0306';
KD[0x014F] = '\u006F\u0306';
KD[0x0150] = '\u004F\u030B';
KD[0x0151] = '\u006F\u030B';
KD[0x0154] = '\u0052\u0301';
KD[0x0155] = '\u0072\u0301';
KD[0x0156] = '\u0052\u0327';
KD[0x0157] = '\u0072\u0327';
KD[0x0158] = '\u0052\u030C';
KD[0x0159] = '\u0072\u030C';
KD[0x015A] = '\u0053\u0301';
KD[0x015B] = '\u0073\u0301';
KD[0x015C] = '\u0053\u0302';
KD[0x015D] = '\u0073\u0302';
KD[0x015E] = '\u0053\u0327';
KD[0x015F] = '\u0073\u0327';
KD[0x0160] = '\u0053\u030C';
KD[0x0161] = '\u0073\u030C';
KD[0x0162] = '\u0054\u0327';
KD[0x0163] = '\u0074\u0327';
KD[0x0164] = '\u0054\u030C';
KD[0x0165] = '\u0074\u030C';
KD[0x0168] = '\u0055\u0303';
KD[0x0169] = '\u0075\u0303';
KD[0x016A] = '\u0055\u0304';
KD[0x016B] = '\u0075\u0304';
KD[0x016C] = '\u0055\u0306';
KD[0x016D] = '\u0075\u0306';
KD[0x016E] = '\u0055\u030A';
KD[0x016F] = '\u0075\u030A';
KD[0x0170] = '\u0055\u030B';
KD[0x0171] = '\u0075\u030B';
KD[0x0172] = '\u0055\u0328';
KD[0x0173] = '\u0075\u0328';
KD[0x0174] = '\u0057\u0302';
KD[0x0175] = '\u0077\u0302';
KD[0x0176] = '\u0059\u0302';
KD[0x0177] = '\u0079\u0302';
KD[0x0178] = '\u0059\u0308';
KD[0x0179] = '\u005A\u0301';
KD[0x017A] = '\u007A\u0301';
KD[0x017B] = '\u005A\u0307';
KD[0x017C] = '\u007A\u0307';
KD[0x017D] = '\u005A\u030C';
KD[0x017E] = '\u007A\u030C';
KD[0x017F] = '\u0073';
KD[0x01A0] = '\u004F\u031B';
KD[0x01A1] = '\u006F\u031B';
KD[0x01AF] = '\u0055\u031B';
KD[0x01B0] = '\u0075\u031B';
KD[0x01C4] = '\u0044\u005A\u030C';
KD[0x01C5] = '\u0044\u007A\u030C';
KD[0x01C6] = '\u0064\u007A\u030C';
KD[0x01C7] = '\u004C\u004A';
KD[0x01C8] = '\u004C\u006A';
KD[0x01C9] = '\u006C\u006A';
KD[0x01CA] = '\u004E\u004A';
KD[0x01CB] = '\u004E\u006A';
KD[0x01CC] = '\u006E\u006A';
KD[0x01CD] = '\u0041\u030C';
KD[0x01CE] = '\u0061\u030C';
KD[0x01CF] = '\u0049\u030C';
KD[0x01D0] = '\u0069\u030C';
KD[0x01D1] = '\u004F\u030C';
KD[0x01D2] = '\u006F\u030C';
KD[0x01D3] = '\u0055\u030C';
KD[0x01D4] = '\u0075\u030C';
KD[0x01D5] = '\u0055\u0308\u0304';
KD[0x01D6] = '\u0075\u0308\u0304';
KD[0x01D7] = '\u0055\u0308\u0301';
KD[0x01D8] = '\u0075\u0308\u0301';
KD[0x01D9] = '\u0055\u0308\u030C';
KD[0x01DA] = '\u0075\u0308\u030C';
KD[0x01DB] = '\u0055\u0308\u0300';
KD[0x01DC] = '\u0075\u0308\u0300';
KD[0x01DE] = '\u0041\u0308\u0304';
KD[0x01DF] = '\u0061\u0308\u0304';
KD[0x01E0] = '\u0041\u0307\u0304';
KD[0x01E1] = '\u0061\u0307\u0304';
KD[0x01E2] = '\u00C6\u0304';
KD[0x01E3] = '\u00E6\u0304';
KD[0x01E6] = '\u0047\u030C';
KD[0x01E7] = '\u0067\u030C';
KD[0x01E8] = '\u004B\u030C';
KD[0x01E9] = '\u006B\u030C';
KD[0x01EA] = '\u004F\u0328';
KD[0x01EB] = '\u006F\u0328';
KD[0x01EC] = '\u004F\u0328\u0304';
KD[0x01ED] = '\u006F\u0328\u0304';
KD[0x01EE] = '\u01B7\u030C';
KD[0x01EF] = '\u0292\u030C';
KD[0x01F0] = '\u006A\u030C';
KD[0x01F1] = '\u0044\u005A';
KD[0x01F2] = '\u0044\u007A';
KD[0x01F3] = '\u0064\u007A';
KD[0x01F4] = '\u0047\u0301';
KD[0x01F5] = '\u0067\u0301';
KD[0x01F8] = '\u004E\u0300';
KD[0x01F9] = '\u006E\u0300';
KD[0x01FA] = '\u0041\u030A\u0301';
KD[0x01FB] = '\u0061\u030A\u0301';
KD[0x01FC] = '\u00C6\u0301';
KD[0x01FD] = '\u00E6\u0301';
KD[0x01FE] = '\u00D8\u0301';
KD[0x01FF] = '\u00F8\u0301';
KD[0x0200] = '\u0041\u030F';
KD[0x0201] = '\u0061\u030F';
KD[0x0202] = '\u0041\u0311';
KD[0x0203] = '\u0061\u0311';
KD[0x0204] = '\u0045\u030F';
KD[0x0205] = '\u0065\u030F';
KD[0x0206] = '\u0045\u0311';
KD[0x0207] = '\u0065\u0311';
KD[0x0208] = '\u0049\u030F';
KD[0x0209] = '\u0069\u030F';
KD[0x020A] = '\u0049\u0311';
KD[0x020B] = '\u0069\u0311';
KD[0x020C] = '\u004F\u030F';
KD[0x020D] = '\u006F\u030F';
KD[0x020E] = '\u004F\u0311';
KD[0x020F] = '\u006F\u0311';
KD[0x0210] = '\u0052\u030F';
KD[0x0211] = '\u0072\u030F';
KD[0x0212] = '\u0052\u0311';
KD[0x0213] = '\u0072\u0311';
KD[0x0214] = '\u0055\u030F';
KD[0x0215] = '\u0075\u030F';
KD[0x0216] = '\u0055\u0311';
KD[0x0217] = '\u0075\u0311';
KD[0x0218] = '\u0053\u0326';
KD[0x0219] = '\u0073\u0326';
KD[0x021A] = '\u0054\u0326';
KD[0x021B] = '\u0074\u0326';
KD[0x021E] = '\u0048\u030C';
KD[0x021F] = '\u0068\u030C';
KD[0x0226] = '\u0041\u0307';
KD[0x0227] = '\u0061\u0307';
KD[0x0228] = '\u0045\u0327';
KD[0x0229] = '\u0065\u0327';
KD[0x022A] = '\u004F\u0308\u0304';
KD[0x022B] = '\u006F\u0308\u0304';
KD[0x022C] = '\u004F\u0303\u0304';
KD[0x022D] = '\u006F\u0303\u0304';
KD[0x022E] = '\u004F\u0307';
KD[0x022F] = '\u006F\u0307';
KD[0x0230] = '\u004F\u0307\u0304';
KD[0x0231] = '\u006F\u0307\u0304';
KD[0x0232] = '\u0059\u0304';
KD[0x0233] = '\u0079\u0304';
KD[0x02B0] = '\u0068';
KD[0x02B1] = '\u0266';
KD[0x02B2] = '\u006A';
KD[0x02B3] = '\u0072';
KD[0x02B4] = '\u0279';
KD[0x02B5] = '\u027B';
KD[0x02B6] = '\u0281';
KD[0x02B7] = '\u0077';
KD[0x02B8] = '\u0079';
KD[0x02D8] = '\u0020\u0306';
KD[0x02D9] = '\u0020\u0307';
KD[0x02DA] = '\u0020\u030A';
KD[0x02DB] = '\u0020\u0328';
KD[0x02DC] = '\u0020\u0303';
KD[0x02DD] = '\u0020\u030B';
KD[0x02E0] = '\u0263';
KD[0x02E1] = '\u006C';
KD[0x02E2] = '\u0073';
KD[0x02E3] = '\u0078';
KD[0x02E4] = '\u0295';
KD[0x0340] = '\u0300';
KD[0x0341] = '\u0301';
KD[0x0343] = '\u0313';
KD[0x0344] = '\u0308\u0301';
KD[0x0374] = '\u02B9';
KD[0x037A] = '\u0020\u0345';
KD[0x037E] = '\u003B';
KD[0x0384] = '\u0020\u0301';
KD[0x0385] = '\u0020\u0308\u0301';
KD[0x0386] = '\u0391\u0301';
KD[0x0387] = '\u00B7';
KD[0x0388] = '\u0395\u0301';
KD[0x0389] = '\u0397\u0301';
KD[0x038A] = '\u0399\u0301';
KD[0x038C] = '\u039F\u0301';
KD[0x038E] = '\u03A5\u0301';
KD[0x038F] = '\u03A9\u0301';
KD[0x0390] = '\u03B9\u0308\u0301';
KD[0x03AA] = '\u0399\u0308';
KD[0x03AB] = '\u03A5\u0308';
KD[0x03AC] = '\u03B1\u0301';
KD[0x03AD] = '\u03B5\u0301';
KD[0x03AE] = '\u03B7\u0301';
KD[0x03AF] = '\u03B9\u0301';
KD[0x03B0] = '\u03C5\u0308\u0301';
KD[0x03CA] = '\u03B9\u0308';
KD[0x03CB] = '\u03C5\u0308';
KD[0x03CC] = '\u03BF\u0301';
KD[0x03CD] = '\u03C5\u0301';
KD[0x03CE] = '\u03C9\u0301';
KD[0x03D0] = '\u03B2';
KD[0x03D1] = '\u03B8';
KD[0x03D2] = '\u03A5';
KD[0x03D3] = '\u03A5\u0301';
KD[0x03D4] = '\u03A5\u0308';
KD[0x03D5] = '\u03C6';
KD[0x03D6] = '\u03C0';
KD[0x03F0] = '\u03BA';
KD[0x03F1] = '\u03C1';
KD[0x03F2] = '\u03C2';
KD[0x0400] = '\u0415\u0300';
KD[0x0401] = '\u0415\u0308';
KD[0x0403] = '\u0413\u0301';
KD[0x0407] = '\u0406\u0308';
KD[0x040C] = '\u041A\u0301';
KD[0x040D] = '\u0418\u0300';
KD[0x040E] = '\u0423\u0306';
KD[0x0419] = '\u0418\u0306';
KD[0x0439] = '\u0438\u0306';
KD[0x0450] = '\u0435\u0300';
KD[0x0451] = '\u0435\u0308';
KD[0x0453] = '\u0433\u0301';
KD[0x0457] = '\u0456\u0308';
KD[0x045C] = '\u043A\u0301';
KD[0x045D] = '\u0438\u0300';
KD[0x045E] = '\u0443\u0306';
KD[0x0476] = '\u0474\u030F';
KD[0x0477] = '\u0475\u030F';
KD[0x04C1] = '\u0416\u0306';
KD[0x04C2] = '\u0436\u0306';
KD[0x04D0] = '\u0410\u0306';
KD[0x04D1] = '\u0430\u0306';
KD[0x04D2] = '\u0410\u0308';
KD[0x04D3] = '\u0430\u0308';
KD[0x04D6] = '\u0415\u0306';
KD[0x04D7] = '\u0435\u0306';
KD[0x04DA] = '\u04D8\u0308';
KD[0x04DB] = '\u04D9\u0308';
KD[0x04DC] = '\u0416\u0308';
KD[0x04DD] = '\u0436\u0308';
KD[0x04DE] = '\u0417\u0308';
KD[0x04DF] = '\u0437\u0308';
KD[0x04E2] = '\u0418\u0304';
KD[0x04E3] = '\u0438\u0304';
KD[0x04E4] = '\u0418\u0308';
KD[0x04E5] = '\u0438\u0308';
KD[0x04E6] = '\u041E\u0308';
KD[0x04E7] = '\u043E\u0308';
KD[0x04EA] = '\u04E8\u0308';
KD[0x04EB] = '\u04E9\u0308';
KD[0x04EC] = '\u042D\u0308';
KD[0x04ED] = '\u044D\u0308';
KD[0x04EE] = '\u0423\u0304';
KD[0x04EF] = '\u0443\u0304';
KD[0x04F0] = '\u0423\u0308';
KD[0x04F1] = '\u0443\u0308';
KD[0x04F2] = '\u0423\u030B';
KD[0x04F3] = '\u0443\u030B';
KD[0x04F4] = '\u0427\u0308';
KD[0x04F5] = '\u0447\u0308';
KD[0x04F8] = '\u042B\u0308';
KD[0x04F9] = '\u044B\u0308';
KD[0x0587] = '\u0565\u0582';
KD[0x0622] = '\u0627\u0653';
KD[0x0623] = '\u0627\u0654';
KD[0x0624] = '\u0648\u0654';
KD[0x0625] = '\u0627\u0655';
KD[0x0626] = '\u064A\u0654';
KD[0x0675] = '\u0627\u0674';
KD[0x0676] = '\u0648\u0674';
KD[0x0677] = '\u06C7\u0674';
KD[0x0678] = '\u064A\u0674';
KD[0x06C0] = '\u06D5\u0654';
KD[0x06C2] = '\u06C1\u0654';
KD[0x06D3] = '\u06D2\u0654';
KD[0x0929] = '\u0928\u093C';
KD[0x0931] = '\u0930\u093C';
KD[0x0934] = '\u0933\u093C';
KD[0x0958] = '\u0915\u093C';
KD[0x0959] = '\u0916\u093C';
KD[0x095A] = '\u0917\u093C';
KD[0x095B] = '\u091C\u093C';
KD[0x095C] = '\u0921\u093C';
KD[0x095D] = '\u0922\u093C';
KD[0x095E] = '\u092B\u093C';
KD[0x095F] = '\u092F\u093C';
KD[0x09CB] = '\u09C7\u09BE';
KD[0x09CC] = '\u09C7\u09D7';
KD[0x09DC] = '\u09A1\u09BC';
KD[0x09DD] = '\u09A2\u09BC';
KD[0x09DF] = '\u09AF\u09BC';
KD[0x0A33] = '\u0A32\u0A3C';
KD[0x0A36] = '\u0A38\u0A3C';
KD[0x0A59] = '\u0A16\u0A3C';
KD[0x0A5A] = '\u0A17\u0A3C';
KD[0x0A5B] = '\u0A1C\u0A3C';
KD[0x0A5E] = '\u0A2B\u0A3C';
KD[0x0B48] = '\u0B47\u0B56';
KD[0x0B4B] = '\u0B47\u0B3E';
KD[0x0B4C] = '\u0B47\u0B57';
KD[0x0B5C] = '\u0B21\u0B3C';
KD[0x0B5D] = '\u0B22\u0B3C';
KD[0x0B94] = '\u0B92\u0BD7';
KD[0x0BCA] = '\u0BC6\u0BBE';
KD[0x0BCB] = '\u0BC7\u0BBE';
KD[0x0BCC] = '\u0BC6\u0BD7';
KD[0x0C48] = '\u0C46\u0C56';
KD[0x0CC0] = '\u0CBF\u0CD5';
KD[0x0CC7] = '\u0CC6\u0CD5';
KD[0x0CC8] = '\u0CC6\u0CD6';
KD[0x0CCA] = '\u0CC6\u0CC2';
KD[0x0CCB] = '\u0CC6\u0CC2\u0CD5';
KD[0x0D4A] = '\u0D46\u0D3E';
KD[0x0D4B] = '\u0D47\u0D3E';
KD[0x0D4C] = '\u0D46\u0D57';
KD[0x0DDA] = '\u0DD9\u0DCA';
KD[0x0DDC] = '\u0DD9\u0DCF';
KD[0x0DDD] = '\u0DD9\u0DCF\u0DCA';
KD[0x0DDE] = '\u0DD9\u0DDF';
KD[0x0E33] = '\u0E4D\u0E32';
KD[0x0EB3] = '\u0ECD\u0EB2';
KD[0x0EDC] = '\u0EAB\u0E99';
KD[0x0EDD] = '\u0EAB\u0EA1';
KD[0x0F0C] = '\u0F0B';
KD[0x0F43] = '\u0F42\u0FB7';
KD[0x0F4D] = '\u0F4C\u0FB7';
KD[0x0F52] = '\u0F51\u0FB7';
KD[0x0F57] = '\u0F56\u0FB7';
KD[0x0F5C] = '\u0F5B\u0FB7';
KD[0x0F69] = '\u0F40\u0FB5';
KD[0x0F73] = '\u0F71\u0F72';
KD[0x0F75] = '\u0F71\u0F74';
KD[0x0F76] = '\u0FB2\u0F80';
KD[0x0F77] = '\u0FB2\u0F71\u0F80';
KD[0x0F78] = '\u0FB3\u0F80';
KD[0x0F79] = '\u0FB3\u0F71\u0F80';
KD[0x0F81] = '\u0F71\u0F80';
KD[0x0F93] = '\u0F92\u0FB7';
KD[0x0F9D] = '\u0F9C\u0FB7';
KD[0x0FA2] = '\u0FA1\u0FB7';
KD[0x0FA7] = '\u0FA6\u0FB7';
KD[0x0FAC] = '\u0FAB\u0FB7';
KD[0x0FB9] = '\u0F90\u0FB5';
KD[0x1026] = '\u1025\u102E';
KD[0x1E00] = '\u0041\u0325';
KD[0x1E01] = '\u0061\u0325';
KD[0x1E02] = '\u0042\u0307';
KD[0x1E03] = '\u0062\u0307';
KD[0x1E04] = '\u0042\u0323';
KD[0x1E05] = '\u0062\u0323';
KD[0x1E06] = '\u0042\u0331';
KD[0x1E07] = '\u0062\u0331';
KD[0x1E08] = '\u0043\u0327\u0301';
KD[0x1E09] = '\u0063\u0327\u0301';
KD[0x1E0A] = '\u0044\u0307';
KD[0x1E0B] = '\u0064\u0307';
KD[0x1E0C] = '\u0044\u0323';
KD[0x1E0D] = '\u0064\u0323';
KD[0x1E0E] = '\u0044\u0331';
KD[0x1E0F] = '\u0064\u0331';
KD[0x1E10] = '\u0044\u0327';
KD[0x1E11] = '\u0064\u0327';
KD[0x1E12] = '\u0044\u032D';
KD[0x1E13] = '\u0064\u032D';
KD[0x1E14] = '\u0045\u0304\u0300';
KD[0x1E15] = '\u0065\u0304\u0300';
KD[0x1E16] = '\u0045\u0304\u0301';
KD[0x1E17] = '\u0065\u0304\u0301';
KD[0x1E18] = '\u0045\u032D';
KD[0x1E19] = '\u0065\u032D';
KD[0x1E1A] = '\u0045\u0330';
KD[0x1E1B] = '\u0065\u0330';
KD[0x1E1C] = '\u0045\u0327\u0306';
KD[0x1E1D] = '\u0065\u0327\u0306';
KD[0x1E1E] = '\u0046\u0307';
KD[0x1E1F] = '\u0066\u0307';
KD[0x1E20] = '\u0047\u0304';
KD[0x1E21] = '\u0067\u0304';
KD[0x1E22] = '\u0048\u0307';
KD[0x1E23] = '\u0068\u0307';
KD[0x1E24] = '\u0048\u0323';
KD[0x1E25] = '\u0068\u0323';
KD[0x1E26] = '\u0048\u0308';
KD[0x1E27] = '\u0068\u0308';
KD[0x1E28] = '\u0048\u0327';
KD[0x1E29] = '\u0068\u0327';
KD[0x1E2A] = '\u0048\u032E';
KD[0x1E2B] = '\u0068\u032E';
KD[0x1E2C] = '\u0049\u0330';
KD[0x1E2D] = '\u0069\u0330';
KD[0x1E2E] = '\u0049\u0308\u0301';
KD[0x1E2F] = '\u0069\u0308\u0301';
KD[0x1E30] = '\u004B\u0301';
KD[0x1E31] = '\u006B\u0301';
KD[0x1E32] = '\u004B\u0323';
KD[0x1E33] = '\u006B\u0323';
KD[0x1E34] = '\u004B\u0331';
KD[0x1E35] = '\u006B\u0331';
KD[0x1E36] = '\u004C\u0323';
KD[0x1E37] = '\u006C\u0323';
KD[0x1E38] = '\u004C\u0323\u0304';
KD[0x1E39] = '\u006C\u0323\u0304';
KD[0x1E3A] = '\u004C\u0331';
KD[0x1E3B] = '\u006C\u0331';
KD[0x1E3C] = '\u004C\u032D';
KD[0x1E3D] = '\u006C\u032D';
KD[0x1E3E] = '\u004D\u0301';
KD[0x1E3F] = '\u006D\u0301';
KD[0x1E40] = '\u004D\u0307';
KD[0x1E41] = '\u006D\u0307';
KD[0x1E42] = '\u004D\u0323';
KD[0x1E43] = '\u006D\u0323';
KD[0x1E44] = '\u004E\u0307';
KD[0x1E45] = '\u006E\u0307';
KD[0x1E46] = '\u004E\u0323';
KD[0x1E47] = '\u006E\u0323';
KD[0x1E48] = '\u004E\u0331';
KD[0x1E49] = '\u006E\u0331';
KD[0x1E4A] = '\u004E\u032D';
KD[0x1E4B] = '\u006E\u032D';
KD[0x1E4C] = '\u004F\u0303\u0301';
KD[0x1E4D] = '\u006F\u0303\u0301';
KD[0x1E4E] = '\u004F\u0303\u0308';
KD[0x1E4F] = '\u006F\u0303\u0308';
KD[0x1E50] = '\u004F\u0304\u0300';
KD[0x1E51] = '\u006F\u0304\u0300';
KD[0x1E52] = '\u004F\u0304\u0301';
KD[0x1E53] = '\u006F\u0304\u0301';
KD[0x1E54] = '\u0050\u0301';
KD[0x1E55] = '\u0070\u0301';
KD[0x1E56] = '\u0050\u0307';
KD[0x1E57] = '\u0070\u0307';
KD[0x1E58] = '\u0052\u0307';
KD[0x1E59] = '\u0072\u0307';
KD[0x1E5A] = '\u0052\u0323';
KD[0x1E5B] = '\u0072\u0323';
KD[0x1E5C] = '\u0052\u0323\u0304';
KD[0x1E5D] = '\u0072\u0323\u0304';
KD[0x1E5E] = '\u0052\u0331';
KD[0x1E5F] = '\u0072\u0331';
KD[0x1E60] = '\u0053\u0307';
KD[0x1E61] = '\u0073\u0307';
KD[0x1E62] = '\u0053\u0323';
KD[0x1E63] = '\u0073\u0323';
KD[0x1E64] = '\u0053\u0301\u0307';
KD[0x1E65] = '\u0073\u0301\u0307';
KD[0x1E66] = '\u0053\u030C\u0307';
KD[0x1E67] = '\u0073\u030C\u0307';
KD[0x1E68] = '\u0053\u0323\u0307';
KD[0x1E69] = '\u0073\u0323\u0307';
KD[0x1E6A] = '\u0054\u0307';
KD[0x1E6B] = '\u0074\u0307';
KD[0x1E6C] = '\u0054\u0323';
KD[0x1E6D] = '\u0074\u0323';
KD[0x1E6E] = '\u0054\u0331';
KD[0x1E6F] = '\u0074\u0331';
KD[0x1E70] = '\u0054\u032D';
KD[0x1E71] = '\u0074\u032D';
KD[0x1E72] = '\u0055\u0324';
KD[0x1E73] = '\u0075\u0324';
KD[0x1E74] = '\u0055\u0330';
KD[0x1E75] = '\u0075\u0330';
KD[0x1E76] = '\u0055\u032D';
KD[0x1E77] = '\u0075\u032D';
KD[0x1E78] = '\u0055\u0303\u0301';
KD[0x1E79] = '\u0075\u0303\u0301';
KD[0x1E7A] = '\u0055\u0304\u0308';
KD[0x1E7B] = '\u0075\u0304\u0308';
KD[0x1E7C] = '\u0056\u0303';
KD[0x1E7D] = '\u0076\u0303';
KD[0x1E7E] = '\u0056\u0323';
KD[0x1E7F] = '\u0076\u0323';
KD[0x1E80] = '\u0057\u0300';
KD[0x1E81] = '\u0077\u0300';
KD[0x1E82] = '\u0057\u0301';
KD[0x1E83] = '\u0077\u0301';
KD[0x1E84] = '\u0057\u0308';
KD[0x1E85] = '\u0077\u0308';
KD[0x1E86] = '\u0057\u0307';
KD[0x1E87] = '\u0077\u0307';
KD[0x1E88] = '\u0057\u0323';
KD[0x1E89] = '\u0077\u0323';
KD[0x1E8A] = '\u0058\u0307';
KD[0x1E8B] = '\u0078\u0307';
KD[0x1E8C] = '\u0058\u0308';
KD[0x1E8D] = '\u0078\u0308';
KD[0x1E8E] = '\u0059\u0307';
KD[0x1E8F] = '\u0079\u0307';
KD[0x1E90] = '\u005A\u0302';
KD[0x1E91] = '\u007A\u0302';
KD[0x1E92] = '\u005A\u0323';
KD[0x1E93] = '\u007A\u0323';
KD[0x1E94] = '\u005A\u0331';
KD[0x1E95] = '\u007A\u0331';
KD[0x1E96] = '\u0068\u0331';
KD[0x1E97] = '\u0074\u0308';
KD[0x1E98] = '\u0077\u030A';
KD[0x1E99] = '\u0079\u030A';
KD[0x1E9A] = '\u0061\u02BE';
KD[0x1E9B] = '\u0073\u0307';
KD[0x1EA0] = '\u0041\u0323';
KD[0x1EA1] = '\u0061\u0323';
KD[0x1EA2] = '\u0041\u0309';
KD[0x1EA3] = '\u0061\u0309';
KD[0x1EA4] = '\u0041\u0302\u0301';
KD[0x1EA5] = '\u0061\u0302\u0301';
KD[0x1EA6] = '\u0041\u0302\u0300';
KD[0x1EA7] = '\u0061\u0302\u0300';
KD[0x1EA8] = '\u0041\u0302\u0309';
KD[0x1EA9] = '\u0061\u0302\u0309';
KD[0x1EAA] = '\u0041\u0302\u0303';
KD[0x1EAB] = '\u0061\u0302\u0303';
KD[0x1EAC] = '\u0041\u0323\u0302';
KD[0x1EAD] = '\u0061\u0323\u0302';
KD[0x1EAE] = '\u0041\u0306\u0301';
KD[0x1EAF] = '\u0061\u0306\u0301';
KD[0x1EB0] = '\u0041\u0306\u0300';
KD[0x1EB1] = '\u0061\u0306\u0300';
KD[0x1EB2] = '\u0041\u0306\u0309';
KD[0x1EB3] = '\u0061\u0306\u0309';
KD[0x1EB4] = '\u0041\u0306\u0303';
KD[0x1EB5] = '\u0061\u0306\u0303';
KD[0x1EB6] = '\u0041\u0323\u0306';
KD[0x1EB7] = '\u0061\u0323\u0306';
KD[0x1EB8] = '\u0045\u0323';
KD[0x1EB9] = '\u0065\u0323';
KD[0x1EBA] = '\u0045\u0309';
KD[0x1EBB] = '\u0065\u0309';
KD[0x1EBC] = '\u0045\u0303';
KD[0x1EBD] = '\u0065\u0303';
KD[0x1EBE] = '\u0045\u0302\u0301';
KD[0x1EBF] = '\u0065\u0302\u0301';
KD[0x1EC0] = '\u0045\u0302\u0300';
KD[0x1EC1] = '\u0065\u0302\u0300';
KD[0x1EC2] = '\u0045\u0302\u0309';
KD[0x1EC3] = '\u0065\u0302\u0309';
KD[0x1EC4] = '\u0045\u0302\u0303';
KD[0x1EC5] = '\u0065\u0302\u0303';
KD[0x1EC6] = '\u0045\u0323\u0302';
KD[0x1EC7] = '\u0065\u0323\u0302';
KD[0x1EC8] = '\u0049\u0309';
KD[0x1EC9] = '\u0069\u0309';
KD[0x1ECA] = '\u0049\u0323';
KD[0x1ECB] = '\u0069\u0323';
KD[0x1ECC] = '\u004F\u0323';
KD[0x1ECD] = '\u006F\u0323';
KD[0x1ECE] = '\u004F\u0309';
KD[0x1ECF] = '\u006F\u0309';
KD[0x1ED0] = '\u004F\u0302\u0301';
KD[0x1ED1] = '\u006F\u0302\u0301';
KD[0x1ED2] = '\u004F\u0302\u0300';
KD[0x1ED3] = '\u006F\u0302\u0300';
KD[0x1ED4] = '\u004F\u0302\u0309';
KD[0x1ED5] = '\u006F\u0302\u0309';
KD[0x1ED6] = '\u004F\u0302\u0303';
KD[0x1ED7] = '\u006F\u0302\u0303';
KD[0x1ED8] = '\u004F\u0323\u0302';
KD[0x1ED9] = '\u006F\u0323\u0302';
KD[0x1EDA] = '\u004F\u031B\u0301';
KD[0x1EDB] = '\u006F\u031B\u0301';
KD[0x1EDC] = '\u004F\u031B\u0300';
KD[0x1EDD] = '\u006F\u031B\u0300';
KD[0x1EDE] = '\u004F\u031B\u0309';
KD[0x1EDF] = '\u006F\u031B\u0309';
KD[0x1EE0] = '\u004F\u031B\u0303';
KD[0x1EE1] = '\u006F\u031B\u0303';
KD[0x1EE2] = '\u004F\u031B\u0323';
KD[0x1EE3] = '\u006F\u031B\u0323';
KD[0x1EE4] = '\u0055\u0323';
KD[0x1EE5] = '\u0075\u0323';
KD[0x1EE6] = '\u0055\u0309';
KD[0x1EE7] = '\u0075\u0309';
KD[0x1EE8] = '\u0055\u031B\u0301';
KD[0x1EE9] = '\u0075\u031B\u0301';
KD[0x1EEA] = '\u0055\u031B\u0300';
KD[0x1EEB] = '\u0075\u031B\u0300';
KD[0x1EEC] = '\u0055\u031B\u0309';
KD[0x1EED] = '\u0075\u031B\u0309';
KD[0x1EEE] = '\u0055\u031B\u0303';
KD[0x1EEF] = '\u0075\u031B\u0303';
KD[0x1EF0] = '\u0055\u031B\u0323';
KD[0x1EF1] = '\u0075\u031B\u0323';
KD[0x1EF2] = '\u0059\u0300';
KD[0x1EF3] = '\u0079\u0300';
KD[0x1EF4] = '\u0059\u0323';
KD[0x1EF5] = '\u0079\u0323';
KD[0x1EF6] = '\u0059\u0309';
KD[0x1EF7] = '\u0079\u0309';
KD[0x1EF8] = '\u0059\u0303';
KD[0x1EF9] = '\u0079\u0303';
KD[0x1F00] = '\u03B1\u0313';
KD[0x1F01] = '\u03B1\u0314';
KD[0x1F02] = '\u03B1\u0313\u0300';
KD[0x1F03] = '\u03B1\u0314\u0300';
KD[0x1F04] = '\u03B1\u0313\u0301';
KD[0x1F05] = '\u03B1\u0314\u0301';
KD[0x1F06] = '\u03B1\u0313\u0342';
KD[0x1F07] = '\u03B1\u0314\u0342';
KD[0x1F08] = '\u0391\u0313';
KD[0x1F09] = '\u0391\u0314';
KD[0x1F0A] = '\u0391\u0313\u0300';
KD[0x1F0B] = '\u0391\u0314\u0300';
KD[0x1F0C] = '\u0391\u0313\u0301';
KD[0x1F0D] = '\u0391\u0314\u0301';
KD[0x1F0E] = '\u0391\u0313\u0342';
KD[0x1F0F] = '\u0391\u0314\u0342';
KD[0x1F10] = '\u03B5\u0313';
KD[0x1F11] = '\u03B5\u0314';
KD[0x1F12] = '\u03B5\u0313\u0300';
KD[0x1F13] = '\u03B5\u0314\u0300';
KD[0x1F14] = '\u03B5\u0313\u0301';
KD[0x1F15] = '\u03B5\u0314\u0301';
KD[0x1F18] = '\u0395\u0313';
KD[0x1F19] = '\u0395\u0314';
KD[0x1F1A] = '\u0395\u0313\u0300';
KD[0x1F1B] = '\u0395\u0314\u0300';
KD[0x1F1C] = '\u0395\u0313\u0301';
KD[0x1F1D] = '\u0395\u0314\u0301';
KD[0x1F20] = '\u03B7\u0313';
KD[0x1F21] = '\u03B7\u0314';
KD[0x1F22] = '\u03B7\u0313\u0300';
KD[0x1F23] = '\u03B7\u0314\u0300';
KD[0x1F24] = '\u03B7\u0313\u0301';
KD[0x1F25] = '\u03B7\u0314\u0301';
KD[0x1F26] = '\u03B7\u0313\u0342';
KD[0x1F27] = '\u03B7\u0314\u0342';
KD[0x1F28] = '\u0397\u0313';
KD[0x1F29] = '\u0397\u0314';
KD[0x1F2A] = '\u0397\u0313\u0300';
KD[0x1F2B] = '\u0397\u0314\u0300';
KD[0x1F2C] = '\u0397\u0313\u0301';
KD[0x1F2D] = '\u0397\u0314\u0301';
KD[0x1F2E] = '\u0397\u0313\u0342';
KD[0x1F2F] = '\u0397\u0314\u0342';
KD[0x1F30] = '\u03B9\u0313';
KD[0x1F31] = '\u03B9\u0314';
KD[0x1F32] = '\u03B9\u0313\u0300';
KD[0x1F33] = '\u03B9\u0314\u0300';
KD[0x1F34] = '\u03B9\u0313\u0301';
KD[0x1F35] = '\u03B9\u0314\u0301';
KD[0x1F36] = '\u03B9\u0313\u0342';
KD[0x1F37] = '\u03B9\u0314\u0342';
KD[0x1F38] = '\u0399\u0313';
KD[0x1F39] = '\u0399\u0314';
KD[0x1F3A] = '\u0399\u0313\u0300';
KD[0x1F3B] = '\u0399\u0314\u0300';
KD[0x1F3C] = '\u0399\u0313\u0301';
KD[0x1F3D] = '\u0399\u0314\u0301';
KD[0x1F3E] = '\u0399\u0313\u0342';
KD[0x1F3F] = '\u0399\u0314\u0342';
KD[0x1F40] = '\u03BF\u0313';
KD[0x1F41] = '\u03BF\u0314';
KD[0x1F42] = '\u03BF\u0313\u0300';
KD[0x1F43] = '\u03BF\u0314\u0300';
KD[0x1F44] = '\u03BF\u0313\u0301';
KD[0x1F45] = '\u03BF\u0314\u0301';
KD[0x1F48] = '\u039F\u0313';
KD[0x1F49] = '\u039F\u0314';
KD[0x1F4A] = '\u039F\u0313\u0300';
KD[0x1F4B] = '\u039F\u0314\u0300';
KD[0x1F4C] = '\u039F\u0313\u0301';
KD[0x1F4D] = '\u039F\u0314\u0301';
KD[0x1F50] = '\u03C5\u0313';
KD[0x1F51] = '\u03C5\u0314';
KD[0x1F52] = '\u03C5\u0313\u0300';
KD[0x1F53] = '\u03C5\u0314\u0300';
KD[0x1F54] = '\u03C5\u0313\u0301';
KD[0x1F55] = '\u03C5\u0314\u0301';
KD[0x1F56] = '\u03C5\u0313\u0342';
KD[0x1F57] = '\u03C5\u0314\u0342';
KD[0x1F59] = '\u03A5\u0314';
KD[0x1F5B] = '\u03A5\u0314\u0300';
KD[0x1F5D] = '\u03A5\u0314\u0301';
KD[0x1F5F] = '\u03A5\u0314\u0342';
KD[0x1F60] = '\u03C9\u0313';
KD[0x1F61] = '\u03C9\u0314';
KD[0x1F62] = '\u03C9\u0313\u0300';
KD[0x1F63] = '\u03C9\u0314\u0300';
KD[0x1F64] = '\u03C9\u0313\u0301';
KD[0x1F65] = '\u03C9\u0314\u0301';
KD[0x1F66] = '\u03C9\u0313\u0342';
KD[0x1F67] = '\u03C9\u0314\u0342';
KD[0x1F68] = '\u03A9\u0313';
KD[0x1F69] = '\u03A9\u0314';
KD[0x1F6A] = '\u03A9\u0313\u0300';
KD[0x1F6B] = '\u03A9\u0314\u0300';
KD[0x1F6C] = '\u03A9\u0313\u0301';
KD[0x1F6D] = '\u03A9\u0314\u0301';
KD[0x1F6E] = '\u03A9\u0313\u0342';
KD[0x1F6F] = '\u03A9\u0314\u0342';
KD[0x1F70] = '\u03B1\u0300';
KD[0x1F71] = '\u03B1\u0301';
KD[0x1F72] = '\u03B5\u0300';
KD[0x1F73] = '\u03B5\u0301';
KD[0x1F74] = '\u03B7\u0300';
KD[0x1F75] = '\u03B7\u0301';
KD[0x1F76] = '\u03B9\u0300';
KD[0x1F77] = '\u03B9\u0301';
KD[0x1F78] = '\u03BF\u0300';
KD[0x1F79] = '\u03BF\u0301';
KD[0x1F7A] = '\u03C5\u0300';
KD[0x1F7B] = '\u03C5\u0301';
KD[0x1F7C] = '\u03C9\u0300';
KD[0x1F7D] = '\u03C9\u0301';
KD[0x1F80] = '\u03B1\u0313\u0345';
KD[0x1F81] = '\u03B1\u0314\u0345';
KD[0x1F82] = '\u03B1\u0313\u0300\u0345';
KD[0x1F83] = '\u03B1\u0314\u0300\u0345';
KD[0x1F84] = '\u03B1\u0313\u0301\u0345';
KD[0x1F85] = '\u03B1\u0314\u0301\u0345';
KD[0x1F86] = '\u03B1\u0313\u0342\u0345';
KD[0x1F87] = '\u03B1\u0314\u0342\u0345';
KD[0x1F88] = '\u0391\u0313\u0345';
KD[0x1F89] = '\u0391\u0314\u0345';
KD[0x1F8A] = '\u0391\u0313\u0300\u0345';
KD[0x1F8B] = '\u0391\u0314\u0300\u0345';
KD[0x1F8C] = '\u0391\u0313\u0301\u0345';
KD[0x1F8D] = '\u0391\u0314\u0301\u0345';
KD[0x1F8E] = '\u0391\u0313\u0342\u0345';
KD[0x1F8F] = '\u0391\u0314\u0342\u0345';
KD[0x1F90] = '\u03B7\u0313\u0345';
KD[0x1F91] = '\u03B7\u0314\u0345';
KD[0x1F92] = '\u03B7\u0313\u0300\u0345';
KD[0x1F93] = '\u03B7\u0314\u0300\u0345';
KD[0x1F94] = '\u03B7\u0313\u0301\u0345';
KD[0x1F95] = '\u03B7\u0314\u0301\u0345';
KD[0x1F96] = '\u03B7\u0313\u0342\u0345';
KD[0x1F97] = '\u03B7\u0314\u0342\u0345';
KD[0x1F98] = '\u0397\u0313\u0345';
KD[0x1F99] = '\u0397\u0314\u0345';
KD[0x1F9A] = '\u0397\u0313\u0300\u0345';
KD[0x1F9B] = '\u0397\u0314\u0300\u0345';
KD[0x1F9C] = '\u0397\u0313\u0301\u0345';
KD[0x1F9D] = '\u0397\u0314\u0301\u0345';
KD[0x1F9E] = '\u0397\u0313\u0342\u0345';
KD[0x1F9F] = '\u0397\u0314\u0342\u0345';
KD[0x1FA0] = '\u03C9\u0313\u0345';
KD[0x1FA1] = '\u03C9\u0314\u0345';
KD[0x1FA2] = '\u03C9\u0313\u0300\u0345';
KD[0x1FA3] = '\u03C9\u0314\u0300\u0345';
KD[0x1FA4] = '\u03C9\u0313\u0301\u0345';
KD[0x1FA5] = '\u03C9\u0314\u0301\u0345';
KD[0x1FA6] = '\u03C9\u0313\u0342\u0345';
KD[0x1FA7] = '\u03C9\u0314\u0342\u0345';
KD[0x1FA8] = '\u03A9\u0313\u0345';
KD[0x1FA9] = '\u03A9\u0314\u0345';
KD[0x1FAA] = '\u03A9\u0313\u0300\u0345';
KD[0x1FAB] = '\u03A9\u0314\u0300\u0345';
KD[0x1FAC] = '\u03A9\u0313\u0301\u0345';
KD[0x1FAD] = '\u03A9\u0314\u0301\u0345';
KD[0x1FAE] = '\u03A9\u0313\u0342\u0345';
KD[0x1FAF] = '\u03A9\u0314\u0342\u0345';
KD[0x1FB0] = '\u03B1\u0306';
KD[0x1FB1] = '\u03B1\u0304';
KD[0x1FB2] = '\u03B1\u0300\u0345';
KD[0x1FB3] = '\u03B1\u0345';
KD[0x1FB4] = '\u03B1\u0301\u0345';
KD[0x1FB6] = '\u03B1\u0342';
KD[0x1FB7] = '\u03B1\u0342\u0345';
KD[0x1FB8] = '\u0391\u0306';
KD[0x1FB9] = '\u0391\u0304';
KD[0x1FBA] = '\u0391\u0300';
KD[0x1FBB] = '\u0391\u0301';
KD[0x1FBC] = '\u0391\u0345';
KD[0x1FBD] = '\u0020\u0313';
KD[0x1FBE] = '\u03B9';
KD[0x1FBF] = '\u0020\u0313';
KD[0x1FC0] = '\u0020\u0342';
KD[0x1FC1] = '\u0020\u0308\u0342';
KD[0x1FC2] = '\u03B7\u0300\u0345';
KD[0x1FC3] = '\u03B7\u0345';
KD[0x1FC4] = '\u03B7\u0301\u0345';
KD[0x1FC6] = '\u03B7\u0342';
KD[0x1FC7] = '\u03B7\u0342\u0345';
KD[0x1FC8] = '\u0395\u0300';
KD[0x1FC9] = '\u0395\u0301';
KD[0x1FCA] = '\u0397\u0300';
KD[0x1FCB] = '\u0397\u0301';
KD[0x1FCC] = '\u0397\u0345';
KD[0x1FCD] = '\u0020\u0313\u0300';
KD[0x1FCE] = '\u0020\u0313\u0301';
KD[0x1FCF] = '\u0020\u0313\u0342';
KD[0x1FD0] = '\u03B9\u0306';
KD[0x1FD1] = '\u03B9\u0304';
KD[0x1FD2] = '\u03B9\u0308\u0300';
KD[0x1FD3] = '\u03B9\u0308\u0301';
KD[0x1FD6] = '\u03B9\u0342';
KD[0x1FD7] = '\u03B9\u0308\u0342';
KD[0x1FD8] = '\u0399\u0306';
KD[0x1FD9] = '\u0399\u0304';
KD[0x1FDA] = '\u0399\u0300';
KD[0x1FDB] = '\u0399\u0301';
KD[0x1FDD] = '\u0020\u0314\u0300';
KD[0x1FDE] = '\u0020\u0314\u0301';
KD[0x1FDF] = '\u0020\u0314\u0342';
KD[0x1FE0] = '\u03C5\u0306';
KD[0x1FE1] = '\u03C5\u0304';
KD[0x1FE2] = '\u03C5\u0308\u0300';
KD[0x1FE3] = '\u03C5\u0308\u0301';
KD[0x1FE4] = '\u03C1\u0313';
KD[0x1FE5] = '\u03C1\u0314';
KD[0x1FE6] = '\u03C5\u0342';
KD[0x1FE7] = '\u03C5\u0308\u0342';
KD[0x1FE8] = '\u03A5\u0306';
KD[0x1FE9] = '\u03A5\u0304';
KD[0x1FEA] = '\u03A5\u0300';
KD[0x1FEB] = '\u03A5\u0301';
KD[0x1FEC] = '\u03A1\u0314';
KD[0x1FED] = '\u0020\u0308\u0300';
KD[0x1FEE] = '\u0020\u0308\u0301';
KD[0x1FEF] = '\u0060';
KD[0x1FF2] = '\u03C9\u0300\u0345';
KD[0x1FF3] = '\u03C9\u0345';
KD[0x1FF4] = '\u03C9\u0301\u0345';
KD[0x1FF6] = '\u03C9\u0342';
KD[0x1FF7] = '\u03C9\u0342\u0345';
KD[0x1FF8] = '\u039F\u0300';
KD[0x1FF9] = '\u039F\u0301';
KD[0x1FFA] = '\u03A9\u0300';
KD[0x1FFB] = '\u03A9\u0301';
KD[0x1FFC] = '\u03A9\u0345';
KD[0x1FFD] = '\u0020\u0301';
KD[0x1FFE] = '\u0020\u0314';
KD[0x2000] = '\u0020';
KD[0x2001] = '\u0020';
KD[0x2002] = '\u0020';
KD[0x2003] = '\u0020';
KD[0x2004] = '\u0020';
KD[0x2005] = '\u0020';
KD[0x2006] = '\u0020';
KD[0x2007] = '\u0020';
KD[0x2008] = '\u0020';
KD[0x2009] = '\u0020';
KD[0x200A] = '\u0020';
KD[0x2011] = '\u2010';
KD[0x2017] = '\u0020\u0333';
KD[0x2024] = '\u002E';
KD[0x2025] = '\u002E\u002E';
KD[0x2026] = '\u002E\u002E\u002E';
KD[0x202F] = '\u0020';
KD[0x2033] = '\u2032\u2032';
KD[0x2034] = '\u2032\u2032\u2032';
KD[0x2036] = '\u2035\u2035';
KD[0x2037] = '\u2035\u2035\u2035';
KD[0x203C] = '\u0021\u0021';
KD[0x203E] = '\u0020\u0305';
KD[0x2048] = '\u003F\u0021';
KD[0x2049] = '\u0021\u003F';
KD[0x2070] = '\u0030';
KD[0x2074] = '\u0034';
KD[0x2075] = '\u0035';
KD[0x2076] = '\u0036';
KD[0x2077] = '\u0037';
KD[0x2078] = '\u0038';
KD[0x2079] = '\u0039';
KD[0x207A] = '\u002B';
KD[0x207B] = '\u2212';
KD[0x207C] = '\u003D';
KD[0x207D] = '\u0028';
KD[0x207E] = '\u0029';
KD[0x207F] = '\u006E';
KD[0x2080] = '\u0030';
KD[0x2081] = '\u0031';
KD[0x2082] = '\u0032';
KD[0x2083] = '\u0033';
KD[0x2084] = '\u0034';
KD[0x2085] = '\u0035';
KD[0x2086] = '\u0036';
KD[0x2087] = '\u0037';
KD[0x2088] = '\u0038';
KD[0x2089] = '\u0039';
KD[0x208A] = '\u002B';
KD[0x208B] = '\u2212';
KD[0x208C] = '\u003D';
KD[0x208D] = '\u0028';
KD[0x208E] = '\u0029';
KD[0x20A8] = '\u0052\u0073';
KD[0x2100] = '\u0061\u002F\u0063';
KD[0x2101] = '\u0061\u002F\u0073';
KD[0x2102] = '\u0043';
KD[0x2103] = '\u00B0\u0043';
KD[0x2105] = '\u0063\u002F\u006F';
KD[0x2106] = '\u0063\u002F\u0075';
KD[0x2107] = '\u0190';
KD[0x2109] = '\u00B0\u0046';
KD[0x210A] = '\u0067';
KD[0x210B] = '\u0048';
KD[0x210C] = '\u0048';
KD[0x210D] = '\u0048';
KD[0x210E] = '\u0068';
KD[0x210F] = '\u0127';
KD[0x2110] = '\u0049';
KD[0x2111] = '\u0049';
KD[0x2112] = '\u004C';
KD[0x2113] = '\u006C';
KD[0x2115] = '\u004E';
KD[0x2116] = '\u004E\u006F';
KD[0x2119] = '\u0050';
KD[0x211A] = '\u0051';
KD[0x211B] = '\u0052';
KD[0x211C] = '\u0052';
KD[0x211D] = '\u0052';
KD[0x2120] = '\u0053\u004D';
KD[0x2121] = '\u0054\u0045\u004C';
KD[0x2122] = '\u0054\u004D';
KD[0x2124] = '\u005A';
KD[0x2126] = '\u03A9';
KD[0x2128] = '\u005A';
KD[0x212A] = '\u004B';
KD[0x212B] = '\u0041\u030A';
KD[0x212C] = '\u0042';
KD[0x212D] = '\u0043';
KD[0x212F] = '\u0065';
KD[0x2130] = '\u0045';
KD[0x2131] = '\u0046';
KD[0x2133] = '\u004D';
KD[0x2134] = '\u006F';
KD[0x2135] = '\u05D0';
KD[0x2136] = '\u05D1';
KD[0x2137] = '\u05D2';
KD[0x2138] = '\u05D3';
KD[0x2139] = '\u0069';
KD[0x2153] = '\u0031\u2044\u0033';
KD[0x2154] = '\u0032\u2044\u0033';
KD[0x2155] = '\u0031\u2044\u0035';
KD[0x2156] = '\u0032\u2044\u0035';
KD[0x2157] = '\u0033\u2044\u0035';
KD[0x2158] = '\u0034\u2044\u0035';
KD[0x2159] = '\u0031\u2044\u0036';
KD[0x215A] = '\u0035\u2044\u0036';
KD[0x215B] = '\u0031\u2044\u0038';
KD[0x215C] = '\u0033\u2044\u0038';
KD[0x215D] = '\u0035\u2044\u0038';
KD[0x215E] = '\u0037\u2044\u0038';
KD[0x215F] = '\u0031\u2044';
KD[0x2160] = '\u0049';
KD[0x2161] = '\u0049\u0049';
KD[0x2162] = '\u0049\u0049\u0049';
KD[0x2163] = '\u0049\u0056';
KD[0x2164] = '\u0056';
KD[0x2165] = '\u0056\u0049';
KD[0x2166] = '\u0056\u0049\u0049';
KD[0x2167] = '\u0056\u0049\u0049\u0049';
KD[0x2168] = '\u0049\u0058';
KD[0x2169] = '\u0058';
KD[0x216A] = '\u0058\u0049';
KD[0x216B] = '\u0058\u0049\u0049';
KD[0x216C] = '\u004C';
KD[0x216D] = '\u0043';
KD[0x216E] = '\u0044';
KD[0x216F] = '\u004D';
KD[0x2170] = '\u0069';
KD[0x2171] = '\u0069\u0069';
KD[0x2172] = '\u0069\u0069\u0069';
KD[0x2173] = '\u0069\u0076';
KD[0x2174] = '\u0076';
KD[0x2175] = '\u0076\u0069';
KD[0x2176] = '\u0076\u0069\u0069';
KD[0x2177] = '\u0076\u0069\u0069\u0069';
KD[0x2178] = '\u0069\u0078';
KD[0x2179] = '\u0078';
KD[0x217A] = '\u0078\u0069';
KD[0x217B] = '\u0078\u0069\u0069';
KD[0x217C] = '\u006C';
KD[0x217D] = '\u0063';
KD[0x217E] = '\u0064';
KD[0x217F] = '\u006D';
KD[0x219A] = '\u2190\u0338';
KD[0x219B] = '\u2192\u0338';
KD[0x21AE] = '\u2194\u0338';
KD[0x21CD] = '\u21D0\u0338';
KD[0x21CE] = '\u21D4\u0338';
KD[0x21CF] = '\u21D2\u0338';
KD[0x2204] = '\u2203\u0338';
KD[0x2209] = '\u2208\u0338';
KD[0x220C] = '\u220B\u0338';
KD[0x2224] = '\u2223\u0338';
KD[0x2226] = '\u2225\u0338';
KD[0x222C] = '\u222B\u222B';
KD[0x222D] = '\u222B\u222B\u222B';
KD[0x222F] = '\u222E\u222E';
KD[0x2230] = '\u222E\u222E\u222E';
KD[0x2241] = '\u223C\u0338';
KD[0x2244] = '\u2243\u0338';
KD[0x2247] = '\u2245\u0338';
KD[0x2249] = '\u2248\u0338';
KD[0x2260] = '\u003D\u0338';
KD[0x2262] = '\u2261\u0338';
KD[0x226D] = '\u224D\u0338';
KD[0x226E] = '\u003C\u0338';
KD[0x226F] = '\u003E\u0338';
KD[0x2270] = '\u2264\u0338';
KD[0x2271] = '\u2265\u0338';
KD[0x2274] = '\u2272\u0338';
KD[0x2275] = '\u2273\u0338';
KD[0x2278] = '\u2276\u0338';
KD[0x2279] = '\u2277\u0338';
KD[0x2280] = '\u227A\u0338';
KD[0x2281] = '\u227B\u0338';
KD[0x2284] = '\u2282\u0338';
KD[0x2285] = '\u2283\u0338';
KD[0x2288] = '\u2286\u0338';
KD[0x2289] = '\u2287\u0338';
KD[0x22AC] = '\u22A2\u0338';
KD[0x22AD] = '\u22A8\u0338';
KD[0x22AE] = '\u22A9\u0338';
KD[0x22AF] = '\u22AB\u0338';
KD[0x22E0] = '\u227C\u0338';
KD[0x22E1] = '\u227D\u0338';
KD[0x22E2] = '\u2291\u0338';
KD[0x22E3] = '\u2292\u0338';
KD[0x22EA] = '\u22B2\u0338';
KD[0x22EB] = '\u22B3\u0338';
KD[0x22EC] = '\u22B4\u0338';
KD[0x22ED] = '\u22B5\u0338';
KD[0x2329] = '\u3008';
KD[0x232A] = '\u3009';
KD[0x2460] = '\u0031';
KD[0x2461] = '\u0032';
KD[0x2462] = '\u0033';
KD[0x2463] = '\u0034';
KD[0x2464] = '\u0035';
KD[0x2465] = '\u0036';
KD[0x2466] = '\u0037';
KD[0x2467] = '\u0038';
KD[0x2468] = '\u0039';
KD[0x2469] = '\u0031\u0030';
KD[0x246A] = '\u0031\u0031';
KD[0x246B] = '\u0031\u0032';
KD[0x246C] = '\u0031\u0033';
KD[0x246D] = '\u0031\u0034';
KD[0x246E] = '\u0031\u0035';
KD[0x246F] = '\u0031\u0036';
KD[0x2470] = '\u0031\u0037';
KD[0x2471] = '\u0031\u0038';
KD[0x2472] = '\u0031\u0039';
KD[0x2473] = '\u0032\u0030';
KD[0x2474] = '\u0028\u0031\u0029';
KD[0x2475] = '\u0028\u0032\u0029';
KD[0x2476] = '\u0028\u0033\u0029';
KD[0x2477] = '\u0028\u0034\u0029';
KD[0x2478] = '\u0028\u0035\u0029';
KD[0x2479] = '\u0028\u0036\u0029';
KD[0x247A] = '\u0028\u0037\u0029';
KD[0x247B] = '\u0028\u0038\u0029';
KD[0x247C] = '\u0028\u0039\u0029';
KD[0x247D] = '\u0028\u0031\u0030\u0029';
KD[0x247E] = '\u0028\u0031\u0031\u0029';
KD[0x247F] = '\u0028\u0031\u0032\u0029';
KD[0x2480] = '\u0028\u0031\u0033\u0029';
KD[0x2481] = '\u0028\u0031\u0034\u0029';
KD[0x2482] = '\u0028\u0031\u0035\u0029';
KD[0x2483] = '\u0028\u0031\u0036\u0029';
KD[0x2484] = '\u0028\u0031\u0037\u0029';
KD[0x2485] = '\u0028\u0031\u0038\u0029';
KD[0x2486] = '\u0028\u0031\u0039\u0029';
KD[0x2487] = '\u0028\u0032\u0030\u0029';
KD[0x2488] = '\u0031\u002E';
KD[0x2489] = '\u0032\u002E';
KD[0x248A] = '\u0033\u002E';
KD[0x248B] = '\u0034\u002E';
KD[0x248C] = '\u0035\u002E';
KD[0x248D] = '\u0036\u002E';
KD[0x248E] = '\u0037\u002E';
KD[0x248F] = '\u0038\u002E';
KD[0x2490] = '\u0039\u002E';
KD[0x2491] = '\u0031\u0030\u002E';
KD[0x2492] = '\u0031\u0031\u002E';
KD[0x2493] = '\u0031\u0032\u002E';
KD[0x2494] = '\u0031\u0033\u002E';
KD[0x2495] = '\u0031\u0034\u002E';
KD[0x2496] = '\u0031\u0035\u002E';
KD[0x2497] = '\u0031\u0036\u002E';
KD[0x2498] = '\u0031\u0037\u002E';
KD[0x2499] = '\u0031\u0038\u002E';
KD[0x249A] = '\u0031\u0039\u002E';
KD[0x249B] = '\u0032\u0030\u002E';
KD[0x249C] = '\u0028\u0061\u0029';
KD[0x249D] = '\u0028\u0062\u0029';
KD[0x249E] = '\u0028\u0063\u0029';
KD[0x249F] = '\u0028\u0064\u0029';
KD[0x24A0] = '\u0028\u0065\u0029';
KD[0x24A1] = '\u0028\u0066\u0029';
KD[0x24A2] = '\u0028\u0067\u0029';
KD[0x24A3] = '\u0028\u0068\u0029';
KD[0x24A4] = '\u0028\u0069\u0029';
KD[0x24A5] = '\u0028\u006A\u0029';
KD[0x24A6] = '\u0028\u006B\u0029';
KD[0x24A7] = '\u0028\u006C\u0029';
KD[0x24A8] = '\u0028\u006D\u0029';
KD[0x24A9] = '\u0028\u006E\u0029';
KD[0x24AA] = '\u0028\u006F\u0029';
KD[0x24AB] = '\u0028\u0070\u0029';
KD[0x24AC] = '\u0028\u0071\u0029';
KD[0x24AD] = '\u0028\u0072\u0029';
KD[0x24AE] = '\u0028\u0073\u0029';
KD[0x24AF] = '\u0028\u0074\u0029';
KD[0x24B0] = '\u0028\u0075\u0029';
KD[0x24B1] = '\u0028\u0076\u0029';
KD[0x24B2] = '\u0028\u0077\u0029';
KD[0x24B3] = '\u0028\u0078\u0029';
KD[0x24B4] = '\u0028\u0079\u0029';
KD[0x24B5] = '\u0028\u007A\u0029';
KD[0x24B6] = '\u0041';
KD[0x24B7] = '\u0042';
KD[0x24B8] = '\u0043';
KD[0x24B9] = '\u0044';
KD[0x24BA] = '\u0045';
KD[0x24BB] = '\u0046';
KD[0x24BC] = '\u0047';
KD[0x24BD] = '\u0048';
KD[0x24BE] = '\u0049';
KD[0x24BF] = '\u004A';
KD[0x24C0] = '\u004B';
KD[0x24C1] = '\u004C';
KD[0x24C2] = '\u004D';
KD[0x24C3] = '\u004E';
KD[0x24C4] = '\u004F';
KD[0x24C5] = '\u0050';
KD[0x24C6] = '\u0051';
KD[0x24C7] = '\u0052';
KD[0x24C8] = '\u0053';
KD[0x24C9] = '\u0054';
KD[0x24CA] = '\u0055';
KD[0x24CB] = '\u0056';
KD[0x24CC] = '\u0057';
KD[0x24CD] = '\u0058';
KD[0x24CE] = '\u0059';
KD[0x24CF] = '\u005A';
KD[0x24D0] = '\u0061';
KD[0x24D1] = '\u0062';
KD[0x24D2] = '\u0063';
KD[0x24D3] = '\u0064';
KD[0x24D4] = '\u0065';
KD[0x24D5] = '\u0066';
KD[0x24D6] = '\u0067';
KD[0x24D7] = '\u0068';
KD[0x24D8] = '\u0069';
KD[0x24D9] = '\u006A';
KD[0x24DA] = '\u006B';
KD[0x24DB] = '\u006C';
KD[0x24DC] = '\u006D';
KD[0x24DD] = '\u006E';
KD[0x24DE] = '\u006F';
KD[0x24DF] = '\u0070';
KD[0x24E0] = '\u0071';
KD[0x24E1] = '\u0072';
KD[0x24E2] = '\u0073';
KD[0x24E3] = '\u0074';
KD[0x24E4] = '\u0075';
KD[0x24E5] = '\u0076';
KD[0x24E6] = '\u0077';
KD[0x24E7] = '\u0078';
KD[0x24E8] = '\u0079';
KD[0x24E9] = '\u007A';
KD[0x24EA] = '\u0030';
KD[0x2E9F] = '\u6BCD';
KD[0x2EF3] = '\u9F9F';
KD[0x2F00] = '\u4E00';
KD[0x2F01] = '\u4E28';
KD[0x2F02] = '\u4E36';
KD[0x2F03] = '\u4E3F';
KD[0x2F04] = '\u4E59';
KD[0x2F05] = '\u4E85';
KD[0x2F06] = '\u4E8C';
KD[0x2F07] = '\u4EA0';
KD[0x2F08] = '\u4EBA';
KD[0x2F09] = '\u513F';
KD[0x2F0A] = '\u5165';
KD[0x2F0B] = '\u516B';
KD[0x2F0C] = '\u5182';
KD[0x2F0D] = '\u5196';
KD[0x2F0E] = '\u51AB';
KD[0x2F0F] = '\u51E0';
KD[0x2F10] = '\u51F5';
KD[0x2F11] = '\u5200';
KD[0x2F12] = '\u529B';
KD[0x2F13] = '\u52F9';
KD[0x2F14] = '\u5315';
KD[0x2F15] = '\u531A';
KD[0x2F16] = '\u5338';
KD[0x2F17] = '\u5341';
KD[0x2F18] = '\u535C';
KD[0x2F19] = '\u5369';
KD[0x2F1A] = '\u5382';
KD[0x2F1B] = '\u53B6';
KD[0x2F1C] = '\u53C8';
KD[0x2F1D] = '\u53E3';
KD[0x2F1E] = '\u56D7';
KD[0x2F1F] = '\u571F';
KD[0x2F20] = '\u58EB';
KD[0x2F21] = '\u5902';
KD[0x2F22] = '\u590A';
KD[0x2F23] = '\u5915';
KD[0x2F24] = '\u5927';
KD[0x2F25] = '\u5973';
KD[0x2F26] = '\u5B50';
KD[0x2F27] = '\u5B80';
KD[0x2F28] = '\u5BF8';
KD[0x2F29] = '\u5C0F';
KD[0x2F2A] = '\u5C22';
KD[0x2F2B] = '\u5C38';
KD[0x2F2C] = '\u5C6E';
KD[0x2F2D] = '\u5C71';
KD[0x2F2E] = '\u5DDB';
KD[0x2F2F] = '\u5DE5';
KD[0x2F30] = '\u5DF1';
KD[0x2F31] = '\u5DFE';
KD[0x2F32] = '\u5E72';
KD[0x2F33] = '\u5E7A';
KD[0x2F34] = '\u5E7F';
KD[0x2F35] = '\u5EF4';
KD[0x2F36] = '\u5EFE';
KD[0x2F37] = '\u5F0B';
KD[0x2F38] = '\u5F13';
KD[0x2F39] = '\u5F50';
KD[0x2F3A] = '\u5F61';
KD[0x2F3B] = '\u5F73';
KD[0x2F3C] = '\u5FC3';
KD[0x2F3D] = '\u6208';
KD[0x2F3E] = '\u6236';
KD[0x2F3F] = '\u624B';
KD[0x2F40] = '\u652F';
KD[0x2F41] = '\u6534';
KD[0x2F42] = '\u6587';
KD[0x2F43] = '\u6597';
KD[0x2F44] = '\u65A4';
KD[0x2F45] = '\u65B9';
KD[0x2F46] = '\u65E0';
KD[0x2F47] = '\u65E5';
KD[0x2F48] = '\u66F0';
KD[0x2F49] = '\u6708';
KD[0x2F4A] = '\u6728';
KD[0x2F4B] = '\u6B20';
KD[0x2F4C] = '\u6B62';
KD[0x2F4D] = '\u6B79';
KD[0x2F4E] = '\u6BB3';
KD[0x2F4F] = '\u6BCB';
KD[0x2F50] = '\u6BD4';
KD[0x2F51] = '\u6BDB';
KD[0x2F52] = '\u6C0F';
KD[0x2F53] = '\u6C14';
KD[0x2F54] = '\u6C34';
KD[0x2F55] = '\u706B';
KD[0x2F56] = '\u722A';
KD[0x2F57] = '\u7236';
KD[0x2F58] = '\u723B';
KD[0x2F59] = '\u723F';
KD[0x2F5A] = '\u7247';
KD[0x2F5B] = '\u7259';
KD[0x2F5C] = '\u725B';
KD[0x2F5D] = '\u72AC';
KD[0x2F5E] = '\u7384';
KD[0x2F5F] = '\u7389';
KD[0x2F60] = '\u74DC';
KD[0x2F61] = '\u74E6';
KD[0x2F62] = '\u7518';
KD[0x2F63] = '\u751F';
KD[0x2F64] = '\u7528';
KD[0x2F65] = '\u7530';
KD[0x2F66] = '\u758B';
KD[0x2F67] = '\u7592';
KD[0x2F68] = '\u7676';
KD[0x2F69] = '\u767D';
KD[0x2F6A] = '\u76AE';
KD[0x2F6B] = '\u76BF';
KD[0x2F6C] = '\u76EE';
KD[0x2F6D] = '\u77DB';
KD[0x2F6E] = '\u77E2';
KD[0x2F6F] = '\u77F3';
KD[0x2F70] = '\u793A';
KD[0x2F71] = '\u79B8';
KD[0x2F72] = '\u79BE';
KD[0x2F73] = '\u7A74';
KD[0x2F74] = '\u7ACB';
KD[0x2F75] = '\u7AF9';
KD[0x2F76] = '\u7C73';
KD[0x2F77] = '\u7CF8';
KD[0x2F78] = '\u7F36';
KD[0x2F79] = '\u7F51';
KD[0x2F7A] = '\u7F8A';
KD[0x2F7B] = '\u7FBD';
KD[0x2F7C] = '\u8001';
KD[0x2F7D] = '\u800C';
KD[0x2F7E] = '\u8012';
KD[0x2F7F] = '\u8033';
KD[0x2F80] = '\u807F';
KD[0x2F81] = '\u8089';
KD[0x2F82] = '\u81E3';
KD[0x2F83] = '\u81EA';
KD[0x2F84] = '\u81F3';
KD[0x2F85] = '\u81FC';
KD[0x2F86] = '\u820C';
KD[0x2F87] = '\u821B';
KD[0x2F88] = '\u821F';
KD[0x2F89] = '\u826E';
KD[0x2F8A] = '\u8272';
KD[0x2F8B] = '\u8278';
KD[0x2F8C] = '\u864D';
KD[0x2F8D] = '\u866B';
KD[0x2F8E] = '\u8840';
KD[0x2F8F] = '\u884C';
KD[0x2F90] = '\u8863';
KD[0x2F91] = '\u897E';
KD[0x2F92] = '\u898B';
KD[0x2F93] = '\u89D2';
KD[0x2F94] = '\u8A00';
KD[0x2F95] = '\u8C37';
KD[0x2F96] = '\u8C46';
KD[0x2F97] = '\u8C55';
KD[0x2F98] = '\u8C78';
KD[0x2F99] = '\u8C9D';
KD[0x2F9A] = '\u8D64';
KD[0x2F9B] = '\u8D70';
KD[0x2F9C] = '\u8DB3';
KD[0x2F9D] = '\u8EAB';
KD[0x2F9E] = '\u8ECA';
KD[0x2F9F] = '\u8F9B';
KD[0x2FA0] = '\u8FB0';
KD[0x2FA1] = '\u8FB5';
KD[0x2FA2] = '\u9091';
KD[0x2FA3] = '\u9149';
KD[0x2FA4] = '\u91C6';
KD[0x2FA5] = '\u91CC';
KD[0x2FA6] = '\u91D1';
KD[0x2FA7] = '\u9577';
KD[0x2FA8] = '\u9580';
KD[0x2FA9] = '\u961C';
KD[0x2FAA] = '\u96B6';
KD[0x2FAB] = '\u96B9';
KD[0x2FAC] = '\u96E8';
KD[0x2FAD] = '\u9751';
KD[0x2FAE] = '\u975E';
KD[0x2FAF] = '\u9762';
KD[0x2FB0] = '\u9769';
KD[0x2FB1] = '\u97CB';
KD[0x2FB2] = '\u97ED';
KD[0x2FB3] = '\u97F3';
KD[0x2FB4] = '\u9801';
KD[0x2FB5] = '\u98A8';
KD[0x2FB6] = '\u98DB';
KD[0x2FB7] = '\u98DF';
KD[0x2FB8] = '\u9996';
KD[0x2FB9] = '\u9999';
KD[0x2FBA] = '\u99AC';
KD[0x2FBB] = '\u9AA8';
KD[0x2FBC] = '\u9AD8';
KD[0x2FBD] = '\u9ADF';
KD[0x2FBE] = '\u9B25';
KD[0x2FBF] = '\u9B2F';
KD[0x2FC0] = '\u9B32';
KD[0x2FC1] = '\u9B3C';
KD[0x2FC2] = '\u9B5A';
KD[0x2FC3] = '\u9CE5';
KD[0x2FC4] = '\u9E75';
KD[0x2FC5] = '\u9E7F';
KD[0x2FC6] = '\u9EA5';
KD[0x2FC7] = '\u9EBB';
KD[0x2FC8] = '\u9EC3';
KD[0x2FC9] = '\u9ECD';
KD[0x2FCA] = '\u9ED1';
KD[0x2FCB] = '\u9EF9';
KD[0x2FCC] = '\u9EFD';
KD[0x2FCD] = '\u9F0E';
KD[0x2FCE] = '\u9F13';
KD[0x2FCF] = '\u9F20';
KD[0x2FD0] = '\u9F3B';
KD[0x2FD1] = '\u9F4A';
KD[0x2FD2] = '\u9F52';
KD[0x2FD3] = '\u9F8D';
KD[0x2FD4] = '\u9F9C';
KD[0x2FD5] = '\u9FA0';
KD[0x3000] = '\u0020';
KD[0x3036] = '\u3012';
KD[0x3038] = '\u5341';
KD[0x3039] = '\u5344';
KD[0x303A] = '\u5345';
KD[0x304C] = '\u304B\u3099';
KD[0x304E] = '\u304D\u3099';
KD[0x3050] = '\u304F\u3099';
KD[0x3052] = '\u3051\u3099';
KD[0x3054] = '\u3053\u3099';
KD[0x3056] = '\u3055\u3099';
KD[0x3058] = '\u3057\u3099';
KD[0x305A] = '\u3059\u3099';
KD[0x305C] = '\u305B\u3099';
KD[0x305E] = '\u305D\u3099';
KD[0x3060] = '\u305F\u3099';
KD[0x3062] = '\u3061\u3099';
KD[0x3065] = '\u3064\u3099';
KD[0x3067] = '\u3066\u3099';
KD[0x3069] = '\u3068\u3099';
KD[0x3070] = '\u306F\u3099';
KD[0x3071] = '\u306F\u309A';
KD[0x3073] = '\u3072\u3099';
KD[0x3074] = '\u3072\u309A';
KD[0x3076] = '\u3075\u3099';
KD[0x3077] = '\u3075\u309A';
KD[0x3079] = '\u3078\u3099';
KD[0x307A] = '\u3078\u309A';
KD[0x307C] = '\u307B\u3099';
KD[0x307D] = '\u307B\u309A';
KD[0x3094] = '\u3046\u3099';
KD[0x309B] = '\u0020\u3099';
KD[0x309C] = '\u0020\u309A';
KD[0x309E] = '\u309D\u3099';
KD[0x30AC] = '\u30AB\u3099';
KD[0x30AE] = '\u30AD\u3099';
KD[0x30B0] = '\u30AF\u3099';
KD[0x30B2] = '\u30B1\u3099';
KD[0x30B4] = '\u30B3\u3099';
KD[0x30B6] = '\u30B5\u3099';
KD[0x30B8] = '\u30B7\u3099';
KD[0x30BA] = '\u30B9\u3099';
KD[0x30BC] = '\u30BB\u3099';
KD[0x30BE] = '\u30BD\u3099';
KD[0x30C0] = '\u30BF\u3099';
KD[0x30C2] = '\u30C1\u3099';
KD[0x30C5] = '\u30C4\u3099';
KD[0x30C7] = '\u30C6\u3099';
KD[0x30C9] = '\u30C8\u3099';
KD[0x30D0] = '\u30CF\u3099';
KD[0x30D1] = '\u30CF\u309A';
KD[0x30D3] = '\u30D2\u3099';
KD[0x30D4] = '\u30D2\u309A';
KD[0x30D6] = '\u30D5\u3099';
KD[0x30D7] = '\u30D5\u309A';
KD[0x30D9] = '\u30D8\u3099';
KD[0x30DA] = '\u30D8\u309A';
KD[0x30DC] = '\u30DB\u3099';
KD[0x30DD] = '\u30DB\u309A';
KD[0x30F4] = '\u30A6\u3099';
KD[0x30F7] = '\u30EF\u3099';
KD[0x30F8] = '\u30F0\u3099';
KD[0x30F9] = '\u30F1\u3099';
KD[0x30FA] = '\u30F2\u3099';
KD[0x30FE] = '\u30FD\u3099';
KD[0x3131] = '\u1100';
KD[0x3132] = '\u1101';
KD[0x3133] = '\u11AA';
KD[0x3134] = '\u1102';
KD[0x3135] = '\u11AC';
KD[0x3136] = '\u11AD';
KD[0x3137] = '\u1103';
KD[0x3138] = '\u1104';
KD[0x3139] = '\u1105';
KD[0x313A] = '\u11B0';
KD[0x313B] = '\u11B1';
KD[0x313C] = '\u11B2';
KD[0x313D] = '\u11B3';
KD[0x313E] = '\u11B4';
KD[0x313F] = '\u11B5';
KD[0x3140] = '\u111A';
KD[0x3141] = '\u1106';
KD[0x3142] = '\u1107';
KD[0x3143] = '\u1108';
KD[0x3144] = '\u1121';
KD[0x3145] = '\u1109';
KD[0x3146] = '\u110A';
KD[0x3147] = '\u110B';
KD[0x3148] = '\u110C';
KD[0x3149] = '\u110D';
KD[0x314A] = '\u110E';
KD[0x314B] = '\u110F';
KD[0x314C] = '\u1110';
KD[0x314D] = '\u1111';
KD[0x314E] = '\u1112';
KD[0x314F] = '\u1161';
KD[0x3150] = '\u1162';
KD[0x3151] = '\u1163';
KD[0x3152] = '\u1164';
KD[0x3153] = '\u1165';
KD[0x3154] = '\u1166';
KD[0x3155] = '\u1167';
KD[0x3156] = '\u1168';
KD[0x3157] = '\u1169';
KD[0x3158] = '\u116A';
KD[0x3159] = '\u116B';
KD[0x315A] = '\u116C';
KD[0x315B] = '\u116D';
KD[0x315C] = '\u116E';
KD[0x315D] = '\u116F';
KD[0x315E] = '\u1170';
KD[0x315F] = '\u1171';
KD[0x3160] = '\u1172';
KD[0x3161] = '\u1173';
KD[0x3162] = '\u1174';
KD[0x3163] = '\u1175';
KD[0x3164] = '\u1160';
KD[0x3165] = '\u1114';
KD[0x3166] = '\u1115';
KD[0x3167] = '\u11C7';
KD[0x3168] = '\u11C8';
KD[0x3169] = '\u11CC';
KD[0x316A] = '\u11CE';
KD[0x316B] = '\u11D3';
KD[0x316C] = '\u11D7';
KD[0x316D] = '\u11D9';
KD[0x316E] = '\u111C';
KD[0x316F] = '\u11DD';
KD[0x3170] = '\u11DF';
KD[0x3171] = '\u111D';
KD[0x3172] = '\u111E';
KD[0x3173] = '\u1120';
KD[0x3174] = '\u1122';
KD[0x3175] = '\u1123';
KD[0x3176] = '\u1127';
KD[0x3177] = '\u1129';
KD[0x3178] = '\u112B';
KD[0x3179] = '\u112C';
KD[0x317A] = '\u112D';
KD[0x317B] = '\u112E';
KD[0x317C] = '\u112F';
KD[0x317D] = '\u1132';
KD[0x317E] = '\u1136';
KD[0x317F] = '\u1140';
KD[0x3180] = '\u1147';
KD[0x3181] = '\u114C';
KD[0x3182] = '\u11F1';
KD[0x3183] = '\u11F2';
KD[0x3184] = '\u1157';
KD[0x3185] = '\u1158';
KD[0x3186] = '\u1159';
KD[0x3187] = '\u1184';
KD[0x3188] = '\u1185';
KD[0x3189] = '\u1188';
KD[0x318A] = '\u1191';
KD[0x318B] = '\u1192';
KD[0x318C] = '\u1194';
KD[0x318D] = '\u119E';
KD[0x318E] = '\u11A1';
KD[0x3192] = '\u4E00';
KD[0x3193] = '\u4E8C';
KD[0x3194] = '\u4E09';
KD[0x3195] = '\u56DB';
KD[0x3196] = '\u4E0A';
KD[0x3197] = '\u4E2D';
KD[0x3198] = '\u4E0B';
KD[0x3199] = '\u7532';
KD[0x319A] = '\u4E59';
KD[0x319B] = '\u4E19';
KD[0x319C] = '\u4E01';
KD[0x319D] = '\u5929';
KD[0x319E] = '\u5730';
KD[0x319F] = '\u4EBA';
KD[0x3200] = '\u0028\u1100\u0029';
KD[0x3201] = '\u0028\u1102\u0029';
KD[0x3202] = '\u0028\u1103\u0029';
KD[0x3203] = '\u0028\u1105\u0029';
KD[0x3204] = '\u0028\u1106\u0029';
KD[0x3205] = '\u0028\u1107\u0029';
KD[0x3206] = '\u0028\u1109\u0029';
KD[0x3207] = '\u0028\u110B\u0029';
KD[0x3208] = '\u0028\u110C\u0029';
KD[0x3209] = '\u0028\u110E\u0029';
KD[0x320A] = '\u0028\u110F\u0029';
KD[0x320B] = '\u0028\u1110\u0029';
KD[0x320C] = '\u0028\u1111\u0029';
KD[0x320D] = '\u0028\u1112\u0029';
KD[0x320E] = '\u0028\u1100\u1161\u0029';
KD[0x320F] = '\u0028\u1102\u1161\u0029';
KD[0x3210] = '\u0028\u1103\u1161\u0029';
KD[0x3211] = '\u0028\u1105\u1161\u0029';
KD[0x3212] = '\u0028\u1106\u1161\u0029';
KD[0x3213] = '\u0028\u1107\u1161\u0029';
KD[0x3214] = '\u0028\u1109\u1161\u0029';
KD[0x3215] = '\u0028\u110B\u1161\u0029';
KD[0x3216] = '\u0028\u110C\u1161\u0029';
KD[0x3217] = '\u0028\u110E\u1161\u0029';
KD[0x3218] = '\u0028\u110F\u1161\u0029';
KD[0x3219] = '\u0028\u1110\u1161\u0029';
KD[0x321A] = '\u0028\u1111\u1161\u0029';
KD[0x321B] = '\u0028\u1112\u1161\u0029';
KD[0x321C] = '\u0028\u110C\u116E\u0029';
KD[0x3220] = '\u0028\u4E00\u0029';
KD[0x3221] = '\u0028\u4E8C\u0029';
KD[0x3222] = '\u0028\u4E09\u0029';
KD[0x3223] = '\u0028\u56DB\u0029';
KD[0x3224] = '\u0028\u4E94\u0029';
KD[0x3225] = '\u0028\u516D\u0029';
KD[0x3226] = '\u0028\u4E03\u0029';
KD[0x3227] = '\u0028\u516B\u0029';
KD[0x3228] = '\u0028\u4E5D\u0029';
KD[0x3229] = '\u0028\u5341\u0029';
KD[0x322A] = '\u0028\u6708\u0029';
KD[0x322B] = '\u0028\u706B\u0029';
KD[0x322C] = '\u0028\u6C34\u0029';
KD[0x322D] = '\u0028\u6728\u0029';
KD[0x322E] = '\u0028\u91D1\u0029';
KD[0x322F] = '\u0028\u571F\u0029';
KD[0x3230] = '\u0028\u65E5\u0029';
KD[0x3231] = '\u0028\u682A\u0029';
KD[0x3232] = '\u0028\u6709\u0029';
KD[0x3233] = '\u0028\u793E\u0029';
KD[0x3234] = '\u0028\u540D\u0029';
KD[0x3235] = '\u0028\u7279\u0029';
KD[0x3236] = '\u0028\u8CA1\u0029';
KD[0x3237] = '\u0028\u795D\u0029';
KD[0x3238] = '\u0028\u52B4\u0029';
KD[0x3239] = '\u0028\u4EE3\u0029';
KD[0x323A] = '\u0028\u547C\u0029';
KD[0x323B] = '\u0028\u5B66\u0029';
KD[0x323C] = '\u0028\u76E3\u0029';
KD[0x323D] = '\u0028\u4F01\u0029';
KD[0x323E] = '\u0028\u8CC7\u0029';
KD[0x323F] = '\u0028\u5354\u0029';
KD[0x3240] = '\u0028\u796D\u0029';
KD[0x3241] = '\u0028\u4F11\u0029';
KD[0x3242] = '\u0028\u81EA\u0029';
KD[0x3243] = '\u0028\u81F3\u0029';
KD[0x3260] = '\u1100';
KD[0x3261] = '\u1102';
KD[0x3262] = '\u1103';
KD[0x3263] = '\u1105';
KD[0x3264] = '\u1106';
KD[0x3265] = '\u1107';
KD[0x3266] = '\u1109';
KD[0x3267] = '\u110B';
KD[0x3268] = '\u110C';
KD[0x3269] = '\u110E';
KD[0x326A] = '\u110F';
KD[0x326B] = '\u1110';
KD[0x326C] = '\u1111';
KD[0x326D] = '\u1112';
KD[0x326E] = '\u1100\u1161';
KD[0x326F] = '\u1102\u1161';
KD[0x3270] = '\u1103\u1161';
KD[0x3271] = '\u1105\u1161';
KD[0x3272] = '\u1106\u1161';
KD[0x3273] = '\u1107\u1161';
KD[0x3274] = '\u1109\u1161';
KD[0x3275] = '\u110B\u1161';
KD[0x3276] = '\u110C\u1161';
KD[0x3277] = '\u110E\u1161';
KD[0x3278] = '\u110F\u1161';
KD[0x3279] = '\u1110\u1161';
KD[0x327A] = '\u1111\u1161';
KD[0x327B] = '\u1112\u1161';
KD[0x3280] = '\u4E00';
KD[0x3281] = '\u4E8C';
KD[0x3282] = '\u4E09';
KD[0x3283] = '\u56DB';
KD[0x3284] = '\u4E94';
KD[0x3285] = '\u516D';
KD[0x3286] = '\u4E03';
KD[0x3287] = '\u516B';
KD[0x3288] = '\u4E5D';
KD[0x3289] = '\u5341';
KD[0x328A] = '\u6708';
KD[0x328B] = '\u706B';
KD[0x328C] = '\u6C34';
KD[0x328D] = '\u6728';
KD[0x328E] = '\u91D1';
KD[0x328F] = '\u571F';
KD[0x3290] = '\u65E5';
KD[0x3291] = '\u682A';
KD[0x3292] = '\u6709';
KD[0x3293] = '\u793E';
KD[0x3294] = '\u540D';
KD[0x3295] = '\u7279';
KD[0x3296] = '\u8CA1';
KD[0x3297] = '\u795D';
KD[0x3298] = '\u52B4';
KD[0x3299] = '\u79D8';
KD[0x329A] = '\u7537';
KD[0x329B] = '\u5973';
KD[0x329C] = '\u9069';
KD[0x329D] = '\u512A';
KD[0x329E] = '\u5370';
KD[0x329F] = '\u6CE8';
KD[0x32A0] = '\u9805';
KD[0x32A1] = '\u4F11';
KD[0x32A2] = '\u5199';
KD[0x32A3] = '\u6B63';
KD[0x32A4] = '\u4E0A';
KD[0x32A5] = '\u4E2D';
KD[0x32A6] = '\u4E0B';
KD[0x32A7] = '\u5DE6';
KD[0x32A8] = '\u53F3';
KD[0x32A9] = '\u533B';
KD[0x32AA] = '\u5B97';
KD[0x32AB] = '\u5B66';
KD[0x32AC] = '\u76E3';
KD[0x32AD] = '\u4F01';
KD[0x32AE] = '\u8CC7';
KD[0x32AF] = '\u5354';
KD[0x32B0] = '\u591C';
KD[0x32C0] = '\u0031\u6708';
KD[0x32C1] = '\u0032\u6708';
KD[0x32C2] = '\u0033\u6708';
KD[0x32C3] = '\u0034\u6708';
KD[0x32C4] = '\u0035\u6708';
KD[0x32C5] = '\u0036\u6708';
KD[0x32C6] = '\u0037\u6708';
KD[0x32C7] = '\u0038\u6708';
KD[0x32C8] = '\u0039\u6708';
KD[0x32C9] = '\u0031\u0030\u6708';
KD[0x32CA] = '\u0031\u0031\u6708';
KD[0x32CB] = '\u0031\u0032\u6708';
KD[0x32D0] = '\u30A2';
KD[0x32D1] = '\u30A4';
KD[0x32D2] = '\u30A6';
KD[0x32D3] = '\u30A8';
KD[0x32D4] = '\u30AA';
KD[0x32D5] = '\u30AB';
KD[0x32D6] = '\u30AD';
KD[0x32D7] = '\u30AF';
KD[0x32D8] = '\u30B1';
KD[0x32D9] = '\u30B3';
KD[0x32DA] = '\u30B5';
KD[0x32DB] = '\u30B7';
KD[0x32DC] = '\u30B9';
KD[0x32DD] = '\u30BB';
KD[0x32DE] = '\u30BD';
KD[0x32DF] = '\u30BF';
KD[0x32E0] = '\u30C1';
KD[0x32E1] = '\u30C4';
KD[0x32E2] = '\u30C6';
KD[0x32E3] = '\u30C8';
KD[0x32E4] = '\u30CA';
KD[0x32E5] = '\u30CB';
KD[0x32E6] = '\u30CC';
KD[0x32E7] = '\u30CD';
KD[0x32E8] = '\u30CE';
KD[0x32E9] = '\u30CF';
KD[0x32EA] = '\u30D2';
KD[0x32EB] = '\u30D5';
KD[0x32EC] = '\u30D8';
KD[0x32ED] = '\u30DB';
KD[0x32EE] = '\u30DE';
KD[0x32EF] = '\u30DF';
KD[0x32F0] = '\u30E0';
KD[0x32F1] = '\u30E1';
KD[0x32F2] = '\u30E2';
KD[0x32F3] = '\u30E4';
KD[0x32F4] = '\u30E6';
KD[0x32F5] = '\u30E8';
KD[0x32F6] = '\u30E9';
KD[0x32F7] = '\u30EA';
KD[0x32F8] = '\u30EB';
KD[0x32F9] = '\u30EC';
KD[0x32FA] = '\u30ED';
KD[0x32FB] = '\u30EF';
KD[0x32FC] = '\u30F0';
KD[0x32FD] = '\u30F1';
KD[0x32FE] = '\u30F2';
KD[0x3300] = '\u30A2\u30CF\u309A\u30FC\u30C8';
KD[0x3301] = '\u30A2\u30EB\u30D5\u30A1';
KD[0x3302] = '\u30A2\u30F3\u30D8\u309A\u30A2';
KD[0x3303] = '\u30A2\u30FC\u30EB';
KD[0x3304] = '\u30A4\u30CB\u30F3\u30AF\u3099';
KD[0x3305] = '\u30A4\u30F3\u30C1';
KD[0x3306] = '\u30A6\u30A9\u30F3';
KD[0x3307] = '\u30A8\u30B9\u30AF\u30FC\u30C8\u3099';
KD[0x3308] = '\u30A8\u30FC\u30AB\u30FC';
KD[0x3309] = '\u30AA\u30F3\u30B9';
KD[0x330A] = '\u30AA\u30FC\u30E0';
KD[0x330B] = '\u30AB\u30A4\u30EA';
KD[0x330C] = '\u30AB\u30E9\u30C3\u30C8';
KD[0x330D] = '\u30AB\u30ED\u30EA\u30FC';
KD[0x330E] = '\u30AB\u3099\u30ED\u30F3';
KD[0x330F] = '\u30AB\u3099\u30F3\u30DE';
KD[0x3310] = '\u30AD\u3099\u30AB\u3099';
KD[0x3311] = '\u30AD\u3099\u30CB\u30FC';
KD[0x3312] = '\u30AD\u30E5\u30EA\u30FC';
KD[0x3313] = '\u30AD\u3099\u30EB\u30BF\u3099\u30FC';
KD[0x3314] = '\u30AD\u30ED';
KD[0x3315] = '\u30AD\u30ED\u30AF\u3099\u30E9\u30E0';
KD[0x3316] = '\u30AD\u30ED\u30E1\u30FC\u30C8\u30EB';
KD[0x3317] = '\u30AD\u30ED\u30EF\u30C3\u30C8';
KD[0x3318] = '\u30AF\u3099\u30E9\u30E0';
KD[0x3319] = '\u30AF\u3099\u30E9\u30E0\u30C8\u30F3';
KD[0x331A] = '\u30AF\u30EB\u30BB\u3099\u30A4\u30ED';
KD[0x331B] = '\u30AF\u30ED\u30FC\u30CD';
KD[0x331C] = '\u30B1\u30FC\u30B9';
KD[0x331D] = '\u30B3\u30EB\u30CA';
KD[0x331E] = '\u30B3\u30FC\u30DB\u309A';
KD[0x331F] = '\u30B5\u30A4\u30AF\u30EB';
KD[0x3320] = '\u30B5\u30F3\u30C1\u30FC\u30E0';
KD[0x3321] = '\u30B7\u30EA\u30F3\u30AF\u3099';
KD[0x3322] = '\u30BB\u30F3\u30C1';
KD[0x3323] = '\u30BB\u30F3\u30C8';
KD[0x3324] = '\u30BF\u3099\u30FC\u30B9';
KD[0x3325] = '\u30C6\u3099\u30B7';
KD[0x3326] = '\u30C8\u3099\u30EB';
KD[0x3327] = '\u30C8\u30F3';
KD[0x3328] = '\u30CA\u30CE';
KD[0x3329] = '\u30CE\u30C3\u30C8';
KD[0x332A] = '\u30CF\u30A4\u30C4';
KD[0x332B] = '\u30CF\u309A\u30FC\u30BB\u30F3\u30C8';
KD[0x332C] = '\u30CF\u309A\u30FC\u30C4';
KD[0x332D] = '\u30CF\u3099\u30FC\u30EC\u30EB';
KD[0x332E] = '\u30D2\u309A\u30A2\u30B9\u30C8\u30EB';
KD[0x332F] = '\u30D2\u309A\u30AF\u30EB';
KD[0x3330] = '\u30D2\u309A\u30B3';
KD[0x3331] = '\u30D2\u3099\u30EB';
KD[0x3332] = '\u30D5\u30A1\u30E9\u30C3\u30C8\u3099';
KD[0x3333] = '\u30D5\u30A3\u30FC\u30C8';
KD[0x3334] = '\u30D5\u3099\u30C3\u30B7\u30A7\u30EB';
KD[0x3335] = '\u30D5\u30E9\u30F3';
KD[0x3336] = '\u30D8\u30AF\u30BF\u30FC\u30EB';
KD[0x3337] = '\u30D8\u309A\u30BD';
KD[0x3338] = '\u30D8\u309A\u30CB\u30D2';
KD[0x3339] = '\u30D8\u30EB\u30C4';
KD[0x333A] = '\u30D8\u309A\u30F3\u30B9';
KD[0x333B] = '\u30D8\u309A\u30FC\u30B7\u3099';
KD[0x333C] = '\u30D8\u3099\u30FC\u30BF';
KD[0x333D] = '\u30DB\u309A\u30A4\u30F3\u30C8';
KD[0x333E] = '\u30DB\u3099\u30EB\u30C8';
KD[0x333F] = '\u30DB\u30F3';
KD[0x3340] = '\u30DB\u309A\u30F3\u30C8\u3099';
KD[0x3341] = '\u30DB\u30FC\u30EB';
KD[0x3342] = '\u30DB\u30FC\u30F3';
KD[0x3343] = '\u30DE\u30A4\u30AF\u30ED';
KD[0x3344] = '\u30DE\u30A4\u30EB';
KD[0x3345] = '\u30DE\u30C3\u30CF';
KD[0x3346] = '\u30DE\u30EB\u30AF';
KD[0x3347] = '\u30DE\u30F3\u30B7\u30E7\u30F3';
KD[0x3348] = '\u30DF\u30AF\u30ED\u30F3';
KD[0x3349] = '\u30DF\u30EA';
KD[0x334A] = '\u30DF\u30EA\u30CF\u3099\u30FC\u30EB';
KD[0x334B] = '\u30E1\u30AB\u3099';
KD[0x334C] = '\u30E1\u30AB\u3099\u30C8\u30F3';
KD[0x334D] = '\u30E1\u30FC\u30C8\u30EB';
KD[0x334E] = '\u30E4\u30FC\u30C8\u3099';
KD[0x334F] = '\u30E4\u30FC\u30EB';
KD[0x3350] = '\u30E6\u30A2\u30F3';
KD[0x3351] = '\u30EA\u30C3\u30C8\u30EB';
KD[0x3352] = '\u30EA\u30E9';
KD[0x3353] = '\u30EB\u30D2\u309A\u30FC';
KD[0x3354] = '\u30EB\u30FC\u30D5\u3099\u30EB';
KD[0x3355] = '\u30EC\u30E0';
KD[0x3356] = '\u30EC\u30F3\u30C8\u30B1\u3099\u30F3';
KD[0x3357] = '\u30EF\u30C3\u30C8';
KD[0x3358] = '\u0030\u70B9';
KD[0x3359] = '\u0031\u70B9';
KD[0x335A] = '\u0032\u70B9';
KD[0x335B] = '\u0033\u70B9';
KD[0x335C] = '\u0034\u70B9';
KD[0x335D] = '\u0035\u70B9';
KD[0x335E] = '\u0036\u70B9';
KD[0x335F] = '\u0037\u70B9';
KD[0x3360] = '\u0038\u70B9';
KD[0x3361] = '\u0039\u70B9';
KD[0x3362] = '\u0031\u0030\u70B9';
KD[0x3363] = '\u0031\u0031\u70B9';
KD[0x3364] = '\u0031\u0032\u70B9';
KD[0x3365] = '\u0031\u0033\u70B9';
KD[0x3366] = '\u0031\u0034\u70B9';
KD[0x3367] = '\u0031\u0035\u70B9';
KD[0x3368] = '\u0031\u0036\u70B9';
KD[0x3369] = '\u0031\u0037\u70B9';
KD[0x336A] = '\u0031\u0038\u70B9';
KD[0x336B] = '\u0031\u0039\u70B9';
KD[0x336C] = '\u0032\u0030\u70B9';
KD[0x336D] = '\u0032\u0031\u70B9';
KD[0x336E] = '\u0032\u0032\u70B9';
KD[0x336F] = '\u0032\u0033\u70B9';
KD[0x3370] = '\u0032\u0034\u70B9';
KD[0x3371] = '\u0068\u0050\u0061';
KD[0x3372] = '\u0064\u0061';
KD[0x3373] = '\u0041\u0055';
KD[0x3374] = '\u0062\u0061\u0072';
KD[0x3375] = '\u006F\u0056';
KD[0x3376] = '\u0070\u0063';
KD[0x337B] = '\u5E73\u6210';
KD[0x337C] = '\u662D\u548C';
KD[0x337D] = '\u5927\u6B63';
KD[0x337E] = '\u660E\u6CBB';
KD[0x337F] = '\u682A\u5F0F\u4F1A\u793E';
KD[0x3380] = '\u0070\u0041';
KD[0x3381] = '\u006E\u0041';
KD[0x3382] = '\u03BC\u0041';
KD[0x3383] = '\u006D\u0041';
KD[0x3384] = '\u006B\u0041';
KD[0x3385] = '\u004B\u0042';
KD[0x3386] = '\u004D\u0042';
KD[0x3387] = '\u0047\u0042';
KD[0x3388] = '\u0063\u0061\u006C';
KD[0x3389] = '\u006B\u0063\u0061\u006C';
KD[0x338A] = '\u0070\u0046';
KD[0x338B] = '\u006E\u0046';
KD[0x338C] = '\u03BC\u0046';
KD[0x338D] = '\u03BC\u0067';
KD[0x338E] = '\u006D\u0067';
KD[0x338F] = '\u006B\u0067';
KD[0x3390] = '\u0048\u007A';
KD[0x3391] = '\u006B\u0048\u007A';
KD[0x3392] = '\u004D\u0048\u007A';
KD[0x3393] = '\u0047\u0048\u007A';
KD[0x3394] = '\u0054\u0048\u007A';
KD[0x3395] = '\u03BC\u006C';
KD[0x3396] = '\u006D\u006C';
KD[0x3397] = '\u0064\u006C';
KD[0x3398] = '\u006B\u006C';
KD[0x3399] = '\u0066\u006D';
KD[0x339A] = '\u006E\u006D';
KD[0x339B] = '\u03BC\u006D';
KD[0x339C] = '\u006D\u006D';
KD[0x339D] = '\u0063\u006D';
KD[0x339E] = '\u006B\u006D';
KD[0x339F] = '\u006D\u006D\u0032';
KD[0x33A0] = '\u0063\u006D\u0032';
KD[0x33A1] = '\u006D\u0032';
KD[0x33A2] = '\u006B\u006D\u0032';
KD[0x33A3] = '\u006D\u006D\u0033';
KD[0x33A4] = '\u0063\u006D\u0033';
KD[0x33A5] = '\u006D\u0033';
KD[0x33A6] = '\u006B\u006D\u0033';
KD[0x33A7] = '\u006D\u2215\u0073';
KD[0x33A8] = '\u006D\u2215\u0073\u0032';
KD[0x33A9] = '\u0050\u0061';
KD[0x33AA] = '\u006B\u0050\u0061';
KD[0x33AB] = '\u004D\u0050\u0061';
KD[0x33AC] = '\u0047\u0050\u0061';
KD[0x33AD] = '\u0072\u0061\u0064';
KD[0x33AE] = '\u0072\u0061\u0064\u2215\u0073';
KD[0x33AF] = '\u0072\u0061\u0064\u2215\u0073\u0032';
KD[0x33B0] = '\u0070\u0073';
KD[0x33B1] = '\u006E\u0073';
KD[0x33B2] = '\u03BC\u0073';
KD[0x33B3] = '\u006D\u0073';
KD[0x33B4] = '\u0070\u0056';
KD[0x33B5] = '\u006E\u0056';
KD[0x33B6] = '\u03BC\u0056';
KD[0x33B7] = '\u006D\u0056';
KD[0x33B8] = '\u006B\u0056';
KD[0x33B9] = '\u004D\u0056';
KD[0x33BA] = '\u0070\u0057';
KD[0x33BB] = '\u006E\u0057';
KD[0x33BC] = '\u03BC\u0057';
KD[0x33BD] = '\u006D\u0057';
KD[0x33BE] = '\u006B\u0057';
KD[0x33BF] = '\u004D\u0057';
KD[0x33C0] = '\u006B\u03A9';
KD[0x33C1] = '\u004D\u03A9';
KD[0x33C2] = '\u0061\u002E\u006D\u002E';
KD[0x33C3] = '\u0042\u0071';
KD[0x33C4] = '\u0063\u0063';
KD[0x33C5] = '\u0063\u0064';
KD[0x33C6] = '\u0043\u2215\u006B\u0067';
KD[0x33C7] = '\u0043\u006F\u002E';
KD[0x33C8] = '\u0064\u0042';
KD[0x33C9] = '\u0047\u0079';
KD[0x33CA] = '\u0068\u0061';
KD[0x33CB] = '\u0048\u0050';
KD[0x33CC] = '\u0069\u006E';
KD[0x33CD] = '\u004B\u004B';
KD[0x33CE] = '\u004B\u004D';
KD[0x33CF] = '\u006B\u0074';
KD[0x33D0] = '\u006C\u006D';
KD[0x33D1] = '\u006C\u006E';
KD[0x33D2] = '\u006C\u006F\u0067';
KD[0x33D3] = '\u006C\u0078';
KD[0x33D4] = '\u006D\u0062';
KD[0x33D5] = '\u006D\u0069\u006C';
KD[0x33D6] = '\u006D\u006F\u006C';
KD[0x33D7] = '\u0050\u0048';
KD[0x33D8] = '\u0070\u002E\u006D\u002E';
KD[0x33D9] = '\u0050\u0050\u004D';
KD[0x33DA] = '\u0050\u0052';
KD[0x33DB] = '\u0073\u0072';
KD[0x33DC] = '\u0053\u0076';
KD[0x33DD] = '\u0057\u0062';
KD[0x33E0] = '\u0031\u65E5';
KD[0x33E1] = '\u0032\u65E5';
KD[0x33E2] = '\u0033\u65E5';
KD[0x33E3] = '\u0034\u65E5';
KD[0x33E4] = '\u0035\u65E5';
KD[0x33E5] = '\u0036\u65E5';
KD[0x33E6] = '\u0037\u65E5';
KD[0x33E7] = '\u0038\u65E5';
KD[0x33E8] = '\u0039\u65E5';
KD[0x33E9] = '\u0031\u0030\u65E5';
KD[0x33EA] = '\u0031\u0031\u65E5';
KD[0x33EB] = '\u0031\u0032\u65E5';
KD[0x33EC] = '\u0031\u0033\u65E5';
KD[0x33ED] = '\u0031\u0034\u65E5';
KD[0x33EE] = '\u0031\u0035\u65E5';
KD[0x33EF] = '\u0031\u0036\u65E5';
KD[0x33F0] = '\u0031\u0037\u65E5';
KD[0x33F1] = '\u0031\u0038\u65E5';
KD[0x33F2] = '\u0031\u0039\u65E5';
KD[0x33F3] = '\u0032\u0030\u65E5';
KD[0x33F4] = '\u0032\u0031\u65E5';
KD[0x33F5] = '\u0032\u0032\u65E5';
KD[0x33F6] = '\u0032\u0033\u65E5';
KD[0x33F7] = '\u0032\u0034\u65E5';
KD[0x33F8] = '\u0032\u0035\u65E5';
KD[0x33F9] = '\u0032\u0036\u65E5';
KD[0x33FA] = '\u0032\u0037\u65E5';
KD[0x33FB] = '\u0032\u0038\u65E5';
KD[0x33FC] = '\u0032\u0039\u65E5';
KD[0x33FD] = '\u0033\u0030\u65E5';
KD[0x33FE] = '\u0033\u0031\u65E5';
KD[0xF900] = '\u8C48';
KD[0xF901] = '\u66F4';
KD[0xF902] = '\u8ECA';
KD[0xF903] = '\u8CC8';
KD[0xF904] = '\u6ED1';
KD[0xF905] = '\u4E32';
KD[0xF906] = '\u53E5';
KD[0xF907] = '\u9F9C';
KD[0xF908] = '\u9F9C';
KD[0xF909] = '\u5951';
KD[0xF90A] = '\u91D1';
KD[0xF90B] = '\u5587';
KD[0xF90C] = '\u5948';
KD[0xF90D] = '\u61F6';
KD[0xF90E] = '\u7669';
KD[0xF90F] = '\u7F85';
KD[0xF910] = '\u863F';
KD[0xF911] = '\u87BA';
KD[0xF912] = '\u88F8';
KD[0xF913] = '\u908F';
KD[0xF914] = '\u6A02';
KD[0xF915] = '\u6D1B';
KD[0xF916] = '\u70D9';
KD[0xF917] = '\u73DE';
KD[0xF918] = '\u843D';
KD[0xF919] = '\u916A';
KD[0xF91A] = '\u99F1';
KD[0xF91B] = '\u4E82';
KD[0xF91C] = '\u5375';
KD[0xF91D] = '\u6B04';
KD[0xF91E] = '\u721B';
KD[0xF91F] = '\u862D';
KD[0xF920] = '\u9E1E';
KD[0xF921] = '\u5D50';
KD[0xF922] = '\u6FEB';
KD[0xF923] = '\u85CD';
KD[0xF924] = '\u8964';
KD[0xF925] = '\u62C9';
KD[0xF926] = '\u81D8';
KD[0xF927] = '\u881F';
KD[0xF928] = '\u5ECA';
KD[0xF929] = '\u6717';
KD[0xF92A] = '\u6D6A';
KD[0xF92B] = '\u72FC';
KD[0xF92C] = '\u90CE';
KD[0xF92D] = '\u4F86';
KD[0xF92E] = '\u51B7';
KD[0xF92F] = '\u52DE';
KD[0xF930] = '\u64C4';
KD[0xF931] = '\u6AD3';
KD[0xF932] = '\u7210';
KD[0xF933] = '\u76E7';
KD[0xF934] = '\u8001';
KD[0xF935] = '\u8606';
KD[0xF936] = '\u865C';
KD[0xF937] = '\u8DEF';
KD[0xF938] = '\u9732';
KD[0xF939] = '\u9B6F';
KD[0xF93A] = '\u9DFA';
KD[0xF93B] = '\u788C';
KD[0xF93C] = '\u797F';
KD[0xF93D] = '\u7DA0';
KD[0xF93E] = '\u83C9';
KD[0xF93F] = '\u9304';
KD[0xF940] = '\u9E7F';
KD[0xF941] = '\u8AD6';
KD[0xF942] = '\u58DF';
KD[0xF943] = '\u5F04';
KD[0xF944] = '\u7C60';
KD[0xF945] = '\u807E';
KD[0xF946] = '\u7262';
KD[0xF947] = '\u78CA';
KD[0xF948] = '\u8CC2';
KD[0xF949] = '\u96F7';
KD[0xF94A] = '\u58D8';
KD[0xF94B] = '\u5C62';
KD[0xF94C] = '\u6A13';
KD[0xF94D] = '\u6DDA';
KD[0xF94E] = '\u6F0F';
KD[0xF94F] = '\u7D2F';
KD[0xF950] = '\u7E37';
KD[0xF951] = '\u96FB';
KD[0xF952] = '\u52D2';
KD[0xF953] = '\u808B';
KD[0xF954] = '\u51DC';
KD[0xF955] = '\u51CC';
KD[0xF956] = '\u7A1C';
KD[0xF957] = '\u7DBE';
KD[0xF958] = '\u83F1';
KD[0xF959] = '\u9675';
KD[0xF95A] = '\u8B80';
KD[0xF95B] = '\u62CF';
KD[0xF95C] = '\u6A02';
KD[0xF95D] = '\u8AFE';
KD[0xF95E] = '\u4E39';
KD[0xF95F] = '\u5BE7';
KD[0xF960] = '\u6012';
KD[0xF961] = '\u7387';
KD[0xF962] = '\u7570';
KD[0xF963] = '\u5317';
KD[0xF964] = '\u78FB';
KD[0xF965] = '\u4FBF';
KD[0xF966] = '\u5FA9';
KD[0xF967] = '\u4E0D';
KD[0xF968] = '\u6CCC';
KD[0xF969] = '\u6578';
KD[0xF96A] = '\u7D22';
KD[0xF96B] = '\u53C3';
KD[0xF96C] = '\u585E';
KD[0xF96D] = '\u7701';
KD[0xF96E] = '\u8449';
KD[0xF96F] = '\u8AAA';
KD[0xF970] = '\u6BBA';
KD[0xF971] = '\u8FB0';
KD[0xF972] = '\u6C88';
KD[0xF973] = '\u62FE';
KD[0xF974] = '\u82E5';
KD[0xF975] = '\u63A0';
KD[0xF976] = '\u7565';
KD[0xF977] = '\u4EAE';
KD[0xF978] = '\u5169';
KD[0xF979] = '\u51C9';
KD[0xF97A] = '\u6881';
KD[0xF97B] = '\u7CE7';
KD[0xF97C] = '\u826F';
KD[0xF97D] = '\u8AD2';
KD[0xF97E] = '\u91CF';
KD[0xF97F] = '\u52F5';
KD[0xF980] = '\u5442';
KD[0xF981] = '\u5973';
KD[0xF982] = '\u5EEC';
KD[0xF983] = '\u65C5';
KD[0xF984] = '\u6FFE';
KD[0xF985] = '\u792A';
KD[0xF986] = '\u95AD';
KD[0xF987] = '\u9A6A';
KD[0xF988] = '\u9E97';
KD[0xF989] = '\u9ECE';
KD[0xF98A] = '\u529B';
KD[0xF98B] = '\u66C6';
KD[0xF98C] = '\u6B77';
KD[0xF98D] = '\u8F62';
KD[0xF98E] = '\u5E74';
KD[0xF98F] = '\u6190';
KD[0xF990] = '\u6200';
KD[0xF991] = '\u649A';
KD[0xF992] = '\u6F23';
KD[0xF993] = '\u7149';
KD[0xF994] = '\u7489';
KD[0xF995] = '\u79CA';
KD[0xF996] = '\u7DF4';
KD[0xF997] = '\u806F';
KD[0xF998] = '\u8F26';
KD[0xF999] = '\u84EE';
KD[0xF99A] = '\u9023';
KD[0xF99B] = '\u934A';
KD[0xF99C] = '\u5217';
KD[0xF99D] = '\u52A3';
KD[0xF99E] = '\u54BD';
KD[0xF99F] = '\u70C8';
KD[0xF9A0] = '\u88C2';
KD[0xF9A1] = '\u8AAA';
KD[0xF9A2] = '\u5EC9';
KD[0xF9A3] = '\u5FF5';
KD[0xF9A4] = '\u637B';
KD[0xF9A5] = '\u6BAE';
KD[0xF9A6] = '\u7C3E';
KD[0xF9A7] = '\u7375';
KD[0xF9A8] = '\u4EE4';
KD[0xF9A9] = '\u56F9';
KD[0xF9AA] = '\u5BE7';
KD[0xF9AB] = '\u5DBA';
KD[0xF9AC] = '\u601C';
KD[0xF9AD] = '\u73B2';
KD[0xF9AE] = '\u7469';
KD[0xF9AF] = '\u7F9A';
KD[0xF9B0] = '\u8046';
KD[0xF9B1] = '\u9234';
KD[0xF9B2] = '\u96F6';
KD[0xF9B3] = '\u9748';
KD[0xF9B4] = '\u9818';
KD[0xF9B5] = '\u4F8B';
KD[0xF9B6] = '\u79AE';
KD[0xF9B7] = '\u91B4';
KD[0xF9B8] = '\u96B8';
KD[0xF9B9] = '\u60E1';
KD[0xF9BA] = '\u4E86';
KD[0xF9BB] = '\u50DA';
KD[0xF9BC] = '\u5BEE';
KD[0xF9BD] = '\u5C3F';
KD[0xF9BE] = '\u6599';
KD[0xF9BF] = '\u6A02';
KD[0xF9C0] = '\u71CE';
KD[0xF9C1] = '\u7642';
KD[0xF9C2] = '\u84FC';
KD[0xF9C3] = '\u907C';
KD[0xF9C4] = '\u9F8D';
KD[0xF9C5] = '\u6688';
KD[0xF9C6] = '\u962E';
KD[0xF9C7] = '\u5289';
KD[0xF9C8] = '\u677B';
KD[0xF9C9] = '\u67F3';
KD[0xF9CA] = '\u6D41';
KD[0xF9CB] = '\u6E9C';
KD[0xF9CC] = '\u7409';
KD[0xF9CD] = '\u7559';
KD[0xF9CE] = '\u786B';
KD[0xF9CF] = '\u7D10';
KD[0xF9D0] = '\u985E';
KD[0xF9D1] = '\u516D';
KD[0xF9D2] = '\u622E';
KD[0xF9D3] = '\u9678';
KD[0xF9D4] = '\u502B';
KD[0xF9D5] = '\u5D19';
KD[0xF9D6] = '\u6DEA';
KD[0xF9D7] = '\u8F2A';
KD[0xF9D8] = '\u5F8B';
KD[0xF9D9] = '\u6144';
KD[0xF9DA] = '\u6817';
KD[0xF9DB] = '\u7387';
KD[0xF9DC] = '\u9686';
KD[0xF9DD] = '\u5229';
KD[0xF9DE] = '\u540F';
KD[0xF9DF] = '\u5C65';
KD[0xF9E0] = '\u6613';
KD[0xF9E1] = '\u674E';
KD[0xF9E2] = '\u68A8';
KD[0xF9E3] = '\u6CE5';
KD[0xF9E4] = '\u7406';
KD[0xF9E5] = '\u75E2';
KD[0xF9E6] = '\u7F79';
KD[0xF9E7] = '\u88CF';
KD[0xF9E8] = '\u88E1';
KD[0xF9E9] = '\u91CC';
KD[0xF9EA] = '\u96E2';
KD[0xF9EB] = '\u533F';
KD[0xF9EC] = '\u6EBA';
KD[0xF9ED] = '\u541D';
KD[0xF9EE] = '\u71D0';
KD[0xF9EF] = '\u7498';
KD[0xF9F0] = '\u85FA';
KD[0xF9F1] = '\u96A3';
KD[0xF9F2] = '\u9C57';
KD[0xF9F3] = '\u9E9F';
KD[0xF9F4] = '\u6797';
KD[0xF9F5] = '\u6DCB';
KD[0xF9F6] = '\u81E8';
KD[0xF9F7] = '\u7ACB';
KD[0xF9F8] = '\u7B20';
KD[0xF9F9] = '\u7C92';
KD[0xF9FA] = '\u72C0';
KD[0xF9FB] = '\u7099';
KD[0xF9FC] = '\u8B58';
KD[0xF9FD] = '\u4EC0';
KD[0xF9FE] = '\u8336';
KD[0xF9FF] = '\u523A';
KD[0xFA00] = '\u5207';
KD[0xFA01] = '\u5EA6';
KD[0xFA02] = '\u62D3';
KD[0xFA03] = '\u7CD6';
KD[0xFA04] = '\u5B85';
KD[0xFA05] = '\u6D1E';
KD[0xFA06] = '\u66B4';
KD[0xFA07] = '\u8F3B';
KD[0xFA08] = '\u884C';
KD[0xFA09] = '\u964D';
KD[0xFA0A] = '\u898B';
KD[0xFA0B] = '\u5ED3';
KD[0xFA0C] = '\u5140';
KD[0xFA0D] = '\u55C0';
KD[0xFA10] = '\u585A';
KD[0xFA12] = '\u6674';
KD[0xFA15] = '\u51DE';
KD[0xFA16] = '\u732A';
KD[0xFA17] = '\u76CA';
KD[0xFA18] = '\u793C';
KD[0xFA19] = '\u795E';
KD[0xFA1A] = '\u7965';
KD[0xFA1B] = '\u798F';
KD[0xFA1C] = '\u9756';
KD[0xFA1D] = '\u7CBE';
KD[0xFA1E] = '\u7FBD';
KD[0xFA20] = '\u8612';
KD[0xFA22] = '\u8AF8';
KD[0xFA25] = '\u9038';
KD[0xFA26] = '\u90FD';
KD[0xFA2A] = '\u98EF';
KD[0xFA2B] = '\u98FC';
KD[0xFA2C] = '\u9928';
KD[0xFA2D] = '\u9DB4';
KD[0xFB00] = '\u0066\u0066';
KD[0xFB01] = '\u0066\u0069';
KD[0xFB02] = '\u0066\u006C';
KD[0xFB03] = '\u0066\u0066\u0069';
KD[0xFB04] = '\u0066\u0066\u006C';
KD[0xFB05] = '\u0073\u0074';
KD[0xFB06] = '\u0073\u0074';
KD[0xFB13] = '\u0574\u0576';
KD[0xFB14] = '\u0574\u0565';
KD[0xFB15] = '\u0574\u056B';
KD[0xFB16] = '\u057E\u0576';
KD[0xFB17] = '\u0574\u056D';
KD[0xFB1D] = '\u05D9\u05B4';
KD[0xFB1F] = '\u05F2\u05B7';
KD[0xFB20] = '\u05E2';
KD[0xFB21] = '\u05D0';
KD[0xFB22] = '\u05D3';
KD[0xFB23] = '\u05D4';
KD[0xFB24] = '\u05DB';
KD[0xFB25] = '\u05DC';
KD[0xFB26] = '\u05DD';
KD[0xFB27] = '\u05E8';
KD[0xFB28] = '\u05EA';
KD[0xFB29] = '\u002B';
KD[0xFB2A] = '\u05E9\u05C1';
KD[0xFB2B] = '\u05E9\u05C2';
KD[0xFB2C] = '\u05E9\u05BC\u05C1';
KD[0xFB2D] = '\u05E9\u05BC\u05C2';
KD[0xFB2E] = '\u05D0\u05B7';
KD[0xFB2F] = '\u05D0\u05B8';
KD[0xFB30] = '\u05D0\u05BC';
KD[0xFB31] = '\u05D1\u05BC';
KD[0xFB32] = '\u05D2\u05BC';
KD[0xFB33] = '\u05D3\u05BC';
KD[0xFB34] = '\u05D4\u05BC';
KD[0xFB35] = '\u05D5\u05BC';
KD[0xFB36] = '\u05D6\u05BC';
KD[0xFB38] = '\u05D8\u05BC';
KD[0xFB39] = '\u05D9\u05BC';
KD[0xFB3A] = '\u05DA\u05BC';
KD[0xFB3B] = '\u05DB\u05BC';
KD[0xFB3C] = '\u05DC\u05BC';
KD[0xFB3E] = '\u05DE\u05BC';
KD[0xFB40] = '\u05E0\u05BC';
KD[0xFB41] = '\u05E1\u05BC';
KD[0xFB43] = '\u05E3\u05BC';
KD[0xFB44] = '\u05E4\u05BC';
KD[0xFB46] = '\u05E6\u05BC';
KD[0xFB47] = '\u05E7\u05BC';
KD[0xFB48] = '\u05E8\u05BC';
KD[0xFB49] = '\u05E9\u05BC';
KD[0xFB4A] = '\u05EA\u05BC';
KD[0xFB4B] = '\u05D5\u05B9';
KD[0xFB4C] = '\u05D1\u05BF';
KD[0xFB4D] = '\u05DB\u05BF';
KD[0xFB4E] = '\u05E4\u05BF';
KD[0xFB4F] = '\u05D0\u05DC';
KD[0xFB50] = '\u0671';
KD[0xFB51] = '\u0671';
KD[0xFB52] = '\u067B';
KD[0xFB53] = '\u067B';
KD[0xFB54] = '\u067B';
KD[0xFB55] = '\u067B';
KD[0xFB56] = '\u067E';
KD[0xFB57] = '\u067E';
KD[0xFB58] = '\u067E';
KD[0xFB59] = '\u067E';
KD[0xFB5A] = '\u0680';
KD[0xFB5B] = '\u0680';
KD[0xFB5C] = '\u0680';
KD[0xFB5D] = '\u0680';
KD[0xFB5E] = '\u067A';
KD[0xFB5F] = '\u067A';
KD[0xFB60] = '\u067A';
KD[0xFB61] = '\u067A';
KD[0xFB62] = '\u067F';
KD[0xFB63] = '\u067F';
KD[0xFB64] = '\u067F';
KD[0xFB65] = '\u067F';
KD[0xFB66] = '\u0679';
KD[0xFB67] = '\u0679';
KD[0xFB68] = '\u0679';
KD[0xFB69] = '\u0679';
KD[0xFB6A] = '\u06A4';
KD[0xFB6B] = '\u06A4';
KD[0xFB6C] = '\u06A4';
KD[0xFB6D] = '\u06A4';
KD[0xFB6E] = '\u06A6';
KD[0xFB6F] = '\u06A6';
KD[0xFB70] = '\u06A6';
KD[0xFB71] = '\u06A6';
KD[0xFB72] = '\u0684';
KD[0xFB73] = '\u0684';
KD[0xFB74] = '\u0684';
KD[0xFB75] = '\u0684';
KD[0xFB76] = '\u0683';
KD[0xFB77] = '\u0683';
KD[0xFB78] = '\u0683';
KD[0xFB79] = '\u0683';
KD[0xFB7A] = '\u0686';
KD[0xFB7B] = '\u0686';
KD[0xFB7C] = '\u0686';
KD[0xFB7D] = '\u0686';
KD[0xFB7E] = '\u0687';
KD[0xFB7F] = '\u0687';
KD[0xFB80] = '\u0687';
KD[0xFB81] = '\u0687';
KD[0xFB82] = '\u068D';
KD[0xFB83] = '\u068D';
KD[0xFB84] = '\u068C';
KD[0xFB85] = '\u068C';
KD[0xFB86] = '\u068E';
KD[0xFB87] = '\u068E';
KD[0xFB88] = '\u0688';
KD[0xFB89] = '\u0688';
KD[0xFB8A] = '\u0698';
KD[0xFB8B] = '\u0698';
KD[0xFB8C] = '\u0691';
KD[0xFB8D] = '\u0691';
KD[0xFB8E] = '\u06A9';
KD[0xFB8F] = '\u06A9';
KD[0xFB90] = '\u06A9';
KD[0xFB91] = '\u06A9';
KD[0xFB92] = '\u06AF';
KD[0xFB93] = '\u06AF';
KD[0xFB94] = '\u06AF';
KD[0xFB95] = '\u06AF';
KD[0xFB96] = '\u06B3';
KD[0xFB97] = '\u06B3';
KD[0xFB98] = '\u06B3';
KD[0xFB99] = '\u06B3';
KD[0xFB9A] = '\u06B1';
KD[0xFB9B] = '\u06B1';
KD[0xFB9C] = '\u06B1';
KD[0xFB9D] = '\u06B1';
KD[0xFB9E] = '\u06BA';
KD[0xFB9F] = '\u06BA';
KD[0xFBA0] = '\u06BB';
KD[0xFBA1] = '\u06BB';
KD[0xFBA2] = '\u06BB';
KD[0xFBA3] = '\u06BB';
KD[0xFBA4] = '\u06D5\u0654';
KD[0xFBA5] = '\u06D5\u0654';
KD[0xFBA6] = '\u06C1';
KD[0xFBA7] = '\u06C1';
KD[0xFBA8] = '\u06C1';
KD[0xFBA9] = '\u06C1';
KD[0xFBAA] = '\u06BE';
KD[0xFBAB] = '\u06BE';
KD[0xFBAC] = '\u06BE';
KD[0xFBAD] = '\u06BE';
KD[0xFBAE] = '\u06D2';
KD[0xFBAF] = '\u06D2';
KD[0xFBB0] = '\u06D2\u0654';
KD[0xFBB1] = '\u06D2\u0654';
KD[0xFBD3] = '\u06AD';
KD[0xFBD4] = '\u06AD';
KD[0xFBD5] = '\u06AD';
KD[0xFBD6] = '\u06AD';
KD[0xFBD7] = '\u06C7';
KD[0xFBD8] = '\u06C7';
KD[0xFBD9] = '\u06C6';
KD[0xFBDA] = '\u06C6';
KD[0xFBDB] = '\u06C8';
KD[0xFBDC] = '\u06C8';
KD[0xFBDD] = '\u06C7\u0674';
KD[0xFBDE] = '\u06CB';
KD[0xFBDF] = '\u06CB';
KD[0xFBE0] = '\u06C5';
KD[0xFBE1] = '\u06C5';
KD[0xFBE2] = '\u06C9';
KD[0xFBE3] = '\u06C9';
KD[0xFBE4] = '\u06D0';
KD[0xFBE5] = '\u06D0';
KD[0xFBE6] = '\u06D0';
KD[0xFBE7] = '\u06D0';
KD[0xFBE8] = '\u0649';
KD[0xFBE9] = '\u0649';
KD[0xFBEA] = '\u064A\u0654\u0627';
KD[0xFBEB] = '\u064A\u0654\u0627';
KD[0xFBEC] = '\u064A\u0654\u06D5';
KD[0xFBED] = '\u064A\u0654\u06D5';
KD[0xFBEE] = '\u064A\u0654\u0648';
KD[0xFBEF] = '\u064A\u0654\u0648';
KD[0xFBF0] = '\u064A\u0654\u06C7';
KD[0xFBF1] = '\u064A\u0654\u06C7';
KD[0xFBF2] = '\u064A\u0654\u06C6';
KD[0xFBF3] = '\u064A\u0654\u06C6';
KD[0xFBF4] = '\u064A\u0654\u06C8';
KD[0xFBF5] = '\u064A\u0654\u06C8';
KD[0xFBF6] = '\u064A\u0654\u06D0';
KD[0xFBF7] = '\u064A\u0654\u06D0';
KD[0xFBF8] = '\u064A\u0654\u06D0';
KD[0xFBF9] = '\u064A\u0654\u0649';
KD[0xFBFA] = '\u064A\u0654\u0649';
KD[0xFBFB] = '\u064A\u0654\u0649';
KD[0xFBFC] = '\u06CC';
KD[0xFBFD] = '\u06CC';
KD[0xFBFE] = '\u06CC';
KD[0xFBFF] = '\u06CC';
KD[0xFC00] = '\u064A\u0654\u062C';
KD[0xFC01] = '\u064A\u0654\u062D';
KD[0xFC02] = '\u064A\u0654\u0645';
KD[0xFC03] = '\u064A\u0654\u0649';
KD[0xFC04] = '\u064A\u0654\u064A';
KD[0xFC05] = '\u0628\u062C';
KD[0xFC06] = '\u0628\u062D';
KD[0xFC07] = '\u0628\u062E';
KD[0xFC08] = '\u0628\u0645';
KD[0xFC09] = '\u0628\u0649';
KD[0xFC0A] = '\u0628\u064A';
KD[0xFC0B] = '\u062A\u062C';
KD[0xFC0C] = '\u062A\u062D';
KD[0xFC0D] = '\u062A\u062E';
KD[0xFC0E] = '\u062A\u0645';
KD[0xFC0F] = '\u062A\u0649';
KD[0xFC10] = '\u062A\u064A';
KD[0xFC11] = '\u062B\u062C';
KD[0xFC12] = '\u062B\u0645';
KD[0xFC13] = '\u062B\u0649';
KD[0xFC14] = '\u062B\u064A';
KD[0xFC15] = '\u062C\u062D';
KD[0xFC16] = '\u062C\u0645';
KD[0xFC17] = '\u062D\u062C';
KD[0xFC18] = '\u062D\u0645';
KD[0xFC19] = '\u062E\u062C';
KD[0xFC1A] = '\u062E\u062D';
KD[0xFC1B] = '\u062E\u0645';
KD[0xFC1C] = '\u0633\u062C';
KD[0xFC1D] = '\u0633\u062D';
KD[0xFC1E] = '\u0633\u062E';
KD[0xFC1F] = '\u0633\u0645';
KD[0xFC20] = '\u0635\u062D';
KD[0xFC21] = '\u0635\u0645';
KD[0xFC22] = '\u0636\u062C';
KD[0xFC23] = '\u0636\u062D';
KD[0xFC24] = '\u0636\u062E';
KD[0xFC25] = '\u0636\u0645';
KD[0xFC26] = '\u0637\u062D';
KD[0xFC27] = '\u0637\u0645';
KD[0xFC28] = '\u0638\u0645';
KD[0xFC29] = '\u0639\u062C';
KD[0xFC2A] = '\u0639\u0645';
KD[0xFC2B] = '\u063A\u062C';
KD[0xFC2C] = '\u063A\u0645';
KD[0xFC2D] = '\u0641\u062C';
KD[0xFC2E] = '\u0641\u062D';
KD[0xFC2F] = '\u0641\u062E';
KD[0xFC30] = '\u0641\u0645';
KD[0xFC31] = '\u0641\u0649';
KD[0xFC32] = '\u0641\u064A';
KD[0xFC33] = '\u0642\u062D';
KD[0xFC34] = '\u0642\u0645';
KD[0xFC35] = '\u0642\u0649';
KD[0xFC36] = '\u0642\u064A';
KD[0xFC37] = '\u0643\u0627';
KD[0xFC38] = '\u0643\u062C';
KD[0xFC39] = '\u0643\u062D';
KD[0xFC3A] = '\u0643\u062E';
KD[0xFC3B] = '\u0643\u0644';
KD[0xFC3C] = '\u0643\u0645';
KD[0xFC3D] = '\u0643\u0649';
KD[0xFC3E] = '\u0643\u064A';
KD[0xFC3F] = '\u0644\u062C';
KD[0xFC40] = '\u0644\u062D';
KD[0xFC41] = '\u0644\u062E';
KD[0xFC42] = '\u0644\u0645';
KD[0xFC43] = '\u0644\u0649';
KD[0xFC44] = '\u0644\u064A';
KD[0xFC45] = '\u0645\u062C';
KD[0xFC46] = '\u0645\u062D';
KD[0xFC47] = '\u0645\u062E';
KD[0xFC48] = '\u0645\u0645';
KD[0xFC49] = '\u0645\u0649';
KD[0xFC4A] = '\u0645\u064A';
KD[0xFC4B] = '\u0646\u062C';
KD[0xFC4C] = '\u0646\u062D';
KD[0xFC4D] = '\u0646\u062E';
KD[0xFC4E] = '\u0646\u0645';
KD[0xFC4F] = '\u0646\u0649';
KD[0xFC50] = '\u0646\u064A';
KD[0xFC51] = '\u0647\u062C';
KD[0xFC52] = '\u0647\u0645';
KD[0xFC53] = '\u0647\u0649';
KD[0xFC54] = '\u0647\u064A';
KD[0xFC55] = '\u064A\u062C';
KD[0xFC56] = '\u064A\u062D';
KD[0xFC57] = '\u064A\u062E';
KD[0xFC58] = '\u064A\u0645';
KD[0xFC59] = '\u064A\u0649';
KD[0xFC5A] = '\u064A\u064A';
KD[0xFC5B] = '\u0630\u0670';
KD[0xFC5C] = '\u0631\u0670';
KD[0xFC5D] = '\u0649\u0670';
KD[0xFC5E] = '\u0020\u064C\u0651';
KD[0xFC5F] = '\u0020\u064D\u0651';
KD[0xFC60] = '\u0020\u064E\u0651';
KD[0xFC61] = '\u0020\u064F\u0651';
KD[0xFC62] = '\u0020\u0650\u0651';
KD[0xFC63] = '\u0020\u0651\u0670';
KD[0xFC64] = '\u064A\u0654\u0631';
KD[0xFC65] = '\u064A\u0654\u0632';
KD[0xFC66] = '\u064A\u0654\u0645';
KD[0xFC67] = '\u064A\u0654\u0646';
KD[0xFC68] = '\u064A\u0654\u0649';
KD[0xFC69] = '\u064A\u0654\u064A';
KD[0xFC6A] = '\u0628\u0631';
KD[0xFC6B] = '\u0628\u0632';
KD[0xFC6C] = '\u0628\u0645';
KD[0xFC6D] = '\u0628\u0646';
KD[0xFC6E] = '\u0628\u0649';
KD[0xFC6F] = '\u0628\u064A';
KD[0xFC70] = '\u062A\u0631';
KD[0xFC71] = '\u062A\u0632';
KD[0xFC72] = '\u062A\u0645';
KD[0xFC73] = '\u062A\u0646';
KD[0xFC74] = '\u062A\u0649';
KD[0xFC75] = '\u062A\u064A';
KD[0xFC76] = '\u062B\u0631';
KD[0xFC77] = '\u062B\u0632';
KD[0xFC78] = '\u062B\u0645';
KD[0xFC79] = '\u062B\u0646';
KD[0xFC7A] = '\u062B\u0649';
KD[0xFC7B] = '\u062B\u064A';
KD[0xFC7C] = '\u0641\u0649';
KD[0xFC7D] = '\u0641\u064A';
KD[0xFC7E] = '\u0642\u0649';
KD[0xFC7F] = '\u0642\u064A';
KD[0xFC80] = '\u0643\u0627';
KD[0xFC81] = '\u0643\u0644';
KD[0xFC82] = '\u0643\u0645';
KD[0xFC83] = '\u0643\u0649';
KD[0xFC84] = '\u0643\u064A';
KD[0xFC85] = '\u0644\u0645';
KD[0xFC86] = '\u0644\u0649';
KD[0xFC87] = '\u0644\u064A';
KD[0xFC88] = '\u0645\u0627';
KD[0xFC89] = '\u0645\u0645';
KD[0xFC8A] = '\u0646\u0631';
KD[0xFC8B] = '\u0646\u0632';
KD[0xFC8C] = '\u0646\u0645';
KD[0xFC8D] = '\u0646\u0646';
KD[0xFC8E] = '\u0646\u0649';
KD[0xFC8F] = '\u0646\u064A';
KD[0xFC90] = '\u0649\u0670';
KD[0xFC91] = '\u064A\u0631';
KD[0xFC92] = '\u064A\u0632';
KD[0xFC93] = '\u064A\u0645';
KD[0xFC94] = '\u064A\u0646';
KD[0xFC95] = '\u064A\u0649';
KD[0xFC96] = '\u064A\u064A';
KD[0xFC97] = '\u064A\u0654\u062C';
KD[0xFC98] = '\u064A\u0654\u062D';
KD[0xFC99] = '\u064A\u0654\u062E';
KD[0xFC9A] = '\u064A\u0654\u0645';
KD[0xFC9B] = '\u064A\u0654\u0647';
KD[0xFC9C] = '\u0628\u062C';
KD[0xFC9D] = '\u0628\u062D';
KD[0xFC9E] = '\u0628\u062E';
KD[0xFC9F] = '\u0628\u0645';
KD[0xFCA0] = '\u0628\u0647';
KD[0xFCA1] = '\u062A\u062C';
KD[0xFCA2] = '\u062A\u062D';
KD[0xFCA3] = '\u062A\u062E';
KD[0xFCA4] = '\u062A\u0645';
KD[0xFCA5] = '\u062A\u0647';
KD[0xFCA6] = '\u062B\u0645';
KD[0xFCA7] = '\u062C\u062D';
KD[0xFCA8] = '\u062C\u0645';
KD[0xFCA9] = '\u062D\u062C';
KD[0xFCAA] = '\u062D\u0645';
KD[0xFCAB] = '\u062E\u062C';
KD[0xFCAC] = '\u062E\u0645';
KD[0xFCAD] = '\u0633\u062C';
KD[0xFCAE] = '\u0633\u062D';
KD[0xFCAF] = '\u0633\u062E';
KD[0xFCB0] = '\u0633\u0645';
KD[0xFCB1] = '\u0635\u062D';
KD[0xFCB2] = '\u0635\u062E';
KD[0xFCB3] = '\u0635\u0645';
KD[0xFCB4] = '\u0636\u062C';
KD[0xFCB5] = '\u0636\u062D';
KD[0xFCB6] = '\u0636\u062E';
KD[0xFCB7] = '\u0636\u0645';
KD[0xFCB8] = '\u0637\u062D';
KD[0xFCB9] = '\u0638\u0645';
KD[0xFCBA] = '\u0639\u062C';
KD[0xFCBB] = '\u0639\u0645';
KD[0xFCBC] = '\u063A\u062C';
KD[0xFCBD] = '\u063A\u0645';
KD[0xFCBE] = '\u0641\u062C';
KD[0xFCBF] = '\u0641\u062D';
KD[0xFCC0] = '\u0641\u062E';
KD[0xFCC1] = '\u0641\u0645';
KD[0xFCC2] = '\u0642\u062D';
KD[0xFCC3] = '\u0642\u0645';
KD[0xFCC4] = '\u0643\u062C';
KD[0xFCC5] = '\u0643\u062D';
KD[0xFCC6] = '\u0643\u062E';
KD[0xFCC7] = '\u0643\u0644';
KD[0xFCC8] = '\u0643\u0645';
KD[0xFCC9] = '\u0644\u062C';
KD[0xFCCA] = '\u0644\u062D';
KD[0xFCCB] = '\u0644\u062E';
KD[0xFCCC] = '\u0644\u0645';
KD[0xFCCD] = '\u0644\u0647';
KD[0xFCCE] = '\u0645\u062C';
KD[0xFCCF] = '\u0645\u062D';
KD[0xFCD0] = '\u0645\u062E';
KD[0xFCD1] = '\u0645\u0645';
KD[0xFCD2] = '\u0646\u062C';
KD[0xFCD3] = '\u0646\u062D';
KD[0xFCD4] = '\u0646\u062E';
KD[0xFCD5] = '\u0646\u0645';
KD[0xFCD6] = '\u0646\u0647';
KD[0xFCD7] = '\u0647\u062C';
KD[0xFCD8] = '\u0647\u0645';
KD[0xFCD9] = '\u0647\u0670';
KD[0xFCDA] = '\u064A\u062C';
KD[0xFCDB] = '\u064A\u062D';
KD[0xFCDC] = '\u064A\u062E';
KD[0xFCDD] = '\u064A\u0645';
KD[0xFCDE] = '\u064A\u0647';
KD[0xFCDF] = '\u064A\u0654\u0645';
KD[0xFCE0] = '\u064A\u0654\u0647';
KD[0xFCE1] = '\u0628\u0645';
KD[0xFCE2] = '\u0628\u0647';
KD[0xFCE3] = '\u062A\u0645';
KD[0xFCE4] = '\u062A\u0647';
KD[0xFCE5] = '\u062B\u0645';
KD[0xFCE6] = '\u062B\u0647';
KD[0xFCE7] = '\u0633\u0645';
KD[0xFCE8] = '\u0633\u0647';
KD[0xFCE9] = '\u0634\u0645';
KD[0xFCEA] = '\u0634\u0647';
KD[0xFCEB] = '\u0643\u0644';
KD[0xFCEC] = '\u0643\u0645';
KD[0xFCED] = '\u0644\u0645';
KD[0xFCEE] = '\u0646\u0645';
KD[0xFCEF] = '\u0646\u0647';
KD[0xFCF0] = '\u064A\u0645';
KD[0xFCF1] = '\u064A\u0647';
KD[0xFCF2] = '\u0640\u064E\u0651';
KD[0xFCF3] = '\u0640\u064F\u0651';
KD[0xFCF4] = '\u0640\u0650\u0651';
KD[0xFCF5] = '\u0637\u0649';
KD[0xFCF6] = '\u0637\u064A';
KD[0xFCF7] = '\u0639\u0649';
KD[0xFCF8] = '\u0639\u064A';
KD[0xFCF9] = '\u063A\u0649';
KD[0xFCFA] = '\u063A\u064A';
KD[0xFCFB] = '\u0633\u0649';
KD[0xFCFC] = '\u0633\u064A';
KD[0xFCFD] = '\u0634\u0649';
KD[0xFCFE] = '\u0634\u064A';
KD[0xFCFF] = '\u062D\u0649';
KD[0xFD00] = '\u062D\u064A';
KD[0xFD01] = '\u062C\u0649';
KD[0xFD02] = '\u062C\u064A';
KD[0xFD03] = '\u062E\u0649';
KD[0xFD04] = '\u062E\u064A';
KD[0xFD05] = '\u0635\u0649';
KD[0xFD06] = '\u0635\u064A';
KD[0xFD07] = '\u0636\u0649';
KD[0xFD08] = '\u0636\u064A';
KD[0xFD09] = '\u0634\u062C';
KD[0xFD0A] = '\u0634\u062D';
KD[0xFD0B] = '\u0634\u062E';
KD[0xFD0C] = '\u0634\u0645';
KD[0xFD0D] = '\u0634\u0631';
KD[0xFD0E] = '\u0633\u0631';
KD[0xFD0F] = '\u0635\u0631';
KD[0xFD10] = '\u0636\u0631';
KD[0xFD11] = '\u0637\u0649';
KD[0xFD12] = '\u0637\u064A';
KD[0xFD13] = '\u0639\u0649';
KD[0xFD14] = '\u0639\u064A';
KD[0xFD15] = '\u063A\u0649';
KD[0xFD16] = '\u063A\u064A';
KD[0xFD17] = '\u0633\u0649';
KD[0xFD18] = '\u0633\u064A';
KD[0xFD19] = '\u0634\u0649';
KD[0xFD1A] = '\u0634\u064A';
KD[0xFD1B] = '\u062D\u0649';
KD[0xFD1C] = '\u062D\u064A';
KD[0xFD1D] = '\u062C\u0649';
KD[0xFD1E] = '\u062C\u064A';
KD[0xFD1F] = '\u062E\u0649';
KD[0xFD20] = '\u062E\u064A';
KD[0xFD21] = '\u0635\u0649';
KD[0xFD22] = '\u0635\u064A';
KD[0xFD23] = '\u0636\u0649';
KD[0xFD24] = '\u0636\u064A';
KD[0xFD25] = '\u0634\u062C';
KD[0xFD26] = '\u0634\u062D';
KD[0xFD27] = '\u0634\u062E';
KD[0xFD28] = '\u0634\u0645';
KD[0xFD29] = '\u0634\u0631';
KD[0xFD2A] = '\u0633\u0631';
KD[0xFD2B] = '\u0635\u0631';
KD[0xFD2C] = '\u0636\u0631';
KD[0xFD2D] = '\u0634\u062C';
KD[0xFD2E] = '\u0634\u062D';
KD[0xFD2F] = '\u0634\u062E';
KD[0xFD30] = '\u0634\u0645';
KD[0xFD31] = '\u0633\u0647';
KD[0xFD32] = '\u0634\u0647';
KD[0xFD33] = '\u0637\u0645';
KD[0xFD34] = '\u0633\u062C';
KD[0xFD35] = '\u0633\u062D';
KD[0xFD36] = '\u0633\u062E';
KD[0xFD37] = '\u0634\u062C';
KD[0xFD38] = '\u0634\u062D';
KD[0xFD39] = '\u0634\u062E';
KD[0xFD3A] = '\u0637\u0645';
KD[0xFD3B] = '\u0638\u0645';
KD[0xFD3C] = '\u0627\u064B';
KD[0xFD3D] = '\u0627\u064B';
KD[0xFD50] = '\u062A\u062C\u0645';
KD[0xFD51] = '\u062A\u062D\u062C';
KD[0xFD52] = '\u062A\u062D\u062C';
KD[0xFD53] = '\u062A\u062D\u0645';
KD[0xFD54] = '\u062A\u062E\u0645';
KD[0xFD55] = '\u062A\u0645\u062C';
KD[0xFD56] = '\u062A\u0645\u062D';
KD[0xFD57] = '\u062A\u0645\u062E';
KD[0xFD58] = '\u062C\u0645\u062D';
KD[0xFD59] = '\u062C\u0645\u062D';
KD[0xFD5A] = '\u062D\u0645\u064A';
KD[0xFD5B] = '\u062D\u0645\u0649';
KD[0xFD5C] = '\u0633\u062D\u062C';
KD[0xFD5D] = '\u0633\u062C\u062D';
KD[0xFD5E] = '\u0633\u062C\u0649';
KD[0xFD5F] = '\u0633\u0645\u062D';
KD[0xFD60] = '\u0633\u0645\u062D';
KD[0xFD61] = '\u0633\u0645\u062C';
KD[0xFD62] = '\u0633\u0645\u0645';
KD[0xFD63] = '\u0633\u0645\u0645';
KD[0xFD64] = '\u0635\u062D\u062D';
KD[0xFD65] = '\u0635\u062D\u062D';
KD[0xFD66] = '\u0635\u0645\u0645';
KD[0xFD67] = '\u0634\u062D\u0645';
KD[0xFD68] = '\u0634\u062D\u0645';
KD[0xFD69] = '\u0634\u062C\u064A';
KD[0xFD6A] = '\u0634\u0645\u062E';
KD[0xFD6B] = '\u0634\u0645\u062E';
KD[0xFD6C] = '\u0634\u0645\u0645';
KD[0xFD6D] = '\u0634\u0645\u0645';
KD[0xFD6E] = '\u0636\u062D\u0649';
KD[0xFD6F] = '\u0636\u062E\u0645';
KD[0xFD70] = '\u0636\u062E\u0645';
KD[0xFD71] = '\u0637\u0645\u062D';
KD[0xFD72] = '\u0637\u0645\u062D';
KD[0xFD73] = '\u0637\u0645\u0645';
KD[0xFD74] = '\u0637\u0645\u064A';
KD[0xFD75] = '\u0639\u062C\u0645';
KD[0xFD76] = '\u0639\u0645\u0645';
KD[0xFD77] = '\u0639\u0645\u0645';
KD[0xFD78] = '\u0639\u0645\u0649';
KD[0xFD79] = '\u063A\u0645\u0645';
KD[0xFD7A] = '\u063A\u0645\u064A';
KD[0xFD7B] = '\u063A\u0645\u0649';
KD[0xFD7C] = '\u0641\u062E\u0645';
KD[0xFD7D] = '\u0641\u062E\u0645';
KD[0xFD7E] = '\u0642\u0645\u062D';
KD[0xFD7F] = '\u0642\u0645\u0645';
KD[0xFD80] = '\u0644\u062D\u0645';
KD[0xFD81] = '\u0644\u062D\u064A';
KD[0xFD82] = '\u0644\u062D\u0649';
KD[0xFD83] = '\u0644\u062C\u062C';
KD[0xFD84] = '\u0644\u062C\u062C';
KD[0xFD85] = '\u0644\u062E\u0645';
KD[0xFD86] = '\u0644\u062E\u0645';
KD[0xFD87] = '\u0644\u0645\u062D';
KD[0xFD88] = '\u0644\u0645\u062D';
KD[0xFD89] = '\u0645\u062D\u062C';
KD[0xFD8A] = '\u0645\u062D\u0645';
KD[0xFD8B] = '\u0645\u062D\u064A';
KD[0xFD8C] = '\u0645\u062C\u062D';
KD[0xFD8D] = '\u0645\u062C\u0645';
KD[0xFD8E] = '\u0645\u062E\u062C';
KD[0xFD8F] = '\u0645\u062E\u0645';
KD[0xFD92] = '\u0645\u062C\u062E';
KD[0xFD93] = '\u0647\u0645\u062C';
KD[0xFD94] = '\u0647\u0645\u0645';
KD[0xFD95] = '\u0646\u062D\u0645';
KD[0xFD96] = '\u0646\u062D\u0649';
KD[0xFD97] = '\u0646\u062C\u0645';
KD[0xFD98] = '\u0646\u062C\u0645';
KD[0xFD99] = '\u0646\u062C\u0649';
KD[0xFD9A] = '\u0646\u0645\u064A';
KD[0xFD9B] = '\u0646\u0645\u0649';
KD[0xFD9C] = '\u064A\u0645\u0645';
KD[0xFD9D] = '\u064A\u0645\u0645';
KD[0xFD9E] = '\u0628\u062E\u064A';
KD[0xFD9F] = '\u062A\u062C\u064A';
KD[0xFDA0] = '\u062A\u062C\u0649';
KD[0xFDA1] = '\u062A\u062E\u064A';
KD[0xFDA2] = '\u062A\u062E\u0649';
KD[0xFDA3] = '\u062A\u0645\u064A';
KD[0xFDA4] = '\u062A\u0645\u0649';
KD[0xFDA5] = '\u062C\u0645\u064A';
KD[0xFDA6] = '\u062C\u062D\u0649';
KD[0xFDA7] = '\u062C\u0645\u0649';
KD[0xFDA8] = '\u0633\u062E\u0649';
KD[0xFDA9] = '\u0635\u062D\u064A';
KD[0xFDAA] = '\u0634\u062D\u064A';
KD[0xFDAB] = '\u0636\u062D\u064A';
KD[0xFDAC] = '\u0644\u062C\u064A';
KD[0xFDAD] = '\u0644\u0645\u064A';
KD[0xFDAE] = '\u064A\u062D\u064A';
KD[0xFDAF] = '\u064A\u062C\u064A';
KD[0xFDB0] = '\u064A\u0645\u064A';
KD[0xFDB1] = '\u0645\u0645\u064A';
KD[0xFDB2] = '\u0642\u0645\u064A';
KD[0xFDB3] = '\u0646\u062D\u064A';
KD[0xFDB4] = '\u0642\u0645\u062D';
KD[0xFDB5] = '\u0644\u062D\u0645';
KD[0xFDB6] = '\u0639\u0645\u064A';
KD[0xFDB7] = '\u0643\u0645\u064A';
KD[0xFDB8] = '\u0646\u062C\u062D';
KD[0xFDB9] = '\u0645\u062E\u064A';
KD[0xFDBA] = '\u0644\u062C\u0645';
KD[0xFDBB] = '\u0643\u0645\u0645';
KD[0xFDBC] = '\u0644\u062C\u0645';
KD[0xFDBD] = '\u0646\u062C\u062D';
KD[0xFDBE] = '\u062C\u062D\u064A';
KD[0xFDBF] = '\u062D\u062C\u064A';
KD[0xFDC0] = '\u0645\u062C\u064A';
KD[0xFDC1] = '\u0641\u0645\u064A';
KD[0xFDC2] = '\u0628\u062D\u064A';
KD[0xFDC3] = '\u0643\u0645\u0645';
KD[0xFDC4] = '\u0639\u062C\u0645';
KD[0xFDC5] = '\u0635\u0645\u0645';
KD[0xFDC6] = '\u0633\u062E\u064A';
KD[0xFDC7] = '\u0646\u062C\u064A';
KD[0xFDF0] = '\u0635\u0644\u06D2';
KD[0xFDF1] = '\u0642\u0644\u06D2';
KD[0xFDF2] = '\u0627\u0644\u0644\u0647';
KD[0xFDF3] = '\u0627\u0643\u0628\u0631';
KD[0xFDF4] = '\u0645\u062D\u0645\u062F';
KD[0xFDF5] = '\u0635\u0644\u0639\u0645';
KD[0xFDF6] = '\u0631\u0633\u0648\u0644';
KD[0xFDF7] = '\u0639\u0644\u064A\u0647';
KD[0xFDF8] = '\u0648\u0633\u0644\u0645';
KD[0xFDF9] = '\u0635\u0644\u0649';
KD[0xFDFA] = '\u0635\u0644\u0649\u0020\u0627\u0644\u0644\u0647\u0020\u0639\u0644\u064A\u0647\u0020\u0648\u0633\u0644\u0645';
KD[0xFDFB] = '\u062C\u0644\u0020\u062C\u0644\u0627\u0644\u0647';
KD[0xFE30] = '\u002E\u002E';
KD[0xFE31] = '\u2014';
KD[0xFE32] = '\u2013';
KD[0xFE33] = '\u005F';
KD[0xFE34] = '\u005F';
KD[0xFE35] = '\u0028';
KD[0xFE36] = '\u0029';
KD[0xFE37] = '\u007B';
KD[0xFE38] = '\u007D';
KD[0xFE39] = '\u3014';
KD[0xFE3A] = '\u3015';
KD[0xFE3B] = '\u3010';
KD[0xFE3C] = '\u3011';
KD[0xFE3D] = '\u300A';
KD[0xFE3E] = '\u300B';
KD[0xFE3F] = '\u3008';
KD[0xFE40] = '\u3009';
KD[0xFE41] = '\u300C';
KD[0xFE42] = '\u300D';
KD[0xFE43] = '\u300E';
KD[0xFE44] = '\u300F';
KD[0xFE49] = '\u0020\u0305';
KD[0xFE4A] = '\u0020\u0305';
KD[0xFE4B] = '\u0020\u0305';
KD[0xFE4C] = '\u0020\u0305';
KD[0xFE4D] = '\u005F';
KD[0xFE4E] = '\u005F';
KD[0xFE4F] = '\u005F';
KD[0xFE50] = '\u002C';
KD[0xFE51] = '\u3001';
KD[0xFE52] = '\u002E';
KD[0xFE54] = '\u003B';
KD[0xFE55] = '\u003A';
KD[0xFE56] = '\u003F';
KD[0xFE57] = '\u0021';
KD[0xFE58] = '\u2014';
KD[0xFE59] = '\u0028';
KD[0xFE5A] = '\u0029';
KD[0xFE5B] = '\u007B';
KD[0xFE5C] = '\u007D';
KD[0xFE5D] = '\u3014';
KD[0xFE5E] = '\u3015';
KD[0xFE5F] = '\u0023';
KD[0xFE60] = '\u0026';
KD[0xFE61] = '\u002A';
KD[0xFE62] = '\u002B';
KD[0xFE63] = '\u002D';
KD[0xFE64] = '\u003C';
KD[0xFE65] = '\u003E';
KD[0xFE66] = '\u003D';
KD[0xFE68] = '\u005C';
KD[0xFE69] = '\u0024';
KD[0xFE6A] = '\u0025';
KD[0xFE6B] = '\u0040';
KD[0xFE70] = '\u0020\u064B';
KD[0xFE71] = '\u0640\u064B';
KD[0xFE72] = '\u0020\u064C';
KD[0xFE74] = '\u0020\u064D';
KD[0xFE76] = '\u0020\u064E';
KD[0xFE77] = '\u0640\u064E';
KD[0xFE78] = '\u0020\u064F';
KD[0xFE79] = '\u0640\u064F';
KD[0xFE7A] = '\u0020\u0650';
KD[0xFE7B] = '\u0640\u0650';
KD[0xFE7C] = '\u0020\u0651';
KD[0xFE7D] = '\u0640\u0651';
KD[0xFE7E] = '\u0020\u0652';
KD[0xFE7F] = '\u0640\u0652';
KD[0xFE80] = '\u0621';
KD[0xFE81] = '\u0627\u0653';
KD[0xFE82] = '\u0627\u0653';
KD[0xFE83] = '\u0627\u0654';
KD[0xFE84] = '\u0627\u0654';
KD[0xFE85] = '\u0648\u0654';
KD[0xFE86] = '\u0648\u0654';
KD[0xFE87] = '\u0627\u0655';
KD[0xFE88] = '\u0627\u0655';
KD[0xFE89] = '\u064A\u0654';
KD[0xFE8A] = '\u064A\u0654';
KD[0xFE8B] = '\u064A\u0654';
KD[0xFE8C] = '\u064A\u0654';
KD[0xFE8D] = '\u0627';
KD[0xFE8E] = '\u0627';
KD[0xFE8F] = '\u0628';
KD[0xFE90] = '\u0628';
KD[0xFE91] = '\u0628';
KD[0xFE92] = '\u0628';
KD[0xFE93] = '\u0629';
KD[0xFE94] = '\u0629';
KD[0xFE95] = '\u062A';
KD[0xFE96] = '\u062A';
KD[0xFE97] = '\u062A';
KD[0xFE98] = '\u062A';
KD[0xFE99] = '\u062B';
KD[0xFE9A] = '\u062B';
KD[0xFE9B] = '\u062B';
KD[0xFE9C] = '\u062B';
KD[0xFE9D] = '\u062C';
KD[0xFE9E] = '\u062C';
KD[0xFE9F] = '\u062C';
KD[0xFEA0] = '\u062C';
KD[0xFEA1] = '\u062D';
KD[0xFEA2] = '\u062D';
KD[0xFEA3] = '\u062D';
KD[0xFEA4] = '\u062D';
KD[0xFEA5] = '\u062E';
KD[0xFEA6] = '\u062E';
KD[0xFEA7] = '\u062E';
KD[0xFEA8] = '\u062E';
KD[0xFEA9] = '\u062F';
KD[0xFEAA] = '\u062F';
KD[0xFEAB] = '\u0630';
KD[0xFEAC] = '\u0630';
KD[0xFEAD] = '\u0631';
KD[0xFEAE] = '\u0631';
KD[0xFEAF] = '\u0632';
KD[0xFEB0] = '\u0632';
KD[0xFEB1] = '\u0633';
KD[0xFEB2] = '\u0633';
KD[0xFEB3] = '\u0633';
KD[0xFEB4] = '\u0633';
KD[0xFEB5] = '\u0634';
KD[0xFEB6] = '\u0634';
KD[0xFEB7] = '\u0634';
KD[0xFEB8] = '\u0634';
KD[0xFEB9] = '\u0635';
KD[0xFEBA] = '\u0635';
KD[0xFEBB] = '\u0635';
KD[0xFEBC] = '\u0635';
KD[0xFEBD] = '\u0636';
KD[0xFEBE] = '\u0636';
KD[0xFEBF] = '\u0636';
KD[0xFEC0] = '\u0636';
KD[0xFEC1] = '\u0637';
KD[0xFEC2] = '\u0637';
KD[0xFEC3] = '\u0637';
KD[0xFEC4] = '\u0637';
KD[0xFEC5] = '\u0638';
KD[0xFEC6] = '\u0638';
KD[0xFEC7] = '\u0638';
KD[0xFEC8] = '\u0638';
KD[0xFEC9] = '\u0639';
KD[0xFECA] = '\u0639';
KD[0xFECB] = '\u0639';
KD[0xFECC] = '\u0639';
KD[0xFECD] = '\u063A';
KD[0xFECE] = '\u063A';
KD[0xFECF] = '\u063A';
KD[0xFED0] = '\u063A';
KD[0xFED1] = '\u0641';
KD[0xFED2] = '\u0641';
KD[0xFED3] = '\u0641';
KD[0xFED4] = '\u0641';
KD[0xFED5] = '\u0642';
KD[0xFED6] = '\u0642';
KD[0xFED7] = '\u0642';
KD[0xFED8] = '\u0642';
KD[0xFED9] = '\u0643';
KD[0xFEDA] = '\u0643';
KD[0xFEDB] = '\u0643';
KD[0xFEDC] = '\u0643';
KD[0xFEDD] = '\u0644';
KD[0xFEDE] = '\u0644';
KD[0xFEDF] = '\u0644';
KD[0xFEE0] = '\u0644';
KD[0xFEE1] = '\u0645';
KD[0xFEE2] = '\u0645';
KD[0xFEE3] = '\u0645';
KD[0xFEE4] = '\u0645';
KD[0xFEE5] = '\u0646';
KD[0xFEE6] = '\u0646';
KD[0xFEE7] = '\u0646';
KD[0xFEE8] = '\u0646';
KD[0xFEE9] = '\u0647';
KD[0xFEEA] = '\u0647';
KD[0xFEEB] = '\u0647';
KD[0xFEEC] = '\u0647';
KD[0xFEED] = '\u0648';
KD[0xFEEE] = '\u0648';
KD[0xFEEF] = '\u0649';
KD[0xFEF0] = '\u0649';
KD[0xFEF1] = '\u064A';
KD[0xFEF2] = '\u064A';
KD[0xFEF3] = '\u064A';
KD[0xFEF4] = '\u064A';
KD[0xFEF5] = '\u0644\u0627\u0653';
KD[0xFEF6] = '\u0644\u0627\u0653';
KD[0xFEF7] = '\u0644\u0627\u0654';
KD[0xFEF8] = '\u0644\u0627\u0654';
KD[0xFEF9] = '\u0644\u0627\u0655';
KD[0xFEFA] = '\u0644\u0627\u0655';
KD[0xFEFB] = '\u0644\u0627';
KD[0xFEFC] = '\u0644\u0627';
KD[0xFF01] = '\u0021';
KD[0xFF02] = '\u0022';
KD[0xFF03] = '\u0023';
KD[0xFF04] = '\u0024';
KD[0xFF05] = '\u0025';
KD[0xFF06] = '\u0026';
KD[0xFF07] = '\u0027';
KD[0xFF08] = '\u0028';
KD[0xFF09] = '\u0029';
KD[0xFF0A] = '\u002A';
KD[0xFF0B] = '\u002B';
KD[0xFF0C] = '\u002C';
KD[0xFF0D] = '\u002D';
KD[0xFF0E] = '\u002E';
KD[0xFF0F] = '\u002F';
KD[0xFF10] = '\u0030';
KD[0xFF11] = '\u0031';
KD[0xFF12] = '\u0032';
KD[0xFF13] = '\u0033';
KD[0xFF14] = '\u0034';
KD[0xFF15] = '\u0035';
KD[0xFF16] = '\u0036';
KD[0xFF17] = '\u0037';
KD[0xFF18] = '\u0038';
KD[0xFF19] = '\u0039';
KD[0xFF1A] = '\u003A';
KD[0xFF1B] = '\u003B';
KD[0xFF1C] = '\u003C';
KD[0xFF1D] = '\u003D';
KD[0xFF1E] = '\u003E';
KD[0xFF1F] = '\u003F';
KD[0xFF20] = '\u0040';
KD[0xFF21] = '\u0041';
KD[0xFF22] = '\u0042';
KD[0xFF23] = '\u0043';
KD[0xFF24] = '\u0044';
KD[0xFF25] = '\u0045';
KD[0xFF26] = '\u0046';
KD[0xFF27] = '\u0047';
KD[0xFF28] = '\u0048';
KD[0xFF29] = '\u0049';
KD[0xFF2A] = '\u004A';
KD[0xFF2B] = '\u004B';
KD[0xFF2C] = '\u004C';
KD[0xFF2D] = '\u004D';
KD[0xFF2E] = '\u004E';
KD[0xFF2F] = '\u004F';
KD[0xFF30] = '\u0050';
KD[0xFF31] = '\u0051';
KD[0xFF32] = '\u0052';
KD[0xFF33] = '\u0053';
KD[0xFF34] = '\u0054';
KD[0xFF35] = '\u0055';
KD[0xFF36] = '\u0056';
KD[0xFF37] = '\u0057';
KD[0xFF38] = '\u0058';
KD[0xFF39] = '\u0059';
KD[0xFF3A] = '\u005A';
KD[0xFF3B] = '\u005B';
KD[0xFF3C] = '\u005C';
KD[0xFF3D] = '\u005D';
KD[0xFF3E] = '\u005E';
KD[0xFF3F] = '\u005F';
KD[0xFF40] = '\u0060';
KD[0xFF41] = '\u0061';
KD[0xFF42] = '\u0062';
KD[0xFF43] = '\u0063';
KD[0xFF44] = '\u0064';
KD[0xFF45] = '\u0065';
KD[0xFF46] = '\u0066';
KD[0xFF47] = '\u0067';
KD[0xFF48] = '\u0068';
KD[0xFF49] = '\u0069';
KD[0xFF4A] = '\u006A';
KD[0xFF4B] = '\u006B';
KD[0xFF4C] = '\u006C';
KD[0xFF4D] = '\u006D';
KD[0xFF4E] = '\u006E';
KD[0xFF4F] = '\u006F';
KD[0xFF50] = '\u0070';
KD[0xFF51] = '\u0071';
KD[0xFF52] = '\u0072';
KD[0xFF53] = '\u0073';
KD[0xFF54] = '\u0074';
KD[0xFF55] = '\u0075';
KD[0xFF56] = '\u0076';
KD[0xFF57] = '\u0077';
KD[0xFF58] = '\u0078';
KD[0xFF59] = '\u0079';
KD[0xFF5A] = '\u007A';
KD[0xFF5B] = '\u007B';
KD[0xFF5C] = '\u007C';
KD[0xFF5D] = '\u007D';
KD[0xFF5E] = '\u007E';
KD[0xFF61] = '\u3002';
KD[0xFF62] = '\u300C';
KD[0xFF63] = '\u300D';
KD[0xFF64] = '\u3001';
KD[0xFF65] = '\u30FB';
KD[0xFF66] = '\u30F2';
KD[0xFF67] = '\u30A1';
KD[0xFF68] = '\u30A3';
KD[0xFF69] = '\u30A5';
KD[0xFF6A] = '\u30A7';
KD[0xFF6B] = '\u30A9';
KD[0xFF6C] = '\u30E3';
KD[0xFF6D] = '\u30E5';
KD[0xFF6E] = '\u30E7';
KD[0xFF6F] = '\u30C3';
KD[0xFF70] = '\u30FC';
KD[0xFF71] = '\u30A2';
KD[0xFF72] = '\u30A4';
KD[0xFF73] = '\u30A6';
KD[0xFF74] = '\u30A8';
KD[0xFF75] = '\u30AA';
KD[0xFF76] = '\u30AB';
KD[0xFF77] = '\u30AD';
KD[0xFF78] = '\u30AF';
KD[0xFF79] = '\u30B1';
KD[0xFF7A] = '\u30B3';
KD[0xFF7B] = '\u30B5';
KD[0xFF7C] = '\u30B7';
KD[0xFF7D] = '\u30B9';
KD[0xFF7E] = '\u30BB';
KD[0xFF7F] = '\u30BD';
KD[0xFF80] = '\u30BF';
KD[0xFF81] = '\u30C1';
KD[0xFF82] = '\u30C4';
KD[0xFF83] = '\u30C6';
KD[0xFF84] = '\u30C8';
KD[0xFF85] = '\u30CA';
KD[0xFF86] = '\u30CB';
KD[0xFF87] = '\u30CC';
KD[0xFF88] = '\u30CD';
KD[0xFF89] = '\u30CE';
KD[0xFF8A] = '\u30CF';
KD[0xFF8B] = '\u30D2';
KD[0xFF8C] = '\u30D5';
KD[0xFF8D] = '\u30D8';
KD[0xFF8E] = '\u30DB';
KD[0xFF8F] = '\u30DE';
KD[0xFF90] = '\u30DF';
KD[0xFF91] = '\u30E0';
KD[0xFF92] = '\u30E1';
KD[0xFF93] = '\u30E2';
KD[0xFF94] = '\u30E4';
KD[0xFF95] = '\u30E6';
KD[0xFF96] = '\u30E8';
KD[0xFF97] = '\u30E9';
KD[0xFF98] = '\u30EA';
KD[0xFF99] = '\u30EB';
KD[0xFF9A] = '\u30EC';
KD[0xFF9B] = '\u30ED';
KD[0xFF9C] = '\u30EF';
KD[0xFF9D] = '\u30F3';
KD[0xFF9E] = '\u3099';
KD[0xFF9F] = '\u309A';
KD[0xFFA0] = '\u1160';
KD[0xFFA1] = '\u1100';
KD[0xFFA2] = '\u1101';
KD[0xFFA3] = '\u11AA';
KD[0xFFA4] = '\u1102';
KD[0xFFA5] = '\u11AC';
KD[0xFFA6] = '\u11AD';
KD[0xFFA7] = '\u1103';
KD[0xFFA8] = '\u1104';
KD[0xFFA9] = '\u1105';
KD[0xFFAA] = '\u11B0';
KD[0xFFAB] = '\u11B1';
KD[0xFFAC] = '\u11B2';
KD[0xFFAD] = '\u11B3';
KD[0xFFAE] = '\u11B4';
KD[0xFFAF] = '\u11B5';
KD[0xFFB0] = '\u111A';
KD[0xFFB1] = '\u1106';
KD[0xFFB2] = '\u1107';
KD[0xFFB3] = '\u1108';
KD[0xFFB4] = '\u1121';
KD[0xFFB5] = '\u1109';
KD[0xFFB6] = '\u110A';
KD[0xFFB7] = '\u110B';
KD[0xFFB8] = '\u110C';
KD[0xFFB9] = '\u110D';
KD[0xFFBA] = '\u110E';
KD[0xFFBB] = '\u110F';
KD[0xFFBC] = '\u1110';
KD[0xFFBD] = '\u1111';
KD[0xFFBE] = '\u1112';
KD[0xFFC2] = '\u1161';
KD[0xFFC3] = '\u1162';
KD[0xFFC4] = '\u1163';
KD[0xFFC5] = '\u1164';
KD[0xFFC6] = '\u1165';
KD[0xFFC7] = '\u1166';
KD[0xFFCA] = '\u1167';
KD[0xFFCB] = '\u1168';
KD[0xFFCC] = '\u1169';
KD[0xFFCD] = '\u116A';
KD[0xFFCE] = '\u116B';
KD[0xFFCF] = '\u116C';
KD[0xFFD2] = '\u116D';
KD[0xFFD3] = '\u116E';
KD[0xFFD4] = '\u116F';
KD[0xFFD5] = '\u1170';
KD[0xFFD6] = '\u1171';
KD[0xFFD7] = '\u1172';
KD[0xFFDA] = '\u1173';
KD[0xFFDB] = '\u1174';
KD[0xFFDC] = '\u1175';
KD[0xFFE0] = '\u00A2';
KD[0xFFE1] = '\u00A3';
KD[0xFFE2] = '\u00AC';
KD[0xFFE3] = '\u0020\u0304';
KD[0xFFE4] = '\u00A6';
KD[0xFFE5] = '\u00A5';
KD[0xFFE6] = '\u20A9';
KD[0xFFE8] = '\u2502';
KD[0xFFE9] = '\u2190';
KD[0xFFEA] = '\u2191';
KD[0xFFEB] = '\u2192';
KD[0xFFEC] = '\u2193';
KD[0xFFED] = '\u25A0';
KD[0xFFEE] = '\u25CB';
// 3483 decomposition mappings total

var CC = new Object();
CC[0x0300] = 230;
CC[0x0301] = 230;
CC[0x0302] = 230;
CC[0x0303] = 230;
CC[0x0304] = 230;
CC[0x0305] = 230;
CC[0x0306] = 230;
CC[0x0307] = 230;
CC[0x0308] = 230;
CC[0x0309] = 230;
CC[0x030A] = 230;
CC[0x030B] = 230;
CC[0x030C] = 230;
CC[0x030D] = 230;
CC[0x030E] = 230;
CC[0x030F] = 230;
CC[0x0310] = 230;
CC[0x0311] = 230;
CC[0x0312] = 230;
CC[0x0313] = 230;
CC[0x0314] = 230;
CC[0x0315] = 232;
CC[0x0316] = 220;
CC[0x0317] = 220;
CC[0x0318] = 220;
CC[0x0319] = 220;
CC[0x031A] = 232;
CC[0x031B] = 216;
CC[0x031C] = 220;
CC[0x031D] = 220;
CC[0x031E] = 220;
CC[0x031F] = 220;
CC[0x0320] = 220;
CC[0x0321] = 202;
CC[0x0322] = 202;
CC[0x0323] = 220;
CC[0x0324] = 220;
CC[0x0325] = 220;
CC[0x0326] = 220;
CC[0x0327] = 202;
CC[0x0328] = 202;
CC[0x0329] = 220;
CC[0x032A] = 220;
CC[0x032B] = 220;
CC[0x032C] = 220;
CC[0x032D] = 220;
CC[0x032E] = 220;
CC[0x032F] = 220;
CC[0x0330] = 220;
CC[0x0331] = 220;
CC[0x0332] = 220;
CC[0x0333] = 220;
CC[0x0334] = 1;
CC[0x0335] = 1;
CC[0x0336] = 1;
CC[0x0337] = 1;
CC[0x0338] = 1;
CC[0x0339] = 220;
CC[0x033A] = 220;
CC[0x033B] = 220;
CC[0x033C] = 220;
CC[0x033D] = 230;
CC[0x033E] = 230;
CC[0x033F] = 230;
CC[0x0340] = 230;
CC[0x0341] = 230;
CC[0x0342] = 230;
CC[0x0343] = 230;
CC[0x0344] = 230;
CC[0x0345] = 240;
CC[0x0346] = 230;
CC[0x0347] = 220;
CC[0x0348] = 220;
CC[0x0349] = 220;
CC[0x034A] = 230;
CC[0x034B] = 230;
CC[0x034C] = 230;
CC[0x034D] = 220;
CC[0x034E] = 220;
CC[0x0360] = 234;
CC[0x0361] = 234;
CC[0x0362] = 233;
CC[0x0483] = 230;
CC[0x0484] = 230;
CC[0x0485] = 230;
CC[0x0486] = 230;
CC[0x0591] = 220;
CC[0x0592] = 230;
CC[0x0593] = 230;
CC[0x0594] = 230;
CC[0x0595] = 230;
CC[0x0596] = 220;
CC[0x0597] = 230;
CC[0x0598] = 230;
CC[0x0599] = 230;
CC[0x059A] = 222;
CC[0x059B] = 220;
CC[0x059C] = 230;
CC[0x059D] = 230;
CC[0x059E] = 230;
CC[0x059F] = 230;
CC[0x05A0] = 230;
CC[0x05A1] = 230;
CC[0x05A3] = 220;
CC[0x05A4] = 220;
CC[0x05A5] = 220;
CC[0x05A6] = 220;
CC[0x05A7] = 220;
CC[0x05A8] = 230;
CC[0x05A9] = 230;
CC[0x05AA] = 220;
CC[0x05AB] = 230;
CC[0x05AC] = 230;
CC[0x05AD] = 222;
CC[0x05AE] = 228;
CC[0x05AF] = 230;
CC[0x05B0] = 10;
CC[0x05B1] = 11;
CC[0x05B2] = 12;
CC[0x05B3] = 13;
CC[0x05B4] = 14;
CC[0x05B5] = 15;
CC[0x05B6] = 16;
CC[0x05B7] = 17;
CC[0x05B8] = 18;
CC[0x05B9] = 19;
CC[0x05BB] = 20;
CC[0x05BC] = 21;
CC[0x05BD] = 22;
CC[0x05BF] = 23;
CC[0x05C1] = 24;
CC[0x05C2] = 25;
CC[0x05C4] = 230;
CC[0x064B] = 27;
CC[0x064C] = 28;
CC[0x064D] = 29;
CC[0x064E] = 30;
CC[0x064F] = 31;
CC[0x0650] = 32;
CC[0x0651] = 33;
CC[0x0652] = 34;
CC[0x0653] = 230;
CC[0x0654] = 230;
CC[0x0655] = 220;
CC[0x0670] = 35;
CC[0x06D6] = 230;
CC[0x06D7] = 230;
CC[0x06D8] = 230;
CC[0x06D9] = 230;
CC[0x06DA] = 230;
CC[0x06DB] = 230;
CC[0x06DC] = 230;
CC[0x06DF] = 230;
CC[0x06E0] = 230;
CC[0x06E1] = 230;
CC[0x06E2] = 230;
CC[0x06E3] = 220;
CC[0x06E4] = 230;
CC[0x06E7] = 230;
CC[0x06E8] = 230;
CC[0x06EA] = 220;
CC[0x06EB] = 230;
CC[0x06EC] = 230;
CC[0x06ED] = 220;
CC[0x0711] = 36;
CC[0x0730] = 230;
CC[0x0731] = 220;
CC[0x0732] = 230;
CC[0x0733] = 230;
CC[0x0734] = 220;
CC[0x0735] = 230;
CC[0x0736] = 230;
CC[0x0737] = 220;
CC[0x0738] = 220;
CC[0x0739] = 220;
CC[0x073A] = 230;
CC[0x073B] = 220;
CC[0x073C] = 220;
CC[0x073D] = 230;
CC[0x073E] = 220;
CC[0x073F] = 230;
CC[0x0740] = 230;
CC[0x0741] = 230;
CC[0x0742] = 220;
CC[0x0743] = 230;
CC[0x0744] = 220;
CC[0x0745] = 230;
CC[0x0746] = 220;
CC[0x0747] = 230;
CC[0x0748] = 220;
CC[0x0749] = 230;
CC[0x074A] = 230;
CC[0x093C] = 7;
CC[0x094D] = 9;
CC[0x0951] = 230;
CC[0x0952] = 220;
CC[0x0953] = 230;
CC[0x0954] = 230;
CC[0x09BC] = 7;
CC[0x09CD] = 9;
CC[0x0A3C] = 7;
CC[0x0A4D] = 9;
CC[0x0ABC] = 7;
CC[0x0ACD] = 9;
CC[0x0B3C] = 7;
CC[0x0B4D] = 9;
CC[0x0BCD] = 9;
CC[0x0C4D] = 9;
CC[0x0C55] = 84;
CC[0x0C56] = 91;
CC[0x0CCD] = 9;
CC[0x0D4D] = 9;
CC[0x0DCA] = 9;
CC[0x0E38] = 103;
CC[0x0E39] = 103;
CC[0x0E3A] = 9;
CC[0x0E48] = 107;
CC[0x0E49] = 107;
CC[0x0E4A] = 107;
CC[0x0E4B] = 107;
CC[0x0EB8] = 118;
CC[0x0EB9] = 118;
CC[0x0EC8] = 122;
CC[0x0EC9] = 122;
CC[0x0ECA] = 122;
CC[0x0ECB] = 122;
CC[0x0F18] = 220;
CC[0x0F19] = 220;
CC[0x0F35] = 220;
CC[0x0F37] = 220;
CC[0x0F39] = 216;
CC[0x0F71] = 129;
CC[0x0F72] = 130;
CC[0x0F74] = 132;
CC[0x0F7A] = 130;
CC[0x0F7B] = 130;
CC[0x0F7C] = 130;
CC[0x0F7D] = 130;
CC[0x0F80] = 130;
CC[0x0F82] = 230;
CC[0x0F83] = 230;
CC[0x0F84] = 9;
CC[0x0F86] = 230;
CC[0x0F87] = 230;
CC[0x0FC6] = 220;
CC[0x1037] = 7;
CC[0x1039] = 9;
CC[0x17D2] = 9;
CC[0x18A9] = 228;
CC[0x20D0] = 230;
CC[0x20D1] = 230;
CC[0x20D2] = 1;
CC[0x20D3] = 1;
CC[0x20D4] = 230;
CC[0x20D5] = 230;
CC[0x20D6] = 230;
CC[0x20D7] = 230;
CC[0x20D8] = 1;
CC[0x20D9] = 1;
CC[0x20DA] = 1;
CC[0x20DB] = 230;
CC[0x20DC] = 230;
CC[0x20E1] = 230;
CC[0x302A] = 218;
CC[0x302B] = 228;
CC[0x302C] = 232;
CC[0x302D] = 222;
CC[0x302E] = 224;
CC[0x302F] = 224;
CC[0x3099] = 8;
CC[0x309A] = 8;
CC[0xFB1E] = 26;
CC[0xFE20] = 230;
CC[0xFE21] = 230;
CC[0xFE22] = 230;
CC[0xFE23] = 230;
// 276 canonical classes mappings total

var KC = new Object();
// NOTE: Hangul is done in code!
KC[0x21D40338] = 0x21CE;
KC[0x21D20338] = 0x21CF;
KC[0x21D00338] = 0x21CD;
KC[0x21940338] = 0x21AE;
KC[0x21920338] = 0x219B;
KC[0x21900338] = 0x219A;
KC[0x22A20338] = 0x22AC;
KC[0x22A90338] = 0x22AE;
KC[0x22A80338] = 0x22AD;
KC[0x22AB0338] = 0x22AF;
KC[0x22B50338] = 0x22ED;
KC[0x22B40338] = 0x22EC;
KC[0x22B30338] = 0x22EB;
KC[0x22B20338] = 0x22EA;
KC[0x22870338] = 0x2289;
KC[0x22860338] = 0x2288;
KC[0x22830338] = 0x2285;
KC[0x22820338] = 0x2284;
KC[0x22910338] = 0x22E2;
KC[0x22920338] = 0x22E3;
KC[0x22650338] = 0x2271;
KC[0x22640338] = 0x2270;
KC[0x22610338] = 0x2262;
KC[0x22770338] = 0x2279;
KC[0x22760338] = 0x2278;
KC[0x22730338] = 0x2275;
KC[0x22720338] = 0x2274;
KC[0x227D0338] = 0x22E1;
KC[0x227C0338] = 0x22E0;
KC[0x227B0338] = 0x2281;
KC[0x227A0338] = 0x2280;
KC[0x22450338] = 0x2247;
KC[0x22430338] = 0x2244;
KC[0x224D0338] = 0x226D;
KC[0x22480338] = 0x2249;
KC[0x22250338] = 0x2226;
KC[0x22230338] = 0x2224;
KC[0x223C0338] = 0x2241;
KC[0x22030338] = 0x2204;
KC[0x22080338] = 0x2209;
KC[0x220B0338] = 0x220C;
KC[0x1ECD0302] = 0x1ED9;
KC[0x1ECC0302] = 0x1ED8;
KC[0x1EA10302] = 0x1EAD;
KC[0x1EA00302] = 0x1EAC;
KC[0x1EA10306] = 0x1EB7;
KC[0x1EA00306] = 0x1EB6;
KC[0x1EB90302] = 0x1EC7;
KC[0x1EB80302] = 0x1EC6;
KC[0x1E620307] = 0x1E68;
KC[0x1E630307] = 0x1E69;
KC[0x1E5B0304] = 0x1E5D;
KC[0x1E5A0304] = 0x1E5C;
KC[0x1E370304] = 0x1E39;
KC[0x1E360304] = 0x1E38;
KC[0x1FB60345] = 0x1FB7;
KC[0x1FBF0342] = 0x1FCF;
KC[0x1FFE0300] = 0x1FDD;
KC[0x1FFE0301] = 0x1FDE;
KC[0x1FF60345] = 0x1FF7;
KC[0x1FFE0342] = 0x1FDF;
KC[0x1FBF0301] = 0x1FCE;
KC[0x1FBF0300] = 0x1FCD;
KC[0x1FC60345] = 0x1FC7;
KC[0x1F250345] = 0x1F95;
KC[0x1F600300] = 0x1F62;
KC[0x1F610301] = 0x1F65;
KC[0x1F240345] = 0x1F94;
KC[0x1F610300] = 0x1F63;
KC[0x1F600301] = 0x1F64;
KC[0x1F270345] = 0x1F97;
KC[0x1F200342] = 0x1F26;
KC[0x1F260345] = 0x1F96;
KC[0x1F210342] = 0x1F27;
KC[0x1F210345] = 0x1F91;
KC[0x1F200345] = 0x1F90;
KC[0x1F230345] = 0x1F93;
KC[0x1F220345] = 0x1F92;
KC[0x1F2D0345] = 0x1F9D;
KC[0x1F680300] = 0x1F6A;
KC[0x1F690301] = 0x1F6D;
KC[0x1F2C0345] = 0x1F9C;
KC[0x1F690300] = 0x1F6B;
KC[0x1F680301] = 0x1F6C;
KC[0x1F2F0345] = 0x1F9F;
KC[0x1F280342] = 0x1F2E;
KC[0x1F2E0345] = 0x1F9E;
KC[0x1F290342] = 0x1F2F;
KC[0x1F290345] = 0x1F99;
KC[0x1F280345] = 0x1F98;
KC[0x1F2B0345] = 0x1F9B;
KC[0x1F2A0345] = 0x1F9A;
KC[0x1F300342] = 0x1F36;
KC[0x1F310342] = 0x1F37;
KC[0x1F380342] = 0x1F3E;
KC[0x1F390342] = 0x1F3F;
KC[0x1F400300] = 0x1F42;
KC[0x1F410301] = 0x1F45;
KC[0x1F050345] = 0x1F85;
KC[0x1F410300] = 0x1F43;
KC[0x1F400301] = 0x1F44;
KC[0x1F040345] = 0x1F84;
KC[0x1F070345] = 0x1F87;
KC[0x1F000342] = 0x1F06;
KC[0x1F060345] = 0x1F86;
KC[0x1F010342] = 0x1F07;
KC[0x1F010345] = 0x1F81;
KC[0x1F000345] = 0x1F80;
KC[0x1F030345] = 0x1F83;
KC[0x1F020345] = 0x1F82;
KC[0x1F0D0345] = 0x1F8D;
KC[0x1F480300] = 0x1F4A;
KC[0x1F490301] = 0x1F4D;
KC[0x1F0C0345] = 0x1F8C;
KC[0x1F490300] = 0x1F4B;
KC[0x1F480301] = 0x1F4C;
KC[0x1F0F0345] = 0x1F8F;
KC[0x1F080342] = 0x1F0E;
KC[0x1F0E0345] = 0x1F8E;
KC[0x1F090342] = 0x1F0F;
KC[0x1F090345] = 0x1F89;
KC[0x1F080345] = 0x1F88;
KC[0x1F0B0345] = 0x1F8B;
KC[0x1F0A0345] = 0x1F8A;
KC[0x1F500300] = 0x1F52;
KC[0x1F510301] = 0x1F55;
KC[0x1F510300] = 0x1F53;
KC[0x1F500301] = 0x1F54;
KC[0x1F590301] = 0x1F5D;
KC[0x1F590300] = 0x1F5B;
KC[0x1F650345] = 0x1FA5;
KC[0x1F200300] = 0x1F22;
KC[0x1F210301] = 0x1F25;
KC[0x1F640345] = 0x1FA4;
KC[0x1F210300] = 0x1F23;
KC[0x1F200301] = 0x1F24;
KC[0x1F670345] = 0x1FA7;
KC[0x1F600342] = 0x1F66;
KC[0x1F660345] = 0x1FA6;
KC[0x1F610342] = 0x1F67;
KC[0x1F610345] = 0x1FA1;
KC[0x1F600345] = 0x1FA0;
KC[0x1F630345] = 0x1FA3;
KC[0x1F620345] = 0x1FA2;
KC[0x1F6D0345] = 0x1FAD;
KC[0x1F280300] = 0x1F2A;
KC[0x1F290301] = 0x1F2D;
KC[0x1F6C0345] = 0x1FAC;
KC[0x1F290300] = 0x1F2B;
KC[0x1F280301] = 0x1F2C;
KC[0x1F6F0345] = 0x1FAF;
KC[0x1F680342] = 0x1F6E;
KC[0x1F6E0345] = 0x1FAE;
KC[0x1F690342] = 0x1F6F;
KC[0x1F690345] = 0x1FA9;
KC[0x1F680345] = 0x1FA8;
KC[0x1F6B0345] = 0x1FAB;
KC[0x1F6A0345] = 0x1FAA;
KC[0x1F300300] = 0x1F32;
KC[0x1F310301] = 0x1F35;
KC[0x1F740345] = 0x1FC2;
KC[0x1F310300] = 0x1F33;
KC[0x1F300301] = 0x1F34;
KC[0x1F700345] = 0x1FB2;
KC[0x1F380300] = 0x1F3A;
KC[0x1F390301] = 0x1F3D;
KC[0x1F7C0345] = 0x1FF2;
KC[0x1F390300] = 0x1F3B;
KC[0x1F380301] = 0x1F3C;
KC[0x1F000300] = 0x1F02;
KC[0x1F010301] = 0x1F05;
KC[0x1F010300] = 0x1F03;
KC[0x1F000301] = 0x1F04;
KC[0x1F080300] = 0x1F0A;
KC[0x1F090301] = 0x1F0D;
KC[0x1F090300] = 0x1F0B;
KC[0x1F080301] = 0x1F0C;
KC[0x1F100300] = 0x1F12;
KC[0x1F110301] = 0x1F15;
KC[0x1F110300] = 0x1F13;
KC[0x1F100301] = 0x1F14;
KC[0x1F500342] = 0x1F56;
KC[0x1F510342] = 0x1F57;
KC[0x1F180300] = 0x1F1A;
KC[0x1F190301] = 0x1F1D;
KC[0x1F190300] = 0x1F1B;
KC[0x1F180301] = 0x1F1C;
KC[0x1F590342] = 0x1F5F;
KC[0x04E90308] = 0x04EB;
KC[0x04E80308] = 0x04EA;
KC[0x04D90308] = 0x04DB;
KC[0x04D80308] = 0x04DA;
KC[0x0474030F] = 0x0476;
KC[0x0475030F] = 0x0477;
KC[0x04560308] = 0x0457;
KC[0x04430308] = 0x04F1;
KC[0x0443030B] = 0x04F3;
KC[0x04470308] = 0x04F5;
KC[0x044B0308] = 0x04F9;
KC[0x04430304] = 0x04EF;
KC[0x044D0308] = 0x04ED;
KC[0x04430306] = 0x045E;
KC[0x043A0301] = 0x045C;
KC[0x04300308] = 0x04D3;
KC[0x04380300] = 0x045D;
KC[0x04370308] = 0x04DF;
KC[0x04360308] = 0x04DD;
KC[0x04380306] = 0x0439;
KC[0x04350308] = 0x0451;
KC[0x04380304] = 0x04E3;
KC[0x04350306] = 0x04D7;
KC[0x04330301] = 0x0453;
KC[0x04380308] = 0x04E5;
KC[0x04360306] = 0x04C2;
KC[0x043E0308] = 0x04E7;
KC[0x04300306] = 0x04D1;
KC[0x04350300] = 0x0450;
KC[0x04230308] = 0x04F0;
KC[0x0423030B] = 0x04F2;
KC[0x04270308] = 0x04F4;
KC[0x042B0308] = 0x04F8;
KC[0x04230304] = 0x04EE;
KC[0x042D0308] = 0x04EC;
KC[0x04230306] = 0x040E;
KC[0x041A0301] = 0x040C;
KC[0x04100308] = 0x04D2;
KC[0x04180300] = 0x040D;
KC[0x04170308] = 0x04DE;
KC[0x04160308] = 0x04DC;
KC[0x04180306] = 0x0419;
KC[0x04150308] = 0x0401;
KC[0x04180304] = 0x04E2;
KC[0x04150306] = 0x04D6;
KC[0x04130301] = 0x0403;
KC[0x04180308] = 0x04E4;
KC[0x04160306] = 0x04C1;
KC[0x041E0308] = 0x04E6;
KC[0x04100306] = 0x04D0;
KC[0x04150300] = 0x0400;
KC[0x04060308] = 0x0407;
KC[0x00FC0301] = 0x01D8;
KC[0x00F50308] = 0x1E4F;
KC[0x00F40309] = 0x1ED5;
KC[0x00FC0300] = 0x01DC;
KC[0x00F80301] = 0x01FF;
KC[0x00FC0304] = 0x01D6;
KC[0x00F40303] = 0x1ED7;
KC[0x00F40301] = 0x1ED1;
KC[0x00F50301] = 0x1E4D;
KC[0x00F40300] = 0x1ED3;
KC[0x00F60304] = 0x022B;
KC[0x00F50304] = 0x022D;
KC[0x00FC030C] = 0x01DA;
KC[0x00EF0301] = 0x1E2F;
KC[0x00E20309] = 0x1EA9;
KC[0x00EA0301] = 0x1EBF;
KC[0x00A80342] = 0x1FC1;
KC[0x00EA0300] = 0x1EC1;
KC[0x00EA0303] = 0x1EC5;
KC[0x00E60301] = 0x01FD;
KC[0x00E70301] = 0x1E09;
KC[0x00E50301] = 0x01FB;
KC[0x00E20301] = 0x1EA5;
KC[0x00EA0309] = 0x1EC3;
KC[0x00E60304] = 0x01E3;
KC[0x00E20300] = 0x1EA7;
KC[0x00E20303] = 0x1EAB;
KC[0x00E40304] = 0x01DF;
KC[0x00DC0301] = 0x01D7;
KC[0x00D50308] = 0x1E4E;
KC[0x00D40309] = 0x1ED4;
KC[0x00DC0300] = 0x01DB;
KC[0x00D80301] = 0x01FE;
KC[0x00DC0304] = 0x01D5;
KC[0x00D40303] = 0x1ED6;
KC[0x00D40301] = 0x1ED0;
KC[0x00D50301] = 0x1E4C;
KC[0x00D40300] = 0x1ED2;
KC[0x00D60304] = 0x022A;
KC[0x00D50304] = 0x022C;
KC[0x00DC030C] = 0x01D9;
KC[0x00CF0301] = 0x1E2E;
KC[0x00C20309] = 0x1EA8;
KC[0x00CA0301] = 0x1EBE;
KC[0x00CA0300] = 0x1EC0;
KC[0x00CA0303] = 0x1EC4;
KC[0x00C60301] = 0x01FC;
KC[0x00C70301] = 0x1E08;
KC[0x00C50301] = 0x01FA;
KC[0x00C20301] = 0x1EA4;
KC[0x00CA0309] = 0x1EC2;
KC[0x00C60304] = 0x01E2;
KC[0x00C20300] = 0x1EA6;
KC[0x00C20303] = 0x1EAA;
KC[0x00C40304] = 0x01DE;
KC[0x00A80301] = 0x0385;
KC[0x00A80300] = 0x1FED;
KC[0x0073030C] = 0x0161;
KC[0x0075030A] = 0x016F;
KC[0x004E0331] = 0x1E48;
KC[0x00770308] = 0x1E85;
KC[0x00780307] = 0x1E8B;
KC[0x006F0311] = 0x020F;
KC[0x0072030C] = 0x0159;
KC[0x0075030B] = 0x0171;
KC[0x00790307] = 0x1E8F;
KC[0x00790304] = 0x0233;
KC[0x0072030F] = 0x0211;
KC[0x00750308] = 0x00FC;
KC[0x00550328] = 0x0172;
KC[0x007A0307] = 0x017C;
KC[0x004C0331] = 0x1E3A;
KC[0x0077030A] = 0x1E98;
KC[0x00740308] = 0x1E97;
KC[0x00750309] = 0x1EE7;
KC[0x00790302] = 0x0177;
KC[0x007A0301] = 0x017A;
KC[0x0075030F] = 0x0215;
KC[0x004B0331] = 0x1E34;
KC[0x00590323] = 0x1EF4;
KC[0x00790303] = 0x1EF9;
KC[0x0075030C] = 0x01D4;
KC[0x00490330] = 0x1E2C;
KC[0x0054032D] = 0x1E70;
KC[0x005A0323] = 0x1E92;
KC[0x00790300] = 0x1EF3;
KC[0x00690311] = 0x020B;
KC[0x00790301] = 0x00FD;
KC[0x0074030C] = 0x0165;
KC[0x0055032D] = 0x1E76;
KC[0x007A0302] = 0x1E91;
KC[0x00750302] = 0x00FB;
KC[0x00700307] = 0x1E57;
KC[0x00540323] = 0x1E6C;
KC[0x00770300] = 0x1E81;
KC[0x00750303] = 0x0169;
KC[0x007A030C] = 0x017E;
KC[0x00770301] = 0x1E83;
KC[0x00550323] = 0x1EE4;
KC[0x00530326] = 0x0218;
KC[0x00750300] = 0x00F9;
KC[0x00520327] = 0x0156;
KC[0x00770302] = 0x0175;
KC[0x00440331] = 0x1E0E;
KC[0x00450330] = 0x1E1A;
KC[0x00720307] = 0x1E59;
KC[0x00760303] = 0x1E7D;
KC[0x00560323] = 0x1E7E;
KC[0x00650311] = 0x0207;
KC[0x00750301] = 0x00FA;
KC[0x00530327] = 0x015E;
KC[0x006F031B] = 0x01A1;
KC[0x00730307] = 0x1E61;
KC[0x00570323] = 0x1E88;
KC[0x00720301] = 0x0155;
KC[0x00540327] = 0x0162;
KC[0x00750306] = 0x016D;
KC[0x00420331] = 0x1E06;
KC[0x00740307] = 0x1E6B;
KC[0x0079030A] = 0x1E99;
KC[0x00540326] = 0x021A;
KC[0x00730301] = 0x015B;
KC[0x00790308] = 0x00FF;
KC[0x00730302] = 0x015D;
KC[0x00750304] = 0x016B;
KC[0x00700301] = 0x1E55;
KC[0x00520323] = 0x1E5A;
KC[0x00550324] = 0x1E72;
KC[0x00610311] = 0x0203;
KC[0x00530323] = 0x1E62;
KC[0x00770307] = 0x1E87;
KC[0x00780308] = 0x1E8D;
KC[0x00790309] = 0x1EF7;
KC[0x0063030C] = 0x010D;
KC[0x006F0300] = 0x00F2;
KC[0x00690306] = 0x012D;
KC[0x006E0301] = 0x0144;
KC[0x00680307] = 0x1E23;
KC[0x00480327] = 0x1E28;
KC[0x004C0323] = 0x1E36;
KC[0x0061030F] = 0x0201;
KC[0x006E0300] = 0x01F9;
KC[0x006F0301] = 0x00F3;
KC[0x0075031B] = 0x01B0;
KC[0x004D0323] = 0x1E42;
KC[0x00450328] = 0x0118;
KC[0x006F0302] = 0x00F4;
KC[0x00650308] = 0x00EB;
KC[0x006E0303] = 0x00F1;
KC[0x00690304] = 0x012B;
KC[0x006C0301] = 0x013A;
KC[0x0061030C] = 0x01CE;
KC[0x004E0323] = 0x1E46;
KC[0x006F0303] = 0x00F5;
KC[0x004B0327] = 0x0136;
KC[0x006D0301] = 0x1E3F;
KC[0x00650309] = 0x1EBB;
KC[0x004F0323] = 0x1ECC;
KC[0x0067030C] = 0x01E7;
KC[0x0061030A] = 0x00E5;
KC[0x00690302] = 0x00EE;
KC[0x004C0327] = 0x013B;
KC[0x006F0304] = 0x014D;
KC[0x00480323] = 0x1E24;
KC[0x005A0331] = 0x1E94;
KC[0x0065030F] = 0x0205;
KC[0x00680302] = 0x0125;
KC[0x00690303] = 0x0129;
KC[0x006B0301] = 0x1E31;
KC[0x006D0307] = 0x1E41;
KC[0x00490323] = 0x1ECA;
KC[0x0065030C] = 0x011B;
KC[0x00410328] = 0x0104;
KC[0x00610308] = 0x00E4;
KC[0x00690300] = 0x00EC;
KC[0x004E0327] = 0x0145;
KC[0x006F0306] = 0x014F;
KC[0x0044032D] = 0x1E12;
KC[0x006E0307] = 0x1E45;
KC[0x006F0307] = 0x022F;
KC[0x0064030C] = 0x010F;
KC[0x00690301] = 0x00ED;
KC[0x006A0302] = 0x0135;
KC[0x0045032D] = 0x1E18;
KC[0x004B0323] = 0x1E32;
KC[0x00610309] = 0x1EA3;
KC[0x004F0328] = 0x01EA;
KC[0x006B030C] = 0x01E9;
KC[0x00610306] = 0x0103;
KC[0x006F0308] = 0x00F6;
KC[0x00650302] = 0x00EA;
KC[0x00440323] = 0x1E0C;
KC[0x00610307] = 0x0227;
KC[0x0069030F] = 0x0209;
KC[0x00670301] = 0x01F5;
KC[0x006A030C] = 0x01F0;
KC[0x0048032E] = 0x1E2A;
KC[0x00450323] = 0x1EB8;
KC[0x00650303] = 0x1EBD;
KC[0x006F0309] = 0x1ECF;
KC[0x00670302] = 0x011D;
KC[0x00610304] = 0x0101;
KC[0x00650300] = 0x00E8;
KC[0x0069030C] = 0x01D0;
KC[0x00620307] = 0x1E03;
KC[0x00540331] = 0x1E6E;
KC[0x00550330] = 0x1E74;
KC[0x0068030C] = 0x021F;
KC[0x00750311] = 0x0217;
KC[0x00630307] = 0x010B;
KC[0x00430327] = 0x00C7;
KC[0x00650301] = 0x00E9;
KC[0x006F030B] = 0x0151;
KC[0x00410325] = 0x1E00;
KC[0x00720311] = 0x0213;
KC[0x00650306] = 0x0115;
KC[0x00610302] = 0x00E2;
KC[0x006F030C] = 0x01D2;
KC[0x00640307] = 0x1E0B;
KC[0x00440327] = 0x1E10;
KC[0x00670304] = 0x1E21;
KC[0x004E032D] = 0x1E4A;
KC[0x00520331] = 0x1E5E;
KC[0x00450327] = 0x0228;
KC[0x00650307] = 0x0117;
KC[0x00630301] = 0x0107;
KC[0x00610303] = 0x00E3;
KC[0x006E030C] = 0x0148;
KC[0x00410323] = 0x1EA0;
KC[0x00670306] = 0x011F;
KC[0x00650304] = 0x0113;
KC[0x00630302] = 0x0109;
KC[0x00610300] = 0x00E0;
KC[0x00690308] = 0x00EF;
KC[0x00490328] = 0x012E;
KC[0x00420323] = 0x1E04;
KC[0x00660307] = 0x1E1F;
KC[0x004C032D] = 0x1E3C;
KC[0x006F030F] = 0x020D;
KC[0x00470327] = 0x0122;
KC[0x00670307] = 0x0121;
KC[0x00610301] = 0x00E1;
KC[0x006C030C] = 0x013E;
KC[0x00680308] = 0x1E27;
KC[0x00690309] = 0x1EC9;
KC[0x0053030C] = 0x0160;
KC[0x0055030A] = 0x016E;
KC[0x006E0331] = 0x1E49;
KC[0x00570308] = 0x1E84;
KC[0x00580307] = 0x1E8A;
KC[0x004F0311] = 0x020E;
KC[0x0052030C] = 0x0158;
KC[0x0055030B] = 0x0170;
KC[0x00590307] = 0x1E8E;
KC[0x00590304] = 0x0232;
KC[0x0052030F] = 0x0210;
KC[0x00550308] = 0x00DC;
KC[0x00750328] = 0x0173;
KC[0x005A0307] = 0x017B;
KC[0x006C0331] = 0x1E3B;
KC[0x00550309] = 0x1EE6;
KC[0x00590302] = 0x0176;
KC[0x005A0301] = 0x0179;
KC[0x0055030F] = 0x0214;
KC[0x006B0331] = 0x1E35;
KC[0x00790323] = 0x1EF5;
KC[0x00590303] = 0x1EF8;
KC[0x0055030C] = 0x01D3;
KC[0x00690330] = 0x1E2D;
KC[0x0074032D] = 0x1E71;
KC[0x007A0323] = 0x1E93;
KC[0x00680331] = 0x1E96;
KC[0x00590300] = 0x1EF2;
KC[0x00490311] = 0x020A;
KC[0x00590301] = 0x00DD;
KC[0x0054030C] = 0x0164;
KC[0x0075032D] = 0x1E77;
KC[0x005A0302] = 0x1E90;
KC[0x00550302] = 0x00DB;
KC[0x00500307] = 0x1E56;
KC[0x00740323] = 0x1E6D;
KC[0x00570300] = 0x1E80;
KC[0x00550303] = 0x0168;
KC[0x005A030C] = 0x017D;
KC[0x00570301] = 0x1E82;
KC[0x00750323] = 0x1EE5;
KC[0x00730326] = 0x0219;
KC[0x00550300] = 0x00D9;
KC[0x00720327] = 0x0157;
KC[0x00570302] = 0x0174;
KC[0x00640331] = 0x1E0F;
KC[0x00650330] = 0x1E1B;
KC[0x00520307] = 0x1E58;
KC[0x00560303] = 0x1E7C;
KC[0x00760323] = 0x1E7F;
KC[0x00450311] = 0x0206;
KC[0x00550301] = 0x00DA;
KC[0x00730327] = 0x015F;
KC[0x004F031B] = 0x01A0;
KC[0x00530307] = 0x1E60;
KC[0x00770323] = 0x1E89;
KC[0x00520301] = 0x0154;
KC[0x00740327] = 0x0163;
KC[0x00550306] = 0x016C;
KC[0x00620331] = 0x1E07;
KC[0x00540307] = 0x1E6A;
KC[0x00740326] = 0x021B;
KC[0x00530301] = 0x015A;
KC[0x00530302] = 0x015C;
KC[0x00550304] = 0x016A;
KC[0x00590308] = 0x0178;
KC[0x00500301] = 0x1E54;
KC[0x00720323] = 0x1E5B;
KC[0x00750324] = 0x1E73;
KC[0x00410311] = 0x0202;
KC[0x00730323] = 0x1E63;
KC[0x00570307] = 0x1E86;
KC[0x00580308] = 0x1E8C;
KC[0x00590309] = 0x1EF6;
KC[0x0043030C] = 0x010C;
KC[0x004F0300] = 0x00D2;
KC[0x00490306] = 0x012C;
KC[0x004E0301] = 0x0143;
KC[0x00480307] = 0x1E22;
KC[0x00680327] = 0x1E29;
KC[0x006C0323] = 0x1E37;
KC[0x0041030F] = 0x0200;
KC[0x004E0300] = 0x01F8;
KC[0x004F0301] = 0x00D3;
KC[0x00490307] = 0x0130;
KC[0x0055031B] = 0x01AF;
KC[0x006D0323] = 0x1E43;
KC[0x00650328] = 0x0119;
KC[0x004F0302] = 0x00D4;
KC[0x004E0303] = 0x00D1;
KC[0x00450308] = 0x00CB;
KC[0x00490304] = 0x012A;
KC[0x004C0301] = 0x0139;
KC[0x0041030C] = 0x01CD;
KC[0x006E0323] = 0x1E47;
KC[0x004F0303] = 0x00D5;
KC[0x006B0327] = 0x0137;
KC[0x004D0301] = 0x1E3E;
KC[0x00450309] = 0x1EBA;
KC[0x006F0323] = 0x1ECD;
KC[0x0047030C] = 0x01E6;
KC[0x00490302] = 0x00CE;
KC[0x0041030A] = 0x00C5;
KC[0x006C0327] = 0x013C;
KC[0x004F0304] = 0x014C;
KC[0x00680323] = 0x1E25;
KC[0x007A0331] = 0x1E95;
KC[0x0045030F] = 0x0204;
KC[0x00480302] = 0x0124;
KC[0x00490303] = 0x0128;
KC[0x004B0301] = 0x1E30;
KC[0x004D0307] = 0x1E40;
KC[0x00690323] = 0x1ECB;
KC[0x0045030C] = 0x011A;
KC[0x00610328] = 0x0105;
KC[0x00490300] = 0x00CC;
KC[0x00410308] = 0x00C4;
KC[0x006E0327] = 0x0146;
KC[0x004F0306] = 0x014E;
KC[0x0064032D] = 0x1E13;
KC[0x004E0307] = 0x1E44;
KC[0x004F0307] = 0x022E;
KC[0x0044030C] = 0x010E;
KC[0x00490301] = 0x00CD;
KC[0x004A0302] = 0x0134;
KC[0x0065032D] = 0x1E19;
KC[0x006B0323] = 0x1E33;
KC[0x00410309] = 0x1EA2;
KC[0x006F0328] = 0x01EB;
KC[0x004B030C] = 0x01E8;
KC[0x00410306] = 0x0102;
KC[0x004F0308] = 0x00D6;
KC[0x00450302] = 0x00CA;
KC[0x00640323] = 0x1E0D;
KC[0x00410307] = 0x0226;
KC[0x0049030F] = 0x0208;
KC[0x00470301] = 0x01F4;
KC[0x0068032E] = 0x1E2B;
KC[0x00650323] = 0x1EB9;
KC[0x00450303] = 0x1EBC;
KC[0x004F0309] = 0x1ECE;
KC[0x00470302] = 0x011C;
KC[0x00410304] = 0x0100;
KC[0x00450300] = 0x00C8;
KC[0x0049030C] = 0x01CF;
KC[0x00420307] = 0x1E02;
KC[0x00740331] = 0x1E6F;
KC[0x00750330] = 0x1E75;
KC[0x0048030C] = 0x021E;
KC[0x00550311] = 0x0216;
KC[0x00430307] = 0x010A;
KC[0x00450301] = 0x00C9;
KC[0x00630327] = 0x00E7;
KC[0x004F030B] = 0x0150;
KC[0x00610325] = 0x1E01;
KC[0x00520311] = 0x0212;
KC[0x00450306] = 0x0114;
KC[0x00410302] = 0x00C2;
KC[0x004F030C] = 0x01D1;
KC[0x00440307] = 0x1E0A;
KC[0x00640327] = 0x1E11;
KC[0x00470304] = 0x1E20;
KC[0x006E032D] = 0x1E4B;
KC[0x00720331] = 0x1E5F;
KC[0x00650327] = 0x0229;
KC[0x00450307] = 0x0116;
KC[0x00430301] = 0x0106;
KC[0x00410303] = 0x00C3;
KC[0x004E030C] = 0x0147;
KC[0x00610323] = 0x1EA1;
KC[0x00470306] = 0x011E;
KC[0x00450304] = 0x0112;
KC[0x00430302] = 0x0108;
KC[0x00490308] = 0x00CF;
KC[0x00410300] = 0x00C0;
KC[0x00690328] = 0x012F;
KC[0x00620323] = 0x1E05;
KC[0x00460307] = 0x1E1E;
KC[0x006C032D] = 0x1E3D;
KC[0x004F030F] = 0x020C;
KC[0x00670327] = 0x0123;
KC[0x00470307] = 0x0120;
KC[0x00410301] = 0x00C1;
KC[0x004C030C] = 0x013D;
KC[0x00480308] = 0x1E26;
KC[0x00490309] = 0x1EC8;
KC[0x003E0338] = 0x226F;
KC[0x003D0338] = 0x2260;
KC[0x003C0338] = 0x226E;
KC[0x01EA0304] = 0x01EC;
KC[0x01EB0304] = 0x01ED;
KC[0x01B7030C] = 0x01EE;
KC[0x01B00309] = 0x1EED;
KC[0x01B00303] = 0x1EEF;
KC[0x01B00300] = 0x1EEB;
KC[0x01B00301] = 0x1EE9;
KC[0x01AF0301] = 0x1EE8;
KC[0x01AF0300] = 0x1EEA;
KC[0x01AF0303] = 0x1EEE;
KC[0x01A10309] = 0x1EDF;
KC[0x01A00309] = 0x1EDE;
KC[0x01AF0309] = 0x1EEC;
KC[0x01A10303] = 0x1EE1;
KC[0x01A00303] = 0x1EE0;
KC[0x01A10301] = 0x1EDB;
KC[0x01A00300] = 0x1EDC;
KC[0x01A00301] = 0x1EDA;
KC[0x01A10300] = 0x1EDD;
KC[0x01B00323] = 0x1EF1;
KC[0x01AF0323] = 0x1EF0;
KC[0x01A10323] = 0x1EE3;
KC[0x01A00323] = 0x1EE2;
KC[0x017F0307] = 0x1E9B;
KC[0x01690301] = 0x1E79;
KC[0x01680301] = 0x1E78;
KC[0x01610307] = 0x1E67;
KC[0x01600307] = 0x1E66;
KC[0x016A0308] = 0x1E7A;
KC[0x016B0308] = 0x1E7B;
KC[0x015B0307] = 0x1E65;
KC[0x015A0307] = 0x1E64;
KC[0x014C0300] = 0x1E50;
KC[0x014D0301] = 0x1E53;
KC[0x014D0300] = 0x1E51;
KC[0x014C0301] = 0x1E52;
KC[0x01120300] = 0x1E14;
KC[0x01130301] = 0x1E17;
KC[0x01130300] = 0x1E15;
KC[0x01120301] = 0x1E16;
KC[0x01030309] = 0x1EB3;
KC[0x01020309] = 0x1EB2;
KC[0x01030301] = 0x1EAF;
KC[0x01020300] = 0x1EB0;
KC[0x01020301] = 0x1EAE;
KC[0x01030300] = 0x1EB1;
KC[0x01030303] = 0x1EB5;
KC[0x01020303] = 0x1EB4;
KC[0x0292030C] = 0x01EF;
KC[0x02290306] = 0x1E1D;
KC[0x02280306] = 0x1E1C;
KC[0x022F0304] = 0x0231;
KC[0x022E0304] = 0x0230;
KC[0x02270304] = 0x01E1;
KC[0x02260304] = 0x01E0;
KC[0x30573099] = 0x3058;
KC[0x30553099] = 0x3056;
KC[0x30533099] = 0x3054;
KC[0x30513099] = 0x3052;
KC[0x03B90342] = 0x1FD6;
KC[0x03B10345] = 0x1FB3;
KC[0x305F3099] = 0x3060;
KC[0x03B70342] = 0x1FC6;
KC[0x305D3099] = 0x305E;
KC[0x305B3099] = 0x305C;
KC[0x03B70345] = 0x1FC3;
KC[0x30593099] = 0x305A;
KC[0x03B10342] = 0x1FB6;
KC[0x30463099] = 0x3094;
KC[0x03A90345] = 0x1FFC;
KC[0x03AC0345] = 0x1FB4;
KC[0x03AE0345] = 0x1FC4;
KC[0x304F3099] = 0x3050;
KC[0x304D3099] = 0x304E;
KC[0x304B3099] = 0x304C;
KC[0x3075309A] = 0x3077;
KC[0x03C90314] = 0x1F61;
KC[0x30753099] = 0x3076;
KC[0x30723099] = 0x3073;
KC[0x03D20308] = 0x03D4;
KC[0x03C90313] = 0x1F60;
KC[0x3072309A] = 0x3074;
KC[0x03910345] = 0x1FBC;
KC[0x03C10314] = 0x1FE5;
KC[0x03C50313] = 0x1F50;
KC[0x307B3099] = 0x307C;
KC[0x3078309A] = 0x307A;
KC[0x03C50314] = 0x1F51;
KC[0x307B309A] = 0x307D;
KC[0x30783099] = 0x3079;
KC[0x03C10313] = 0x1FE4;
KC[0x03970345] = 0x1FCC;
KC[0x03D20301] = 0x03D3;
KC[0x30663099] = 0x3067;
KC[0x03C50308] = 0x03CB;
KC[0x30643099] = 0x3065;
KC[0x03C90301] = 0x03CE;
KC[0x03C90300] = 0x1F7C;
KC[0x03CA0300] = 0x1FD2;
KC[0x03CB0301] = 0x03B0;
KC[0x30613099] = 0x3062;
KC[0x03CB0300] = 0x1FE2;
KC[0x03CA0301] = 0x0390;
KC[0x03C50301] = 0x03CD;
KC[0x306F3099] = 0x3070;
KC[0x03C50300] = 0x1F7A;
KC[0x306F309A] = 0x3071;
KC[0x03C50304] = 0x1FE1;
KC[0x30683099] = 0x3069;
KC[0x03C50306] = 0x1FE0;
KC[0x03B90304] = 0x1FD1;
KC[0x03A90314] = 0x1F69;
KC[0x03BF0301] = 0x03CC;
KC[0x03B90306] = 0x1FD0;
KC[0x03BF0300] = 0x1F78;
KC[0x03B90301] = 0x03AF;
KC[0x03B90300] = 0x1F76;
KC[0x03A90313] = 0x1F68;
KC[0x03B50301] = 0x03AD;
KC[0x03A10314] = 0x1FEC;
KC[0x03B10304] = 0x1FB1;
KC[0x03B50300] = 0x1F72;
KC[0x03B70301] = 0x03AE;
KC[0x03B10306] = 0x1FB0;
KC[0x03B70300] = 0x1F74;
KC[0x03B10301] = 0x03AC;
KC[0x03B90308] = 0x03CA;
KC[0x03A50314] = 0x1F59;
KC[0x03B10300] = 0x1F70;
KC[0x03BF0313] = 0x1F40;
KC[0x03A50308] = 0x03AB;
KC[0x03B90314] = 0x1F31;
KC[0x03A90301] = 0x038F;
KC[0x03A90300] = 0x1FFA;
KC[0x03B90313] = 0x1F30;
KC[0x03BF0314] = 0x1F41;
KC[0x03A50301] = 0x038E;
KC[0x03B70313] = 0x1F20;
KC[0x03A50300] = 0x1FEA;
KC[0x03B10314] = 0x1F01;
KC[0x03B50313] = 0x1F10;
KC[0x03A50304] = 0x1FE9;
KC[0x03B50314] = 0x1F11;
KC[0x03B10313] = 0x1F00;
KC[0x03A50306] = 0x1FE8;
KC[0x03B70314] = 0x1F21;
KC[0x03990304] = 0x1FD9;
KC[0x039F0301] = 0x038C;
KC[0x039F0300] = 0x1FF8;
KC[0x03990306] = 0x1FD8;
KC[0x03990301] = 0x038A;
KC[0x03990300] = 0x1FDA;
KC[0x03950301] = 0x0388;
KC[0x03950300] = 0x1FC8;
KC[0x03910304] = 0x1FB9;
KC[0x03970301] = 0x0389;
KC[0x03970300] = 0x1FCA;
KC[0x03910306] = 0x1FB8;
KC[0x06C10654] = 0x06C2;
KC[0x03910301] = 0x0386;
KC[0x03910300] = 0x1FBA;
KC[0x03990308] = 0x03AA;
KC[0x03C90345] = 0x1FF3;
KC[0x039F0313] = 0x1F48;
KC[0x03990314] = 0x1F39;
KC[0x03CA0342] = 0x1FD7;
KC[0x03CB0342] = 0x1FE7;
KC[0x03990313] = 0x1F38;
KC[0x03C90342] = 0x1FF6;
KC[0x03CE0345] = 0x1FF4;
KC[0x039F0314] = 0x1F49;
KC[0x06D50654] = 0x06C0;
KC[0x03970313] = 0x1F28;
KC[0x03910314] = 0x1F09;
KC[0x03950313] = 0x1F18;
KC[0x03C50342] = 0x1FE6;
KC[0x03950314] = 0x1F19;
KC[0x03910313] = 0x1F08;
KC[0x06D20654] = 0x06D3;
KC[0x03970314] = 0x1F29;
KC[0x30D5309A] = 0x30D7;
KC[0x30D53099] = 0x30D6;
KC[0x30D23099] = 0x30D3;
KC[0x30D2309A] = 0x30D4;
KC[0x0D460D3E] = 0x0D4A;
KC[0x06270654] = 0x0623;
KC[0x0D470D3E] = 0x0D4B;
KC[0x06270655] = 0x0625;
KC[0x0BC60BBE] = 0x0BCA;
KC[0x30DB3099] = 0x30DC;
KC[0x30D8309A] = 0x30DA;
KC[0x0BC70BBE] = 0x0BCB;
KC[0x0B470B3E] = 0x0B4B;
KC[0x06270653] = 0x0622;
KC[0x30DB309A] = 0x30DD;
KC[0x30D83099] = 0x30D9;
KC[0x09C709BE] = 0x09CB;
KC[0x30C63099] = 0x30C7;
KC[0x30C43099] = 0x30C5;
KC[0x05D905B4] = 0xFB1D;
KC[0x30C13099] = 0x30C2;
KC[0x30CF3099] = 0x30D0;
KC[0x0CBF0CD5] = 0x0CC0;
KC[0x30CF309A] = 0x30D1;
KC[0x30C83099] = 0x30C9;
KC[0x30F23099] = 0x30FA;
KC[0x30F03099] = 0x30F8;
KC[0x30F13099] = 0x30F9;
KC[0x30FD3099] = 0x30FE;
KC[0x0B920BD7] = 0x0B94;
KC[0x30EF3099] = 0x30F7;
KC[0x309D3099] = 0x309E;
KC[0x0CC60CD5] = 0x0CC7;
KC[0x30B73099] = 0x30B8;
KC[0x0DD90DCA] = 0x0DDA;
KC[0x0928093C] = 0x0929;
KC[0x30B53099] = 0x30B6;
KC[0x0D460D57] = 0x0D4C;
KC[0x0CC60CD6] = 0x0CC8;
KC[0x0C460C56] = 0x0C48;
KC[0x0DDC0DCA] = 0x0DDD;
KC[0x0DD90DCF] = 0x0DDC;
KC[0x0B470B57] = 0x0B4C;
KC[0x1025102E] = 0x1026;
KC[0x30B33099] = 0x30B4;
KC[0x0BC60BD7] = 0x0BCC;
KC[0x0B470B56] = 0x0B48;
KC[0x06480654] = 0x0624;
KC[0x09C709D7] = 0x09CC;
KC[0x30B13099] = 0x30B2;
KC[0x064A0654] = 0x0626;
KC[0x30BF3099] = 0x30C0;
KC[0x30BD3099] = 0x30BE;
KC[0x0CCA0CD5] = 0x0CCB;
KC[0x30BB3099] = 0x30BC;
KC[0x30B93099] = 0x30BA;
KC[0x30A63099] = 0x30F4;
KC[0x0DD90DDF] = 0x0DDE;
KC[0x0CC60CC2] = 0x0CCA;
KC[0x30AF3099] = 0x30B0;
KC[0x0933093C] = 0x0934;
KC[0x0930093C] = 0x0931;
KC[0x30AD3099] = 0x30AE;
KC[0x30AB3099] = 0x30AC;
// 918 composition mappings total


var CF = new Object();
CF[0x41] = '\u0061';
CF[0x42] = '\u0062';
CF[0x43] = '\u0063';
CF[0x44] = '\u0064';
CF[0x45] = '\u0065';
CF[0x46] = '\u0066';
CF[0x47] = '\u0067';
CF[0x48] = '\u0068';
CF[0x49] = '\u0069';
CF[0x4A] = '\u006A';
CF[0x4B] = '\u006B';
CF[0x4C] = '\u006C';
CF[0x4D] = '\u006D';
CF[0x4E] = '\u006E';
CF[0x4F] = '\u006F';
CF[0x50] = '\u0070';
CF[0x51] = '\u0071';
CF[0x52] = '\u0072';
CF[0x53] = '\u0073';
CF[0x54] = '\u0074';
CF[0x55] = '\u0075';
CF[0x56] = '\u0076';
CF[0x57] = '\u0077';
CF[0x58] = '\u0078';
CF[0x59] = '\u0079';
CF[0x5A] = '\u007A';
CF[0xAD] = '';
CF[0xB5] = '\u03BC';
CF[0xC0] = '\u00E0';
CF[0xC1] = '\u00E1';
CF[0xC2] = '\u00E2';
CF[0xC3] = '\u00E3';
CF[0xC4] = '\u00E4';
CF[0xC5] = '\u00E5';
CF[0xC6] = '\u00E6';
CF[0xC7] = '\u00E7';
CF[0xC8] = '\u00E8';
CF[0xC9] = '\u00E9';
CF[0xCA] = '\u00EA';
CF[0xCB] = '\u00EB';
CF[0xCC] = '\u00EC';
CF[0xCD] = '\u00ED';
CF[0xCE] = '\u00EE';
CF[0xCF] = '\u00EF';
CF[0xD0] = '\u00F0';
CF[0xD1] = '\u00F1';
CF[0xD2] = '\u00F2';
CF[0xD3] = '\u00F3';
CF[0xD4] = '\u00F4';
CF[0xD5] = '\u00F5';
CF[0xD6] = '\u00F6';
CF[0xD8] = '\u00F8';
CF[0xD9] = '\u00F9';
CF[0xDA] = '\u00FA';
CF[0xDB] = '\u00FB';
CF[0xDC] = '\u00FC';
CF[0xDD] = '\u00FD';
CF[0xDE] = '\u00FE';
CF[0xDF] = '\u0073\u0073';
CF[0x100] = '\u0101';
CF[0x102] = '\u0103';
CF[0x104] = '\u0105';
CF[0x106] = '\u0107';
CF[0x108] = '\u0109';
CF[0x10A] = '\u010B';
CF[0x10C] = '\u010D';
CF[0x10E] = '\u010F';
CF[0x110] = '\u0111';
CF[0x112] = '\u0113';
CF[0x114] = '\u0115';
CF[0x116] = '\u0117';
CF[0x118] = '\u0119';
CF[0x11A] = '\u011B';
CF[0x11C] = '\u011D';
CF[0x11E] = '\u011F';
CF[0x120] = '\u0121';
CF[0x122] = '\u0123';
CF[0x124] = '\u0125';
CF[0x126] = '\u0127';
CF[0x128] = '\u0129';
CF[0x12A] = '\u012B';
CF[0x12C] = '\u012D';
CF[0x12E] = '\u012F';
CF[0x130] = '\u0069';
CF[0x131] = '\u0069';
CF[0x132] = '\u0133';
CF[0x134] = '\u0135';
CF[0x136] = '\u0137';
CF[0x139] = '\u013A';
CF[0x13B] = '\u013C';
CF[0x13D] = '\u013E';
CF[0x13F] = '\u0140';
CF[0x141] = '\u0142';
CF[0x143] = '\u0144';
CF[0x145] = '\u0146';
CF[0x147] = '\u0148';
CF[0x149] = '\u02BC\u006E';
CF[0x14A] = '\u014B';
CF[0x14C] = '\u014D';
CF[0x14E] = '\u014F';
CF[0x150] = '\u0151';
CF[0x152] = '\u0153';
CF[0x154] = '\u0155';
CF[0x156] = '\u0157';
CF[0x158] = '\u0159';
CF[0x15A] = '\u015B';
CF[0x15C] = '\u015D';
CF[0x15E] = '\u015F';
CF[0x160] = '\u0161';
CF[0x162] = '\u0163';
CF[0x164] = '\u0165';
CF[0x166] = '\u0167';
CF[0x168] = '\u0169';
CF[0x16A] = '\u016B';
CF[0x16C] = '\u016D';
CF[0x16E] = '\u016F';
CF[0x170] = '\u0171';
CF[0x172] = '\u0173';
CF[0x174] = '\u0175';
CF[0x176] = '\u0177';
CF[0x178] = '\u00FF';
CF[0x179] = '\u017A';
CF[0x17B] = '\u017C';
CF[0x17D] = '\u017E';
CF[0x17F] = '\u0073';
CF[0x181] = '\u0253';
CF[0x182] = '\u0183';
CF[0x184] = '\u0185';
CF[0x186] = '\u0254';
CF[0x187] = '\u0188';
CF[0x189] = '\u0256';
CF[0x18A] = '\u0257';
CF[0x18B] = '\u018C';
CF[0x18E] = '\u01DD';
CF[0x18F] = '\u0259';
CF[0x190] = '\u025B';
CF[0x191] = '\u0192';
CF[0x193] = '\u0260';
CF[0x194] = '\u0263';
CF[0x196] = '\u0269';
CF[0x197] = '\u0268';
CF[0x198] = '\u0199';
CF[0x19C] = '\u026F';
CF[0x19D] = '\u0272';
CF[0x19F] = '\u0275';
CF[0x1A0] = '\u01A1';
CF[0x1A2] = '\u01A3';
CF[0x1A4] = '\u01A5';
CF[0x1A6] = '\u0280';
CF[0x1A7] = '\u01A8';
CF[0x1A9] = '\u0283';
CF[0x1AC] = '\u01AD';
CF[0x1AE] = '\u0288';
CF[0x1AF] = '\u01B0';
CF[0x1B1] = '\u028A';
CF[0x1B2] = '\u028B';
CF[0x1B3] = '\u01B4';
CF[0x1B5] = '\u01B6';
CF[0x1B7] = '\u0292';
CF[0x1B8] = '\u01B9';
CF[0x1BC] = '\u01BD';
CF[0x1C4] = '\u01C6';
CF[0x1C5] = '\u01C6';
CF[0x1C7] = '\u01C9';
CF[0x1C8] = '\u01C9';
CF[0x1CA] = '\u01CC';
CF[0x1CB] = '\u01CC';
CF[0x1CD] = '\u01CE';
CF[0x1CF] = '\u01D0';
CF[0x1D1] = '\u01D2';
CF[0x1D3] = '\u01D4';
CF[0x1D5] = '\u01D6';
CF[0x1D7] = '\u01D8';
CF[0x1D9] = '\u01DA';
CF[0x1DB] = '\u01DC';
CF[0x1DE] = '\u01DF';
CF[0x1E0] = '\u01E1';
CF[0x1E2] = '\u01E3';
CF[0x1E4] = '\u01E5';
CF[0x1E6] = '\u01E7';
CF[0x1E8] = '\u01E9';
CF[0x1EA] = '\u01EB';
CF[0x1EC] = '\u01ED';
CF[0x1EE] = '\u01EF';
CF[0x1F0] = '\u006A\u030C';
CF[0x1F1] = '\u01F3';
CF[0x1F2] = '\u01F3';
CF[0x1F4] = '\u01F5';
CF[0x1F6] = '\u0195';
CF[0x1F7] = '\u01BF';
CF[0x1F8] = '\u01F9';
CF[0x1FA] = '\u01FB';
CF[0x1FC] = '\u01FD';
CF[0x1FE] = '\u01FF';
CF[0x200] = '\u0201';
CF[0x202] = '\u0203';
CF[0x204] = '\u0205';
CF[0x206] = '\u0207';
CF[0x208] = '\u0209';
CF[0x20A] = '\u020B';
CF[0x20C] = '\u020D';
CF[0x20E] = '\u020F';
CF[0x210] = '\u0211';
CF[0x212] = '\u0213';
CF[0x214] = '\u0215';
CF[0x216] = '\u0217';
CF[0x218] = '\u0219';
CF[0x21A] = '\u021B';
CF[0x21C] = '\u021D';
CF[0x21E] = '\u021F';
CF[0x222] = '\u0223';
CF[0x224] = '\u0225';
CF[0x226] = '\u0227';
CF[0x228] = '\u0229';
CF[0x22A] = '\u022B';
CF[0x22C] = '\u022D';
CF[0x22E] = '\u022F';
CF[0x230] = '\u0231';
CF[0x232] = '\u0233';
CF[0x345] = '\u03B9';
CF[0x37A] = '\u0020\u03B9';
CF[0x386] = '\u03AC';
CF[0x388] = '\u03AD';
CF[0x389] = '\u03AE';
CF[0x38A] = '\u03AF';
CF[0x38C] = '\u03CC';
CF[0x38E] = '\u03CD';
CF[0x38F] = '\u03CE';
CF[0x390] = '\u03B9\u0308\u0301';
CF[0x391] = '\u03B1';
CF[0x392] = '\u03B2';
CF[0x393] = '\u03B3';
CF[0x394] = '\u03B4';
CF[0x395] = '\u03B5';
CF[0x396] = '\u03B6';
CF[0x397] = '\u03B7';
CF[0x398] = '\u03B8';
CF[0x399] = '\u03B9';
CF[0x39A] = '\u03BA';
CF[0x39B] = '\u03BB';
CF[0x39C] = '\u03BC';
CF[0x39D] = '\u03BD';
CF[0x39E] = '\u03BE';
CF[0x39F] = '\u03BF';
CF[0x3A0] = '\u03C0';
CF[0x3A1] = '\u03C1';
CF[0x3A3] = '\u03C2';
CF[0x3A4] = '\u03C4';
CF[0x3A5] = '\u03C5';
CF[0x3A6] = '\u03C6';
CF[0x3A7] = '\u03C7';
CF[0x3A8] = '\u03C8';
CF[0x3A9] = '\u03C9';
CF[0x3AA] = '\u03CA';
CF[0x3AB] = '\u03CB';
CF[0x3B0] = '\u03C5\u0308\u0301';
CF[0x3C2] = '\u03C2';
CF[0x3C3] = '\u03C2';
CF[0x3D0] = '\u03B2';
CF[0x3D1] = '\u03B8';
CF[0x3D2] = '\u03C5';
CF[0x3D3] = '\u03CD';
CF[0x3D4] = '\u03CB';
CF[0x3D5] = '\u03C6';
CF[0x3D6] = '\u03C0';
CF[0x3DA] = '\u03DB';
CF[0x3DC] = '\u03DD';
CF[0x3DE] = '\u03DF';
CF[0x3E0] = '\u03E1';
CF[0x3E2] = '\u03E3';
CF[0x3E4] = '\u03E5';
CF[0x3E6] = '\u03E7';
CF[0x3E8] = '\u03E9';
CF[0x3EA] = '\u03EB';
CF[0x3EC] = '\u03ED';
CF[0x3EE] = '\u03EF';
CF[0x3F0] = '\u03BA';
CF[0x3F1] = '\u03C1';
CF[0x3F2] = '\u03C2';
CF[0x400] = '\u0450';
CF[0x401] = '\u0451';
CF[0x402] = '\u0452';
CF[0x403] = '\u0453';
CF[0x404] = '\u0454';
CF[0x405] = '\u0455';
CF[0x406] = '\u0456';
CF[0x407] = '\u0457';
CF[0x408] = '\u0458';
CF[0x409] = '\u0459';
CF[0x40A] = '\u045A';
CF[0x40B] = '\u045B';
CF[0x40C] = '\u045C';
CF[0x40D] = '\u045D';
CF[0x40E] = '\u045E';
CF[0x40F] = '\u045F';
CF[0x410] = '\u0430';
CF[0x411] = '\u0431';
CF[0x412] = '\u0432';
CF[0x413] = '\u0433';
CF[0x414] = '\u0434';
CF[0x415] = '\u0435';
CF[0x416] = '\u0436';
CF[0x417] = '\u0437';
CF[0x418] = '\u0438';
CF[0x419] = '\u0439';
CF[0x41A] = '\u043A';
CF[0x41B] = '\u043B';
CF[0x41C] = '\u043C';
CF[0x41D] = '\u043D';
CF[0x41E] = '\u043E';
CF[0x41F] = '\u043F';
CF[0x420] = '\u0440';
CF[0x421] = '\u0441';
CF[0x422] = '\u0442';
CF[0x423] = '\u0443';
CF[0x424] = '\u0444';
CF[0x425] = '\u0445';
CF[0x426] = '\u0446';
CF[0x427] = '\u0447';
CF[0x428] = '\u0448';
CF[0x429] = '\u0449';
CF[0x42A] = '\u044A';
CF[0x42B] = '\u044B';
CF[0x42C] = '\u044C';
CF[0x42D] = '\u044D';
CF[0x42E] = '\u044E';
CF[0x42F] = '\u044F';
CF[0x460] = '\u0461';
CF[0x462] = '\u0463';
CF[0x464] = '\u0465';
CF[0x466] = '\u0467';
CF[0x468] = '\u0469';
CF[0x46A] = '\u046B';
CF[0x46C] = '\u046D';
CF[0x46E] = '\u046F';
CF[0x470] = '\u0471';
CF[0x472] = '\u0473';
CF[0x474] = '\u0475';
CF[0x476] = '\u0477';
CF[0x478] = '\u0479';
CF[0x47A] = '\u047B';
CF[0x47C] = '\u047D';
CF[0x47E] = '\u047F';
CF[0x480] = '\u0481';
CF[0x48C] = '\u048D';
CF[0x48E] = '\u048F';
CF[0x490] = '\u0491';
CF[0x492] = '\u0493';
CF[0x494] = '\u0495';
CF[0x496] = '\u0497';
CF[0x498] = '\u0499';
CF[0x49A] = '\u049B';
CF[0x49C] = '\u049D';
CF[0x49E] = '\u049F';
CF[0x4A0] = '\u04A1';
CF[0x4A2] = '\u04A3';
CF[0x4A4] = '\u04A5';
CF[0x4A6] = '\u04A7';
CF[0x4A8] = '\u04A9';
CF[0x4AA] = '\u04AB';
CF[0x4AC] = '\u04AD';
CF[0x4AE] = '\u04AF';
CF[0x4B0] = '\u04B1';
CF[0x4B2] = '\u04B3';
CF[0x4B4] = '\u04B5';
CF[0x4B6] = '\u04B7';
CF[0x4B8] = '\u04B9';
CF[0x4BA] = '\u04BB';
CF[0x4BC] = '\u04BD';
CF[0x4BE] = '\u04BF';
CF[0x4C1] = '\u04C2';
CF[0x4C3] = '\u04C4';
CF[0x4C7] = '\u04C8';
CF[0x4CB] = '\u04CC';
CF[0x4D0] = '\u04D1';
CF[0x4D2] = '\u04D3';
CF[0x4D4] = '\u04D5';
CF[0x4D6] = '\u04D7';
CF[0x4D8] = '\u04D9';
CF[0x4DA] = '\u04DB';
CF[0x4DC] = '\u04DD';
CF[0x4DE] = '\u04DF';
CF[0x4E0] = '\u04E1';
CF[0x4E2] = '\u04E3';
CF[0x4E4] = '\u04E5';
CF[0x4E6] = '\u04E7';
CF[0x4E8] = '\u04E9';
CF[0x4EA] = '\u04EB';
CF[0x4EC] = '\u04ED';
CF[0x4EE] = '\u04EF';
CF[0x4F0] = '\u04F1';
CF[0x4F2] = '\u04F3';
CF[0x4F4] = '\u04F5';
CF[0x4F8] = '\u04F9';
CF[0x531] = '\u0561';
CF[0x532] = '\u0562';
CF[0x533] = '\u0563';
CF[0x534] = '\u0564';
CF[0x535] = '\u0565';
CF[0x536] = '\u0566';
CF[0x537] = '\u0567';
CF[0x538] = '\u0568';
CF[0x539] = '\u0569';
CF[0x53A] = '\u056A';
CF[0x53B] = '\u056B';
CF[0x53C] = '\u056C';
CF[0x53D] = '\u056D';
CF[0x53E] = '\u056E';
CF[0x53F] = '\u056F';
CF[0x540] = '\u0570';
CF[0x541] = '\u0571';
CF[0x542] = '\u0572';
CF[0x543] = '\u0573';
CF[0x544] = '\u0574';
CF[0x545] = '\u0575';
CF[0x546] = '\u0576';
CF[0x547] = '\u0577';
CF[0x548] = '\u0578';
CF[0x549] = '\u0579';
CF[0x54A] = '\u057A';
CF[0x54B] = '\u057B';
CF[0x54C] = '\u057C';
CF[0x54D] = '\u057D';
CF[0x54E] = '\u057E';
CF[0x54F] = '\u057F';
CF[0x550] = '\u0580';
CF[0x551] = '\u0581';
CF[0x552] = '\u0582';
CF[0x553] = '\u0583';
CF[0x554] = '\u0584';
CF[0x555] = '\u0585';
CF[0x556] = '\u0586';
CF[0x587] = '\u0565\u0582';
CF[0x1806] = '';
CF[0x180B] = '';
CF[0x180C] = '';
CF[0x180D] = '';
CF[0x1E00] = '\u1E01';
CF[0x1E02] = '\u1E03';
CF[0x1E04] = '\u1E05';
CF[0x1E06] = '\u1E07';
CF[0x1E08] = '\u1E09';
CF[0x1E0A] = '\u1E0B';
CF[0x1E0C] = '\u1E0D';
CF[0x1E0E] = '\u1E0F';
CF[0x1E10] = '\u1E11';
CF[0x1E12] = '\u1E13';
CF[0x1E14] = '\u1E15';
CF[0x1E16] = '\u1E17';
CF[0x1E18] = '\u1E19';
CF[0x1E1A] = '\u1E1B';
CF[0x1E1C] = '\u1E1D';
CF[0x1E1E] = '\u1E1F';
CF[0x1E20] = '\u1E21';
CF[0x1E22] = '\u1E23';
CF[0x1E24] = '\u1E25';
CF[0x1E26] = '\u1E27';
CF[0x1E28] = '\u1E29';
CF[0x1E2A] = '\u1E2B';
CF[0x1E2C] = '\u1E2D';
CF[0x1E2E] = '\u1E2F';
CF[0x1E30] = '\u1E31';
CF[0x1E32] = '\u1E33';
CF[0x1E34] = '\u1E35';
CF[0x1E36] = '\u1E37';
CF[0x1E38] = '\u1E39';
CF[0x1E3A] = '\u1E3B';
CF[0x1E3C] = '\u1E3D';
CF[0x1E3E] = '\u1E3F';
CF[0x1E40] = '\u1E41';
CF[0x1E42] = '\u1E43';
CF[0x1E44] = '\u1E45';
CF[0x1E46] = '\u1E47';
CF[0x1E48] = '\u1E49';
CF[0x1E4A] = '\u1E4B';
CF[0x1E4C] = '\u1E4D';
CF[0x1E4E] = '\u1E4F';
CF[0x1E50] = '\u1E51';
CF[0x1E52] = '\u1E53';
CF[0x1E54] = '\u1E55';
CF[0x1E56] = '\u1E57';
CF[0x1E58] = '\u1E59';
CF[0x1E5A] = '\u1E5B';
CF[0x1E5C] = '\u1E5D';
CF[0x1E5E] = '\u1E5F';
CF[0x1E60] = '\u1E61';
CF[0x1E62] = '\u1E63';
CF[0x1E64] = '\u1E65';
CF[0x1E66] = '\u1E67';
CF[0x1E68] = '\u1E69';
CF[0x1E6A] = '\u1E6B';
CF[0x1E6C] = '\u1E6D';
CF[0x1E6E] = '\u1E6F';
CF[0x1E70] = '\u1E71';
CF[0x1E72] = '\u1E73';
CF[0x1E74] = '\u1E75';
CF[0x1E76] = '\u1E77';
CF[0x1E78] = '\u1E79';
CF[0x1E7A] = '\u1E7B';
CF[0x1E7C] = '\u1E7D';
CF[0x1E7E] = '\u1E7F';
CF[0x1E80] = '\u1E81';
CF[0x1E82] = '\u1E83';
CF[0x1E84] = '\u1E85';
CF[0x1E86] = '\u1E87';
CF[0x1E88] = '\u1E89';
CF[0x1E8A] = '\u1E8B';
CF[0x1E8C] = '\u1E8D';
CF[0x1E8E] = '\u1E8F';
CF[0x1E90] = '\u1E91';
CF[0x1E92] = '\u1E93';
CF[0x1E94] = '\u1E95';
CF[0x1E96] = '\u0068\u0331';
CF[0x1E97] = '\u0074\u0308';
CF[0x1E98] = '\u0077\u030A';
CF[0x1E99] = '\u0079\u030A';
CF[0x1E9A] = '\u0061\u02BE';
CF[0x1E9B] = '\u1E61';
CF[0x1EA0] = '\u1EA1';
CF[0x1EA2] = '\u1EA3';
CF[0x1EA4] = '\u1EA5';
CF[0x1EA6] = '\u1EA7';
CF[0x1EA8] = '\u1EA9';
CF[0x1EAA] = '\u1EAB';
CF[0x1EAC] = '\u1EAD';
CF[0x1EAE] = '\u1EAF';
CF[0x1EB0] = '\u1EB1';
CF[0x1EB2] = '\u1EB3';
CF[0x1EB4] = '\u1EB5';
CF[0x1EB6] = '\u1EB7';
CF[0x1EB8] = '\u1EB9';
CF[0x1EBA] = '\u1EBB';
CF[0x1EBC] = '\u1EBD';
CF[0x1EBE] = '\u1EBF';
CF[0x1EC0] = '\u1EC1';
CF[0x1EC2] = '\u1EC3';
CF[0x1EC4] = '\u1EC5';
CF[0x1EC6] = '\u1EC7';
CF[0x1EC8] = '\u1EC9';
CF[0x1ECA] = '\u1ECB';
CF[0x1ECC] = '\u1ECD';
CF[0x1ECE] = '\u1ECF';
CF[0x1ED0] = '\u1ED1';
CF[0x1ED2] = '\u1ED3';
CF[0x1ED4] = '\u1ED5';
CF[0x1ED6] = '\u1ED7';
CF[0x1ED8] = '\u1ED9';
CF[0x1EDA] = '\u1EDB';
CF[0x1EDC] = '\u1EDD';
CF[0x1EDE] = '\u1EDF';
CF[0x1EE0] = '\u1EE1';
CF[0x1EE2] = '\u1EE3';
CF[0x1EE4] = '\u1EE5';
CF[0x1EE6] = '\u1EE7';
CF[0x1EE8] = '\u1EE9';
CF[0x1EEA] = '\u1EEB';
CF[0x1EEC] = '\u1EED';
CF[0x1EEE] = '\u1EEF';
CF[0x1EF0] = '\u1EF1';
CF[0x1EF2] = '\u1EF3';
CF[0x1EF4] = '\u1EF5';
CF[0x1EF6] = '\u1EF7';
CF[0x1EF8] = '\u1EF9';
CF[0x1F08] = '\u1F00';
CF[0x1F09] = '\u1F01';
CF[0x1F0A] = '\u1F02';
CF[0x1F0B] = '\u1F03';
CF[0x1F0C] = '\u1F04';
CF[0x1F0D] = '\u1F05';
CF[0x1F0E] = '\u1F06';
CF[0x1F0F] = '\u1F07';
CF[0x1F18] = '\u1F10';
CF[0x1F19] = '\u1F11';
CF[0x1F1A] = '\u1F12';
CF[0x1F1B] = '\u1F13';
CF[0x1F1C] = '\u1F14';
CF[0x1F1D] = '\u1F15';
CF[0x1F28] = '\u1F20';
CF[0x1F29] = '\u1F21';
CF[0x1F2A] = '\u1F22';
CF[0x1F2B] = '\u1F23';
CF[0x1F2C] = '\u1F24';
CF[0x1F2D] = '\u1F25';
CF[0x1F2E] = '\u1F26';
CF[0x1F2F] = '\u1F27';
CF[0x1F38] = '\u1F30';
CF[0x1F39] = '\u1F31';
CF[0x1F3A] = '\u1F32';
CF[0x1F3B] = '\u1F33';
CF[0x1F3C] = '\u1F34';
CF[0x1F3D] = '\u1F35';
CF[0x1F3E] = '\u1F36';
CF[0x1F3F] = '\u1F37';
CF[0x1F48] = '\u1F40';
CF[0x1F49] = '\u1F41';
CF[0x1F4A] = '\u1F42';
CF[0x1F4B] = '\u1F43';
CF[0x1F4C] = '\u1F44';
CF[0x1F4D] = '\u1F45';
CF[0x1F50] = '\u03C5\u0313';
CF[0x1F52] = '\u03C5\u0313\u0300';
CF[0x1F54] = '\u03C5\u0313\u0301';
CF[0x1F56] = '\u03C5\u0313\u0342';
CF[0x1F59] = '\u1F51';
CF[0x1F5B] = '\u1F53';
CF[0x1F5D] = '\u1F55';
CF[0x1F5F] = '\u1F57';
CF[0x1F68] = '\u1F60';
CF[0x1F69] = '\u1F61';
CF[0x1F6A] = '\u1F62';
CF[0x1F6B] = '\u1F63';
CF[0x1F6C] = '\u1F64';
CF[0x1F6D] = '\u1F65';
CF[0x1F6E] = '\u1F66';
CF[0x1F6F] = '\u1F67';
CF[0x1F80] = '\u1F00\u03B9';
CF[0x1F81] = '\u1F01\u03B9';
CF[0x1F82] = '\u1F02\u03B9';
CF[0x1F83] = '\u1F03\u03B9';
CF[0x1F84] = '\u1F04\u03B9';
CF[0x1F85] = '\u1F05\u03B9';
CF[0x1F86] = '\u1F06\u03B9';
CF[0x1F87] = '\u1F07\u03B9';
CF[0x1F88] = '\u1F00\u03B9';
CF[0x1F89] = '\u1F01\u03B9';
CF[0x1F8A] = '\u1F02\u03B9';
CF[0x1F8B] = '\u1F03\u03B9';
CF[0x1F8C] = '\u1F04\u03B9';
CF[0x1F8D] = '\u1F05\u03B9';
CF[0x1F8E] = '\u1F06\u03B9';
CF[0x1F8F] = '\u1F07\u03B9';
CF[0x1F90] = '\u1F20\u03B9';
CF[0x1F91] = '\u1F21\u03B9';
CF[0x1F92] = '\u1F22\u03B9';
CF[0x1F93] = '\u1F23\u03B9';
CF[0x1F94] = '\u1F24\u03B9';
CF[0x1F95] = '\u1F25\u03B9';
CF[0x1F96] = '\u1F26\u03B9';
CF[0x1F97] = '\u1F27\u03B9';
CF[0x1F98] = '\u1F20\u03B9';
CF[0x1F99] = '\u1F21\u03B9';
CF[0x1F9A] = '\u1F22\u03B9';
CF[0x1F9B] = '\u1F23\u03B9';
CF[0x1F9C] = '\u1F24\u03B9';
CF[0x1F9D] = '\u1F25\u03B9';
CF[0x1F9E] = '\u1F26\u03B9';
CF[0x1F9F] = '\u1F27\u03B9';
CF[0x1FA0] = '\u1F60\u03B9';
CF[0x1FA1] = '\u1F61\u03B9';
CF[0x1FA2] = '\u1F62\u03B9';
CF[0x1FA3] = '\u1F63\u03B9';
CF[0x1FA4] = '\u1F64\u03B9';
CF[0x1FA5] = '\u1F65\u03B9';
CF[0x1FA6] = '\u1F66\u03B9';
CF[0x1FA7] = '\u1F67\u03B9';
CF[0x1FA8] = '\u1F60\u03B9';
CF[0x1FA9] = '\u1F61\u03B9';
CF[0x1FAA] = '\u1F62\u03B9';
CF[0x1FAB] = '\u1F63\u03B9';
CF[0x1FAC] = '\u1F64\u03B9';
CF[0x1FAD] = '\u1F65\u03B9';
CF[0x1FAE] = '\u1F66\u03B9';
CF[0x1FAF] = '\u1F67\u03B9';
CF[0x1FB2] = '\u1F70\u03B9';
CF[0x1FB3] = '\u03B1\u03B9';
CF[0x1FB4] = '\u03AC\u03B9';
CF[0x1FB6] = '\u03B1\u0342';
CF[0x1FB7] = '\u03B1\u0342\u03B9';
CF[0x1FB8] = '\u1FB0';
CF[0x1FB9] = '\u1FB1';
CF[0x1FBA] = '\u1F70';
CF[0x1FBB] = '\u1F71';
CF[0x1FBC] = '\u03B1\u03B9';
CF[0x1FBE] = '\u03B9';
CF[0x1FC2] = '\u1F74\u03B9';
CF[0x1FC3] = '\u03B7\u03B9';
CF[0x1FC4] = '\u03AE\u03B9';
CF[0x1FC6] = '\u03B7\u0342';
CF[0x1FC7] = '\u03B7\u0342\u03B9';
CF[0x1FC8] = '\u1F72';
CF[0x1FC9] = '\u1F73';
CF[0x1FCA] = '\u1F74';
CF[0x1FCB] = '\u1F75';
CF[0x1FCC] = '\u03B7\u03B9';
CF[0x1FD2] = '\u03B9\u0308\u0300';
CF[0x1FD3] = '\u03B9\u0308\u0301';
CF[0x1FD6] = '\u03B9\u0342';
CF[0x1FD7] = '\u03B9\u0308\u0342';
CF[0x1FD8] = '\u1FD0';
CF[0x1FD9] = '\u1FD1';
CF[0x1FDA] = '\u1F76';
CF[0x1FDB] = '\u1F77';
CF[0x1FE2] = '\u03C5\u0308\u0300';
CF[0x1FE3] = '\u03C5\u0308\u0301';
CF[0x1FE4] = '\u03C1\u0313';
CF[0x1FE6] = '\u03C5\u0342';
CF[0x1FE7] = '\u03C5\u0308\u0342';
CF[0x1FE8] = '\u1FE0';
CF[0x1FE9] = '\u1FE1';
CF[0x1FEA] = '\u1F7A';
CF[0x1FEB] = '\u1F7B';
CF[0x1FEC] = '\u1FE5';
CF[0x1FF2] = '\u1F7C\u03B9';
CF[0x1FF3] = '\u03C9\u03B9';
CF[0x1FF4] = '\u03CE\u03B9';
CF[0x1FF6] = '\u03C9\u0342';
CF[0x1FF7] = '\u03C9\u0342\u03B9';
CF[0x1FF8] = '\u1F78';
CF[0x1FF9] = '\u1F79';
CF[0x1FFA] = '\u1F7C';
CF[0x1FFB] = '\u1F7D';
CF[0x1FFC] = '\u03C9\u03B9';
CF[0x200B] = '';
CF[0x200C] = '';
CF[0x200D] = '';
CF[0x20A8] = '\u0072\u0073';
CF[0x2102] = '\u0063';
CF[0x2103] = '\u00B0\u0063';
CF[0x2107] = '\u025B';
CF[0x2109] = '\u00B0\u0066';
CF[0x210B] = '\u0068';
CF[0x210C] = '\u0068';
CF[0x210D] = '\u0068';
CF[0x2110] = '\u0069';
CF[0x2111] = '\u0069';
CF[0x2112] = '\u006C';
CF[0x2115] = '\u006E';
CF[0x2116] = '\u006E\u006F';
CF[0x2119] = '\u0070';
CF[0x211A] = '\u0071';
CF[0x211B] = '\u0072';
CF[0x211C] = '\u0072';
CF[0x211D] = '\u0072';
CF[0x2120] = '\u0073\u006D';
CF[0x2121] = '\u0074\u0065\u006C';
CF[0x2122] = '\u0074\u006D';
CF[0x2124] = '\u007A';
CF[0x2126] = '\u03C9';
CF[0x2128] = '\u007A';
CF[0x212A] = '\u006B';
CF[0x212B] = '\u00E5';
CF[0x212C] = '\u0062';
CF[0x212D] = '\u0063';
CF[0x2130] = '\u0065';
CF[0x2131] = '\u0066';
CF[0x2133] = '\u006D';
CF[0x2160] = '\u2170';
CF[0x2161] = '\u2171';
CF[0x2162] = '\u2172';
CF[0x2163] = '\u2173';
CF[0x2164] = '\u2174';
CF[0x2165] = '\u2175';
CF[0x2166] = '\u2176';
CF[0x2167] = '\u2177';
CF[0x2168] = '\u2178';
CF[0x2169] = '\u2179';
CF[0x216A] = '\u217A';
CF[0x216B] = '\u217B';
CF[0x216C] = '\u217C';
CF[0x216D] = '\u217D';
CF[0x216E] = '\u217E';
CF[0x216F] = '\u217F';
CF[0x24B6] = '\u24D0';
CF[0x24B7] = '\u24D1';
CF[0x24B8] = '\u24D2';
CF[0x24B9] = '\u24D3';
CF[0x24BA] = '\u24D4';
CF[0x24BB] = '\u24D5';
CF[0x24BC] = '\u24D6';
CF[0x24BD] = '\u24D7';
CF[0x24BE] = '\u24D8';
CF[0x24BF] = '\u24D9';
CF[0x24C0] = '\u24DA';
CF[0x24C1] = '\u24DB';
CF[0x24C2] = '\u24DC';
CF[0x24C3] = '\u24DD';
CF[0x24C4] = '\u24DE';
CF[0x24C5] = '\u24DF';
CF[0x24C6] = '\u24E0';
CF[0x24C7] = '\u24E1';
CF[0x24C8] = '\u24E2';
CF[0x24C9] = '\u24E3';
CF[0x24CA] = '\u24E4';
CF[0x24CB] = '\u24E5';
CF[0x24CC] = '\u24E6';
CF[0x24CD] = '\u24E7';
CF[0x24CE] = '\u24E8';
CF[0x24CF] = '\u24E9';
CF[0x3371] = '\u0068\u0070\u0061';
CF[0x3373] = '\u0061\u0075';
CF[0x3375] = '\u006F\u0076';
CF[0x3380] = '\u0070\u0061';
CF[0x3381] = '\u006E\u0061';
CF[0x3382] = '\u03BC\u0061';
CF[0x3383] = '\u006D\u0061';
CF[0x3384] = '\u006B\u0061';
CF[0x3385] = '\u006B\u0062';
CF[0x3386] = '\u006D\u0062';
CF[0x3387] = '\u0067\u0062';
CF[0x338A] = '\u0070\u0066';
CF[0x338B] = '\u006E\u0066';
CF[0x338C] = '\u03BC\u0066';
CF[0x3390] = '\u0068\u007A';
CF[0x3391] = '\u006B\u0068\u007A';
CF[0x3392] = '\u006D\u0068\u007A';
CF[0x3393] = '\u0067\u0068\u007A';
CF[0x3394] = '\u0074\u0068\u007A';
CF[0x33A9] = '\u0070\u0061';
CF[0x33AA] = '\u006B\u0070\u0061';
CF[0x33AB] = '\u006D\u0070\u0061';
CF[0x33AC] = '\u0067\u0070\u0061';
CF[0x33B4] = '\u0070\u0076';
CF[0x33B5] = '\u006E\u0076';
CF[0x33B6] = '\u03BC\u0076';
CF[0x33B7] = '\u006D\u0076';
CF[0x33B8] = '\u006B\u0076';
CF[0x33B9] = '\u006D\u0076';
CF[0x33BA] = '\u0070\u0077';
CF[0x33BB] = '\u006E\u0077';
CF[0x33BC] = '\u03BC\u0077';
CF[0x33BD] = '\u006D\u0077';
CF[0x33BE] = '\u006B\u0077';
CF[0x33BF] = '\u006D\u0077';
CF[0x33C0] = '\u006B\u03C9';
CF[0x33C1] = '\u006D\u03C9';
CF[0x33C3] = '\u0062\u0071';
CF[0x33C6] = '\u0063\u2215\u006B\u0067';
CF[0x33C7] = '\u0063\u006F\u002E';
CF[0x33C8] = '\u0064\u0062';
CF[0x33C9] = '\u0067\u0079';
CF[0x33CB] = '\u0068\u0070';
CF[0x33CD] = '\u006B\u006B';
CF[0x33CE] = '\u006B\u006D';
CF[0x33D7] = '\u0070\u0068';
CF[0x33D9] = '\u0070\u0070\u006D';
CF[0x33DA] = '\u0070\u0072';
CF[0x33DC] = '\u0073\u0076';
CF[0x33DD] = '\u0077\u0062';
CF[0xFB00] = '\u0066\u0066';
CF[0xFB01] = '\u0066\u0069';
CF[0xFB02] = '\u0066\u006C';
CF[0xFB03] = '\u0066\u0066\u0069';
CF[0xFB04] = '\u0066\u0066\u006C';
CF[0xFB05] = '\u0073\u0074';
CF[0xFB06] = '\u0073\u0074';
CF[0xFB13] = '\u0574\u0576';
CF[0xFB14] = '\u0574\u0565';
CF[0xFB15] = '\u0574\u056B';
CF[0xFB16] = '\u057E\u0576';
CF[0xFB17] = '\u0574\u056D';
CF[0xFEFF] = '';
CF[0xFF21] = '\uFF41';
CF[0xFF22] = '\uFF42';
CF[0xFF23] = '\uFF43';
CF[0xFF24] = '\uFF44';
CF[0xFF25] = '\uFF45';
CF[0xFF26] = '\uFF46';
CF[0xFF27] = '\uFF47';
CF[0xFF28] = '\uFF48';
CF[0xFF29] = '\uFF49';
CF[0xFF2A] = '\uFF4A';
CF[0xFF2B] = '\uFF4B';
CF[0xFF2C] = '\uFF4C';
CF[0xFF2D] = '\uFF4D';
CF[0xFF2E] = '\uFF4E';
CF[0xFF2F] = '\uFF4F';
CF[0xFF30] = '\uFF50';
CF[0xFF31] = '\uFF51';
CF[0xFF32] = '\uFF52';
CF[0xFF33] = '\uFF53';
CF[0xFF34] = '\uFF54';
CF[0xFF35] = '\uFF55';
CF[0xFF36] = '\uFF56';
CF[0xFF37] = '\uFF57';
CF[0xFF38] = '\uFF58';
CF[0xFF39] = '\uFF59';
CF[0xFF3A] = '\uFF5A';

var copyrightFolding = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

/**
 * Does a case folding using CaseFolding.txt
 * @parameter str the source string
 * @return casefolded string
 */

function fold(str) {
    var result = "";
    for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);
        var f = CF[c];
        if (f == null) {
            result += str.charAt(i);
        } else {
            result += f;
        }
    }
    return result;
}

/**
 * Finds if there are any forbidden characters
 * @parameter str the source string
 * @return -1 if ok, otherwise the index of the first bad character
 */

function filter(str) {
    for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);
        if (NamePrepForbidden.contains(c)) return i;
    }
    return -1;
}

var copyrightInversions = "Copyright ? 2000 Mark Davis. All Rights Reserved.";

// Define objects

Inversion.prototype.rangeArray = [];
Inversion.prototype.opposite = 0;
Inversion.prototype.getLeast = Inversion_getLeast;
Inversion.prototype.getLeast2 = Inversion_getLeast2;
Inversion.prototype.contains = Inversion_contains;
Inversion.prototype.previous = Inversion_previousDifferent;
Inversion.prototype.next = Inversion_nextDifferent;
Inversion.prototype.makeOpposite = Inversion_makeOpposite;

InversionMap.prototype.inversion = null;
InversionMap.prototype.values = null;
InversionMap.prototype.at = InversionMap_at;

/**
 * Maps integers to a range (half-open).
 * When used as a set, even indices are IN, and odd are OUT.
 * @parameter rangeArray must be an array of monotonically increasing integer values, with at least one instance.
 */
function Inversion(rangeArray) {
    this.rangeArray = rangeArray;
    for (var i = 1; i < rangeArray.length; ++i) {
        if (rangeArray[i] == null) {
            rangeArray[i] = rangeArray[i - 1] + 1;
        } else if (!(rangeArray[i - 1] < rangeArray[i])) {
            alert("Array must be monotonically increasing! "
                + (i - 1) + ": " + rangeArray[i - 1]
                + ", " + i + ": " + rangeArray[i]);
            return;
        }
    }
}

/**
 * Creates opposite of this, that is: result.contains(c) iff !this.contains(c)
 * @return reversal of this
 */
function Inversion_makeOpposite() {
    var result = new Inversion(this.rangeArray);
    result.opposite = 1 ^ this.opposite;
    return result;
}

/**
 * @intValue probe value
 * @return true if probe is in the list, false otherwise.
 * Uses the fact than an inversion list
 * contains half-open ranges. An element is
 * in the list iff the smallest index is even
 */
function Inversion_contains(intValue) {
    return ((this.getLeast(intValue) & 1) == this.opposite);
}

/**
 * @intValue probe value
 * @return the largest index such that rangeArray[index] <= intValue.
 * If intValue < rangeArray[0], returns -1.
 */
function Inversion_getLeast(intValue) {
    var arr = this.rangeArray;
    var low = 0;
    var high = arr.length;
    while (high - low > 8) {
        var mid = (high + low) >> 1;
        if (arr[mid] <= intValue) {
            low = mid;
        } else {
            high = mid;
        }
    }
    for (; low < high; ++low) {
        if (intValue < arr[low]) {
            break;
        }
    }
    return low - 1;
}

/*document.mainForm.result.value = "intValue: " + intValue + "\u000D";
 if (false) document.mainForm.result.value +=
 "arr[" + low + "]=" + arr[low] +
 " arr[" + mid + "]=" + arr[mid] +
 " arr[" + high + "]=" + arr[high] + "\u000D";
 if (false) document.mainForm.result.value +=
 "arr[" + low + "]=" + arr[low] +
 " arr[" + high + "]=" + arr[high] + "\u000D";
 */

/**
 * @intValue probe value
 * @return the largest index such that rangeArray[index] <= intValue.
 * If intValue < rangeArray[0], returns -1.
 */
function Inversion_getLeast2(intValue) {
    var arr = this.rangeArray;
    var low = 0;
    var high = arr.length;
    for (; low < high; ++low) {
        if (intValue < arr[low]) {
            break;
        }
    }
    return low - 1;
}

/**
 * @intValue probe value
 * @return next greater probe value that would be different.
 * or null if it would be out of range
 */
function Inversion_nextDifferent(intValue, delta) {
//alert(intValue + ", " + this.rangeArray[this.getLeast(intValue) + 1]);
    return this.rangeArray[this.getLeast(intValue) + delta];
}

/**
 * @intValue probe value
 * @return previous lesser probe value that would be different.
 * or null if it would be out of range
 */
function Inversion_previousDifferent(intValue, delta) {
    return this.rangeArray[this.getLeast(intValue) - delta];
}

/**
 * Maps ranges to values.
 * @parameter rangeArray must be suitable for an Inversion.
 * @parameter valueArray is the list of corresponding values.
 * Length must be the same as rangeArray.
 */
function InversionMap(rangeArray, valueArray) {
    if (rangeArray.length != valueArray.length) {
        return; // error
    }
    this.inversion = new Inversion(rangeArray);
    this.values = valueArray;
}

/**
 * Gets value at range
 * @parameter intValue. Any integer value.
 * @return the value associated with that integer. null if before the first
 * item in the range.
 */
function InversionMap_at(intValue) {
    var index = this.inversion.getLeast(intValue);
    if (index < 0) return null;
    return this.values[index];
}


var NamePrepForbidden = new Inversion([
    0x0, 0x2D,
    0x2E, 0x30,
    0x3A, 0x41,
    0x5B, 0x61,
    0x7B, 0xA1,
    0x1680, 0x1681,
    0x2000, 0x200C,
    0x200E, 0x2010,
    0x2028, 0x2030,
    0x206A, 0x2070,
    0x2FF0, 0x3001,
    0xD800, 0xF900,
    0xFFF9, 0x10000,
    0x1FFFE, 0x20000,
    0x2FFFE, 0x30000,
    0x3FFFE, 0x40000,
    0x4FFFE, 0x50000,
    0x5FFFE, 0x60000,
    0x6FFFE, 0x70000,
    0x7FFFE, 0x80000,
    0x8FFFE, 0x90000,
    0x9FFFE, 0xA0000,
    0xAFFFE, 0xB0000,
    0xBFFFE, 0xC0000,
    0xCFFFE, 0xD0000,
    0xDFFFE, 0xE0000,
    0xEFFFE, 0x110000
]);

var whitespace = new Inversion([
    0x0009, 0x000E,	// White_space; # Cc;     5; <control>..
    0x0020, ,	//     ; White_space; # Zs;     1; SPACE
    0x0085, ,	//     ; White_space; # Cc;     1; <control>
    0x00A0, ,	//     ; White_space; # Zs;     1; NO-BREAK SPACE
    0x1680, ,	//     ; White_space; # Zs;     1; OGHAM SPACE MARK
    0x2000, 0x200C,	// White_space; # Zs;    12; EN QUAD..
    0x2028, 0x202A,	//     ; White_space; # Zp;     1; PARAGRAPH SEPARATOR
    0x202F, ,	//     ; White_space; # Zs;     1; NARROW NO-BREAK SPACE
    0x3000,	//; White_space; # Zs;     1; IDEOGRAPHIC SPACE
]);

// separate
//D800,DFFF,//   [SURROGATE CODES]
// E000,F8FF,//   [PRIVATE USE, PLANE 0]

var dashes = new Inversion([
    0x002D, 0x002E, //     ; Dash; # Pd;     1; HYPHEN-MINUS
    0x00AD, 0x00AE, //  ; Dash; # Pd;     1; SOFT HYPHEN
    0x058A, 0x058B, //  ; Dash; # Pd;     1; ARMENIAN HYPHEN
    0x1806, 0x1807, //  ; Dash; # Pd;     1; MONGOLIAN TODO SOFT HYPHEN
    0x2010, 0x2015, // Dash; # Pd;     6; HYPHEN..
    0x207B, 0x207C, //  ; Dash; # Sm;     1; SUPERSCRIPT MINUS
    0x208B, 0x208D, //  ; Dash; # Sm;     1; SUBSCRIPT MINUS
    0x2212, 0x2213, //  ; Dash; # Sm;     1; MINUS SIGN
    0x301C, 0x301d, //  ; Dash; # Pd;     1; WAVE DASH
    0x3030, 0x3031, //  ; Dash; # Pd;     1; WAVY DASH
    0xFE31, 0xFE32, // Dash; # Pd;     2; PRESENTATION FORM FOR VERTICAL EM DASH..
    0xFE58, 0xFE59, //  ; Dash; # Pd;     1; SMALL EM DASH
    0xFE63, 0xFE64, //  ; Dash; # Pd;     1; SMALL HYPHEN-MINUS
    0xFF0D, 0xFF0E //  ; Dash; # Pd;     1; FULLWIDTH HYPHEN-MINUS
]);

var noncharacter = new Inversion([
    0xD800, 0xE000,
    0xFFFE, 0x10000,
    0x1FFFE, 0x20000,
    0x2FFFE, 0x30000,
    0x3FFFE, 0x40000,
    0x4FFFE, 0x50000,
    0x5FFFE, 0x60000,
    0x6FFFE, 0x70000,
    0x7FFFE, 0x80000,
    0x8FFFE, 0x90000,
    0x9FFFE, 0xA0000,
    0xAFFFE, 0xB0000,
    0xBFFFE, 0xC0000,
    0xCFFFE, 0xD0000,
    0xDFFFE, 0xE0000,
    0xEFFFE, 0xF0000,
    0xFFFFE, 0x100000,
    0x10FFFE, 0x110000
]);

var privateUse = new Inversion([
    0xE000, 0xF900,
    0xF0000, 0xFFFFE,
    0x100000, 0x10FFFE
]);

var assigned = new Inversion([
    0, 544,
    546, 564,
    592, 686,
    688, 751,
    768, 847,
    864, 867,
    884, 886,
    890, 891,
    894, 895,
    900, 907,
    908, 909,
    910, 930,
    931, 975,
    976, 984,
    986, 1012,
    1024, 1159,
    1160, 1162,
    1164, 1221,
    1223, 1225,
    1227, 1229,
    1232, 1270,
    1272, 1274,
    1329, 1367,
    1369, 1376,
    1377, 1416,
    1417, 1419,
    1425, 1442,
    1443, 1466,
    1467, 1477,
    1488, 1515,
    1520, 1525,
    1548, 1549,
    1563, 1564,
    1567, 1568,
    1569, 1595,
    1600, 1622,
    1632, 1646,
    1648, 1774,
    1776, 1791,
    1792, 1806,
    1807, 1837,
    1840, 1867,
    1920, 1969,
    2305, 2308,
    2309, 2362,
    2364, 2382,
    2384, 2389,
    2392, 2417,
    2433, 2436,
    2437, 2445,
    2447, 2449,
    2451, 2473,
    2474, 2481,
    2482, 2483,
    2486, 2490,
    2492, 2493,
    2494, 2501,
    2503, 2505,
    2507, 2510,
    2519, 2520,
    2524, 2526,
    2527, 2532,
    2534, 2555,
    2562, 2563,
    2565, 2571,
    2575, 2577,
    2579, 2601,
    2602, 2609,
    2610, 2612,
    2613, 2615,
    2616, 2618,
    2620, 2621,
    2622, 2627,
    2631, 2633,
    2635, 2638,
    2649, 2653,
    2654, 2655,
    2662, 2677,
    2689, 2692,
    2693, 2700,
    2701, 2702,
    2703, 2706,
    2707, 2729,
    2730, 2737,
    2738, 2740,
    2741, 2746,
    2748, 2758,
    2759, 2762,
    2763, 2766,
    2768, 2769,
    2784, 2785,
    2790, 2800,
    2817, 2820,
    2821, 2829,
    2831, 2833,
    2835, 2857,
    2858, 2865,
    2866, 2868,
    2870, 2874,
    2876, 2884,
    2887, 2889,
    2891, 2894,
    2902, 2904,
    2908, 2910,
    2911, 2914,
    2918, 2929,
    2946, 2948,
    2949, 2955,
    2958, 2961,
    2962, 2966,
    2969, 2971,
    2972, 2973,
    2974, 2976,
    2979, 2981,
    2984, 2987,
    2990, 2998,
    2999, 3002,
    3006, 3011,
    3014, 3017,
    3018, 3022,
    3031, 3032,
    3047, 3059,
    3073, 3076,
    3077, 3085,
    3086, 3089,
    3090, 3113,
    3114, 3124,
    3125, 3130,
    3134, 3141,
    3142, 3145,
    3146, 3150,
    3157, 3159,
    3168, 3170,
    3174, 3184,
    3202, 3204,
    3205, 3213,
    3214, 3217,
    3218, 3241,
    3242, 3252,
    3253, 3258,
    3262, 3269,
    3270, 3273,
    3274, 3278,
    3285, 3287,
    3294, 3295,
    3296, 3298,
    3302, 3312,
    3330, 3332,
    3333, 3341,
    3342, 3345,
    3346, 3369,
    3370, 3386,
    3390, 3396,
    3398, 3401,
    3402, 3406,
    3415, 3416,
    3424, 3426,
    3430, 3440,
    3458, 3460,
    3461, 3479,
    3482, 3506,
    3507, 3516,
    3517, 3518,
    3520, 3527,
    3530, 3531,
    3535, 3541,
    3542, 3543,
    3544, 3552,
    3570, 3573,
    3585, 3643,
    3647, 3676,
    3713, 3715,
    3716, 3717,
    3719, 3721,
    3722, 3723,
    3725, 3726,
    3732, 3736,
    3737, 3744,
    3745, 3748,
    3749, 3750,
    3751, 3752,
    3754, 3756,
    3757, 3770,
    3771, 3774,
    3776, 3781,
    3782, 3783,
    3784, 3790,
    3792, 3802,
    3804, 3806,
    3840, 3912,
    3913, 3947,
    3953, 3980,
    3984, 3992,
    3993, 4029,
    4030, 4045,
    4047, 4048,
    4096, 4130,
    4131, 4136,
    4137, 4139,
    4140, 4147,
    4150, 4154,
    4160, 4186,
    4256, 4294,
    4304, 4343,
    4347, 4348,
    4352, 4442,
    4447, 4515,
    4520, 4602,
    4608, 4615,
    4616, 4679,
    4680, 4681,
    4682, 4686,
    4688, 4695,
    4696, 4697,
    4698, 4702,
    4704, 4743,
    4744, 4745,
    4746, 4750,
    4752, 4783,
    4784, 4785,
    4786, 4790,
    4792, 4799,
    4800, 4801,
    4802, 4806,
    4808, 4815,
    4816, 4823,
    4824, 4847,
    4848, 4879,
    4880, 4881,
    4882, 4886,
    4888, 4895,
    4896, 4935,
    4936, 4955,
    4961, 4989,
    5024, 5109,
    5121, 5751,
    5760, 5789,
    5792, 5873,
    6016, 6109,
    6112, 6122,
    6144, 6159,
    6160, 6170,
    6176, 6264,
    6272, 6314,
    7680, 7836,
    7840, 7930,
    7936, 7958,
    7960, 7966,
    7968, 8006,
    8008, 8014,
    8016, 8024,
    8025, 8026,
    8027, 8028,
    8029, 8030,
    8031, 8062,
    8064, 8117,
    8118, 8133,
    8134, 8148,
    8150, 8156,
    8157, 8176,
    8178, 8181,
    8182, 8191,
    8192, 8263,
    8264, 8270,
    8298, 8305,
    8308, 8335,
    8352, 8368,
    8400, 8420,
    8448, 8507,
    8531, 8580,
    8592, 8692,
    8704, 8946,
    8960, 9084,
    9085, 9115,
    9216, 9255,
    9280, 9291,
    9312, 9451,
    9472, 9622,
    9632, 9720,
    9728, 9748,
    9753, 9842,
    9985, 9989,
    9990, 9994,
    9996, 10024,
    10025, 10060,
    10061, 10062,
    10063, 10067,
    10070, 10071,
    10072, 10079,
    10081, 10088,
    10102, 10133,
    10136, 10160,
    10161, 10175,
    10240, 10496,
    11904, 11930,
    11931, 12020,
    12032, 12246,
    12272, 12284,
    12288, 12347,
    12350, 12352,
    12353, 12437,
    12441, 12447,
    12449, 12543,
    12549, 12589,
    12593, 12687,
    12688, 12728,
    12800, 12829,
    12832, 12868,
    12896, 12924,
    12927, 12977,
    12992, 13004,
    13008, 13055,
    13056, 13175,
    13179, 13278,
    13280, 13311,
    13312, 19894,
    19968, 40870,
    40960, 42125,
    42128, 42146,
    42148, 42164,
    42165, 42177,
    42178, 42181,
    42182, 42183,
    44032, 55204,
    55296, 64046,
    64256, 64263,
    64275, 64280,
    64285, 64311,
    64312, 64317,
    64318, 64319,
    64320, 64322,
    64323, 64325,
    64326, 64434,
    64467, 64832,
    64848, 64912,
    64914, 64968,
    65008, 65020,
    65056, 65060,
    65072, 65093,
    65097, 65107,
    65108, 65127,
    65128, 65132,
    65136, 65139,
    65140, 65141,
    65142, 65277,
    65279, 65280,
    65281, 65375,
    65377, 65471,
    65474, 65480,
    65482, 65488,
    65490, 65496,
    65498, 65501,
    65504, 65511,
    65512, 65519,
    65529, 65534,
    0xF0000
]);

var unassigned = assigned.makeOpposite();


var copyrightConvert = "Copyright ? 2000 Mark Davis. All Rights Reserved.";
var globalRadix = 16;
var cuArray = [];
var cpArray = [];
var utf16Array = [];
var parseResult = new ParseResult();
//var outputBytes = 1;
var outputBaseMap = [2, 10, 16];
var outputLength = 0;

//================

function convertUTF32MToUTF16m(inputValue) {
    // var form = document.mainForm;
    globalRadix = outputBaseMap [2];
    //form.mainTextOutput.value = "";
    // form.roundtrip.value = "";

    // first box
    //form.inputError.value = readInput(form.mainTextInput, form.inputFormat, 16, form.namePrep.checked);
    readInput(inputValue, 16);
    return writeOutput(globalRadix);
    //form.outputLen.value = outputLength ;
    //
    //// roundtrip
    //form.roundtripLen.value = "";
    //form.roundtripError.value = readInput(form.mainTextOutput, form.outputFormat, globalRadix, false);
    //if (form.roundtripError.value != "OK") return;
    //
    //form.roundtripError.value = writeOutput(form.roundtrip, form.inputFormat, 16);
    //if (form.roundtripError.value != "OK") return;
    //
    //if (form.roundtrip.value != form.mainTextInput.value) {
    //    form.roundtripError.value = "NO ROUND TRIP";
    //    return;
    //}
    //form.roundtripError.value = "OK";
    //form.roundtripLen.value = outputLength;
}

//================
//
function readInput(inputValue, radix) {
    var textInput = inputValue;
    parseResult.set();
    var npParseResult = null;
    //
    //if (namePrep) {
    //    textInput = fold(textInput);
    //    textInput = NFKC(textInput);
    //    var badPos = filter(textInput);
    //    if (badPos >= 0) {
    //        npParseResult = new ParseResult("Illegal NP character", badPos, textInput.charCodeAt(badPos));
    //    }
    //}

    var which = 4;
    cpArray.length = 0;

    switch (which) {
        case 0:
            fromText(textInput, cpArray, parseResult);
            break;
        case 1:
            radixToArray(textInput, cuArray, radix, parseResult);
            if (!parseResult.isError()) fromUTF8(cuArray, cpArray, parseResult);
            break;
        case 2:
        case 3:
            radixToArray(textInput, cuArray, radix, parseResult);
            if (parseResult.isError()) break;
            if (which == 3) joinFromBytes(cuArray, 2);
            fromUTF16(cuArray, cpArray, parseResult);
            break;
        case 4:
        case 5:
            radixToArray(textInput, cuArray, radix, parseResult);
            if (parseResult.isError()) break;
            if (which == 5) joinFromBytes(cuArray, 4);
            checkUTF32(cuArray, parseResult);
            copyAllTo(cuArray, cpArray);
            break;
        case 6:
        case 7:
        case 8:
        case 9:
            //debugger;
            if (which <= 7) {
                fromBase32String(textInput, utf16Array, parseResult);
                //alert(arrayToRadix(utf16Array, 16, 0xFF, " ", ""));
            } else {
                radixToArray(textInput, utf16Array, radix, parseResult);
            }
            if (parseResult.isError()) break;
            //alert("utf: " + utf16Array.join(", "));
            var len;
            if ((which % 2) == 0) {
                len = fromRACE(utf16Array, utf16Array.length, cuArray, parseResult);
            } else {
                len = fromLACE(utf16Array, utf16Array.length, cuArray, parseResult);
            }
            //alert("cu: " + cuArray.join(", "));
            if (parseResult.isError()) break;
            cuArray.length = len;
            joinFromBytes(cuArray, 2);
            //alert("bytes: " + cuArray.join(", "));
            fromUTF16(cuArray, cpArray, parseResult);
            break;
    }
    if (npParseResult != null) return npParseResult.toString();
    return parseResult.toString();
}

//================

function writeOutput(radix) {
    //output.value = "";
    var which = 0;
    var pattern = '@ ';
    //if (pattern.indexOf('@') < 0) {
    //    document.mainForm.pattern.value = pattern += '@';
    //}
    var str = "";
    var max = 0;

    switch (which) {
        case 0:
            str = toText(cpArray, parseResult);
            outputLength = str.length;
            break;
        case 1:
            toUTF8(cpArray, cuArray, parseResult);
            str = arrayToRadix(cuArray, radix, 0xFF, pattern);
            outputLength = cuArray.length;
            break;
        case 2:
        case 3:
            toUTF16(cpArray, cuArray, parseResult);
            max = 0xFFFF;
            if (which == 3) {
                breakIntoBytes(cuArray, 2);
                max = 0xFF;
            }
            str = arrayToRadix(cuArray, radix, max, pattern);
            outputLength = cuArray.length;
            break;
        case 4:
        case 5:
            checkUTF32(cpArray, parseResult);
            copyAllTo(cpArray, cuArray);
            max = 0xFFFFFFFF;
            if (which == 5) {
                breakIntoBytes(cuArray, 4);
                max = 0xFF;
            }
            str = arrayToRadix(cuArray, radix, max, pattern);
            outputLength = cuArray.length;
            break;
        case 6:
        case 7:
        case 8:
        case 9:
            toUTF16(cpArray, utf16Array, parseResult);
            //alert(utf16Array.join(", "));
            if (parseResult.isError()) break;
            breakIntoBytes(utf16Array, 2);
            //alert(utf16Array.join(", "));
            var len;
            if ((which % 2) == 0) {
                len = toRACE(utf16Array, utf16Array.length, cuArray, parseResult);
            } else {
                len = toLACE(utf16Array, utf16Array.length, cuArray, parseResult);
            }
            if (parseResult.isError()) break;
            cuArray.length = len;
            if (which > 7) {
                str = arrayToRadix(cuArray, radix, 0xFF, pattern);
                outputLength = cuArray.length;
            } else {
                str = toBase32String(cuArray, parseResult);
                //alert(arrayToRadix(cuArray, 16, 0xFF, " ", ""));
                outputLength = str.length;
            }
            break;
    }
    //output.value = str;
    //return parseResult.toString();
    //return str.length == 4 ? str + ' ' + 'FE0F' : str;
    return str;
}

//================


exports.convertUTF32MToUTF16m = convertUTF32MToUTF16m;