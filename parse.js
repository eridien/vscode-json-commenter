"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findInsertablePositions = findInsertablePositions;
let jsonText = '';
function findInsertablePositions(document) {
    jsonText = document.getText();
    let state = 'default';
    let inKey = false; // Tracks if the parser is inside a key
    let inValue = false; // Tracks if the parser is inside a value
    let braceDepth = 0;
    let bracketDepth = 0;
    for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        console.log(`${char}   ${state.padEnd(10)} ${braceDepth} ${bracketDepth} ${inKey} ${inValue}`);
        switch (state) {
            case 'default':
                if (char === '{') {
                    state = 'inObject';
                    braceDepth++;
                    console.log('*'); // Allow insertion after the opening brace
                }
                else if (char === '[') {
                    state = 'inArray';
                    bracketDepth++;
                }
                else if (char === '"') {
                    state = 'inString';
                    inKey = true; // Assume entering a key when starting a string in an object
                }
                break;
            case 'inString':
                if (char === '"' && jsonText[i - 1] !== '\\') {
                    state = 'default';
                    if (inKey) {
                        inKey = false; // Exiting a key
                    }
                    else if (inValue) {
                        inValue = false; // Exiting a value
                    }
                }
                break;
            case 'inObject':
                if (char === '}') {
                    braceDepth--;
                    if (braceDepth === 0) {
                        state = 'default';
                    }
                    console.log('*'); // Allow insertion before the closing brace
                }
                else if (char === ',') {
                    console.log('*'); // Allow insertion after a comma
                    inKey = true; // After a comma, expect a new key
                    console.log('*'); // Mark position after the comma
                }
                else if (char === ':') {
                    inKey = false; // End of key
                    inValue = true; // Start of value
                }
                else if (char === '"') {
                    state = 'inString';
                    if (!inKey && !inValue) {
                        inKey = true; // Entering a key
                    }
                }
                break;
            case 'inArray':
                if (char === ']') {
                    bracketDepth--;
                    if (bracketDepth === 0) {
                        state = 'default';
                    }
                    console.log('*'); // Allow insertion before the closing bracket
                }
                else if (char === ',') {
                    console.log('*'); // Allow insertion after a comma
                }
                else if (char === '"') {
                    state = 'inString';
                    inValue = true; // Strings in arrays are values
                }
                break;
        }
    }
}
//# sourceMappingURL=parse.js.map