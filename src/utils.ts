export function invBase4ToNumber(str:String) {
  const digitMap: { [key: string]: number } = {
    '\u200B': 0, // Zero Width Space
    '\u200C': 1, // Zero Width Non-Joiner
    '\u200D': 2, // Zero Width Joiner
    '\u2060': 3  // Word Joiner
  };
  let num = 0;
  for (const char of str) {
    const digit = digitMap[char];
    if (digit === undefined)
      throw new Error('Invalid character in zero-width base-4 string');
    num = num * 4 + digit;
  }
  return num;
}

export function numberToInvBase4(num :number) {
  const zeroWidthDigits = ['\u200B', '\u200C', '\u200D', '\u2060'];
  if (num === 0) return zeroWidthDigits[0];
  let result = '';
  while (num > 0) {
    const digit = num % 4;
    result = zeroWidthDigits[digit] + result;
    num = Math.floor(num / 4);
  }
  return result;
}

