/**
 * ISO/IEC 18004 compliant QR Code generator.
 * Derived from Project Nayuki under MIT License.
 */

/**
 * String or binary
 */
export type QrCodeGenerateData = string | Readonly<Array<number>>;

export interface QrCodeGenerateOptions {
  /**
   * Error correction level
   *
   * L - Allows recovery of up to 7% data loss
   * M - Allows recovery of up to 15% data loss
   * Q - Allows recovery of up to 25% data loss
   * H - Allows recovery of up to 30% data loss
   *
   * @default 'L'
   */
  ecc?: 'L' | 'M' | 'Q' | 'H';
  /**
   * Mask pattern to use
   *
   * @default -1 (auto)
   */
  maskPattern?: number;
  /**
   */
  boostEcc?: boolean;
  /**
   * Minimum version of the QR code (1-40)
   * @default 1
   */
  minVersion?: number;
  /**
   * Maximum version of the QR code (1-40)
   * @default 40
   */
  maxVersion?: number;
  /**
   * Border around the QR code
   *
   * @default 1
   */
  border?: number;
  /**
   * Invert black and white
   */
  invert?: boolean;

  /**
   * Callback function to receive the generated QR Code
   */
  onEncoded?: (qr: QrCodeGenerateResult) => void;
}

export const QrCodeDataType = {
  Border: -1,
  Data: 0,
  Function: 1,
  Position: 2,
  Timing: 3,
  Alignment: 4,
} as const;
export type QrCodeDataType =
  (typeof QrCodeDataType)[keyof typeof QrCodeDataType];

export interface QrCodeGenerateResult {
  /**
   * QR Code version
   */
  version: number;
  /**
   * Width and height of the QR Code array
   */
  size: number;
  /**
   * Mask pattern used
   */
  maskPattern: number;
  /**
   * Two dimensional array representing the QR Code
   *
   * `true` for black, `false` for white
   */
  data: boolean[][];
  /**
   * Data type of each module
   */
  types: QrCodeDataType[][];
}

export interface QrCodeGenerateInvertableOptions extends QrCodeGenerateOptions {
  /**
   */
  invert?: boolean;
}

type QrInv = QrCodeGenerateInvertableOptions;
export interface QrCodeGenerateUnicodeOptions extends QrInv {
  /**
   * Character used to represent white modules in the QR code.
   */
  whiteChar?: string;
  /**
   * Character used to represent black modules in the QR code.
   */
  blackChar?: string;
}

export interface QrCodeGenerateSvgOptions extends QrCodeGenerateOptions {
  /**
   * Size of each pixel
   *
   * @default 10
   */
  pixelSize?: number;

  /**
   * Color of the white module
   *
   * @default 'white'
   */
  whiteColor?: string;

  /**
   * Color of the black module
   *
   * @default 'black'
   */
  blackColor?: string;
}

/*
 * QR Code generator library (TypeScript)
 *
 * Copyright (c) Project Nayuki. (MIT License)
 * https://www.nayuki.io/page/qr-code-generator-library
 *
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   Software.
 */

type bit = number;
type byte = number;
type int = number;
type QrCodeEcc = readonly [ordinal: int, formatBits: int];

/* -- Constants -- */

const LOW: QrCodeEcc = [0, 1];
const MEDIUM: QrCodeEcc = [1, 0];
const QUARTILE: QrCodeEcc = [2, 3];
const HIGH: QrCodeEcc = [3, 2];

export const EccMap = {
  L: LOW,
  M: MEDIUM,
  Q: QUARTILE,
  H: HIGH,
};

// Describes precisely all strings that are encodable in numeric mode.
const NUMERIC_REGEX = /^\d*$/;

// Describes precisely all strings that are encodable in alphanumeric mode.
const ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+./:-]*$/;

// The set of all legal characters in alphanumeric mode,
// where each character value maps to the index in the string.
const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// The minimum version number supported in the QR Code Model 2 standard.
const MIN_VERSION: int = 1;
// The maximum version number supported in the QR Code Model 2 standard.
const MAX_VERSION: int = 40;

// For use in getPenaltyScore(), when evaluating which mask is best.
const PENALTY_N1: int = 3;
const PENALTY_N2: int = 3;
const PENALTY_N3: int = 40;
const PENALTY_N4: int = 10;

const ECC_CODEWORDS_PER_BLOCK: Array<Array<int>> = [
  // Version: (note that index 0 is for padding, and is set to an illegal value)
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30,
    28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ], // Low
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26,
    26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28,
  ], // Medium
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28,
    26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ], // Quartile
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28,
    26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30,
  ], // High
];

const NUM_ERROR_CORRECTION_BLOCKS: Array<Array<int>> = [
  // Version: (note that index 0 is for padding, and is set to an illegal value)
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10,
    12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ], // Low
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17,
    17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ], // Medium
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23,
    23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ], // Quartile
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
    25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77,
    81,
  ], // High
];

/*
 * A QR Code symbol, which is a type of two-dimension barcode.
 * Invented by Denso Wave and described in the ISO/IEC 18004 standard.
 * from 1 to 40, all 4 error correction levels, and 4 character encoding modes.
 *
 * Ways to create a QR Code object:
 * - Low level: Custom-make the array of data codeword bytes (including
 *   segment headers and final padding, excluding error correction codewords),
 *   supply the appropriate version number, and call the QrCode() constructor.
 * (Note that all ways require supplying the desired error correction level.)
 */
export class QrCode {
  /* -- Fields -- */

  // The width and height of this QR Code, measured in modules, between
  // 21 and 177 (inclusive). This is equal to version * 4 + 17.
  public readonly size: int;

  // Even if a QR Code is created with automatic masking requested (mask = -1),
  // the resulting object still has a mask value between 0 and 7.
  public readonly mask: int;

  // The modules of this QR Code (false = light, true = dark).
  // Immutable after constructor finishes. Accessed through getModule().
  public readonly modules: boolean[][] = [];

  public readonly types: QrCodeDataType[][] = [];

  /* -- Constructor (low level) and fields -- */

  // Creates a new QR Code with the given version number,
  // error correction level, data codeword bytes, and mask number.
  // This is a low-level API that most users should not use directly.
  // A mid-level API is the encodeSegments() function.
  public constructor(
    // This determines the size of this barcode.
    public readonly version: int,
    // The error correction level used in this QR Code.
    public readonly ecc: QrCodeEcc,
    dataCodewords: Readonly<Array<byte>>,
    msk: int
  ) {
    // Check scalar arguments
    if (version < MIN_VERSION || version > MAX_VERSION)
      throw new RangeError('Version value out of range');
    if (msk < -1 || msk > 7) throw new RangeError('Mask value out of range');
    this.size = version * 4 + 17;

    // Initialize both grids to be size*size arrays of Boolean false
    const row = Array.from<boolean>({ length: this.size }).fill(false);
    for (let i = 0; i < this.size; i++) {
      this.modules.push(row.slice()); // Initially all light
      this.types.push(row.map(() => 0));
    }

    // Compute ECC, draw modules
    this.drawFunctionPatterns();
    const allCodewords: Array<byte> = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);

    // Do masking
    if (msk === -1) {
      // Automatically choose best mask
      let minPenalty: int = 1000000000;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty: int = this.getPenaltyScore();
        if (penalty < minPenalty) {
          msk = i;
          minPenalty = penalty;
        }
        this.applyMask(i); // Undoes the mask due to XOR
      }
    }
    assert(msk >= 0 && msk <= 7);
    this.mask = msk;
    this.applyMask(msk); // Apply the final choice of mask
    this.drawFormatBits(msk); // Overwrite old format bits

    // this.isFunction = [];
  }

  /* -- Accessor methods -- */

  // If the given coordinates are out of bounds, then false (light) is returned.
  public getModule(x: int, y: int): boolean {
    return (
      x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x]
    );
  }

  /* -- Private helper methods for constructor: Drawing function modules -- */

  private drawFunctionPatterns(): void {
    // Draw horizontal and vertical timing patterns
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0, QrCodeDataType.Timing);
      this.setFunctionModule(i, 6, i % 2 === 0, QrCodeDataType.Timing);
    }

    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    // Draw numerous alignment patterns
    const alignPatPos: Array<int> = this.getAlignmentPatternPositions();
    const numAlign: int = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        // Don't draw on the three finder corners

        if (!(
          (i === 0 && j === 0) ||
          (i === 0 && j === numAlign - 1) ||
          (i === numAlign - 1 && j === 0)
        ))
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
      }
    }

    // Draw configuration data
    this.drawFormatBits(0);
    this.drawVersion();
  }

  // Draws two copies of the format bits (with its own error correction code)
  // based on the given mask and this object's error correction level field.
  private drawFormatBits(mask: int): void {
    // Calculate error correction code and pack bits
    const data: int = (this.ecc[1] << 3) | mask;
    let rem: int = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412; // uint15
    assert(bits >>> 15 === 0);

    // Draw first copy
    for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++)
      this.setFunctionModule(14 - i, 8, getBit(bits, i));

    // Draw second copy
    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true); // Always dark
  }

  // Draws two copies of the version bits (with its own error correction code),
  // based on this object's version field, iff 7 <= version <= 40.
  private drawVersion(): void {
    if (this.version < 7) return;

    // Calculate error correction code and pack bits
    let rem: int = this.version; // version is uint6, in the range [7, 40]
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits: int = (this.version << 12) | rem; // uint18
    assert(bits >>> 18 === 0);

    // Draw two copies
    for (let i = 0; i < 18; i++) {
      const color: boolean = getBit(bits, i);
      const a: int = this.size - 11 + (i % 3);
      const b: int = Math.floor(i / 3);
      this.setFunctionModule(a, b, color);
      this.setFunctionModule(b, a, color);
    }
  }

  // Draws a 9*9 finder pattern including the border separator,
  // with the center module at (x, y). Modules can be out of bounds.
  private drawFinderPattern(x: int, y: int): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist: int = Math.max(Math.abs(dx), Math.abs(dy));
        const xx: int = x + dx;
        const yy: int = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size)
          this.setFunctionModule(
            xx,
            yy,
            dist !== 2 && dist !== 4,
            QrCodeDataType.Position
          );
      }
    }
  }

  // Draws a 5*5 alignment pattern, with the center module
  // at (x, y). All modules must be in bounds.
  private drawAlignmentPattern(x: int, y: int): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(
          x + dx,
          y + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          QrCodeDataType.Alignment
        );
      }
    }
  }

  // Sets the color of a module and marks it as a function module.
  // Only used by the constructor. Coordinates must be in bounds.
  private setFunctionModule(
    x: int,
    y: int,
    isDark: boolean,
    type: QrCodeDataType = QrCodeDataType.Function
  ): void {
    this.modules[y][x] = isDark;
    this.types[y][x] = type;
  }

  /* -- Private helper methods for constructor: Codewords and masking -- */

  private addEccAndInterleave(data: Readonly<Array<byte>>): Array<byte> {
    const ver: int = this.version;
    const ecl: QrCodeEcc = this.ecc;
    if (data.length !== getNumDataCodewords(ver, ecl))
      throw new RangeError('Invalid argument');

    // Calculate parameter numbers
    const numBlocks: int = NUM_ERROR_CORRECTION_BLOCKS[ecl[0]][ver];
    const blockEccLen: int = ECC_CODEWORDS_PER_BLOCK[ecl[0]][ver];
    const rawCodewords: int = Math.floor(getNumRawDataModules(ver) / 8);
    const numShortBlocks: int = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen: int = Math.floor(rawCodewords / numBlocks);

    // Split data into blocks and append ECC to each block
    const blocks: Array<Array<byte>> = [];
    const rsDiv: Array<byte> = reedSolomonComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat: Array<byte> = data.slice(
        k,
        k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1)
      );
      k += dat.length;
      const ecc: Array<byte> = reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    const result: Array<byte> = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        // Skip the padding byte in short blocks
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
          result.push(block[i]);
      });
    }
    assert(result.length === rawCodewords);
    return result;
  }

  private drawCodewords(data: Readonly<Array<byte>>): void {
    if (data.length !== Math.floor(getNumRawDataModules(this.version) / 8))
      throw new RangeError('Invalid argument');
    let i: int = 0; // Bit index into the data
    // Do the funny zigzag scan
    for (let right = this.size - 1; right >= 1; right -= 2) {
      // Index of right column in each column pair
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        // Vertical counter
        for (let j = 0; j < 2; j++) {
          const x: int = right - j; // Actual x coordinate
          const upward: boolean = ((right + 1) & 2) === 0;
          const y: int = upward ? this.size - 1 - vert : vert;
          if (!this.types[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
    assert(i === data.length * 8);
  }

  // XORs the codeword modules in this QR Code with the given mask pattern.
  // The function modules must be marked and the codeword bits must be drawn
  // before masking. Due to the arithmetic of XOR, calling applyMask() with
  // the same mask value a second time will undo the mask. A final well-formed
  // QR Code needs exactly one (not zero, two, etc.) mask applied.
  private applyMask(mask: int): void {
    if (mask < 0 || mask > 7) throw new RangeError('Mask value out of range');
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          case 7:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            throw new Error('Unreachable');
        }
        if (!this.types[y][x] && invert)
          this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  private getPenaltyScore(): int {
    let result: int = 0;

    // Adjacent modules in row having same color, and finder-like patterns
    for (let y = 0; y < this.size; y++) {
      let runColor = false;
      let runX = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < this.size; x++) {
        if (this.modules[y][x] === runColor) {
          runX++;
          if (runX === 5) result += PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result +=
        this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) *
        PENALTY_N3;
    }
    // Adjacent modules in column having same color, and finder-like patterns
    for (let x = 0; x < this.size; x++) {
      let runColor = false;
      let runY = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < this.size; y++) {
        if (this.modules[y][x] === runColor) {
          runY++;
          if (runY === 5) result += PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result +=
        this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) *
        PENALTY_N3;
    }

    // 2*2 blocks of modules having same color
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const color: boolean = this.modules[y][x];
        if (
          color === this.modules[y][x + 1] &&
          color === this.modules[y + 1][x] &&
          color === this.modules[y + 1][x + 1]
        ) {
          result += PENALTY_N2;
        }
      }
    }

    // Balance of dark and light modules
    let dark: int = 0;
    for (const row of this.modules)
      dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
    const total: int = this.size * this.size;
    const k: int = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    assert(k >= 0 && k <= 9);
    result += k * PENALTY_N4;
    assert(result >= 0 && result <= 2568888);
    return result;
  }

  /* -- Private helper functions -- */

  private getAlignmentPatternPositions(): Array<int> {
    if (this.version === 1) {
      return [];
    } else {
      const numAlign: int = Math.floor(this.version / 7) + 2;
      const step: int =
        this.version === 32
          ? 26
          : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
      const result: Array<int> = [6];
      for (let pos = this.size - 7; result.length < numAlign; pos -= step)
        result.splice(1, 0, pos);
      return result;
    }
  }

  // Can only be called immediately after a light run is added, and
  // returns either 0, 1, or 2. A helper function for getPenaltyScore().
  private finderPenaltyCountPatterns(runHistory: Readonly<Array<int>>): int {
    const n: int = runHistory[1];
    assert(n <= this.size * 3);
    const core: boolean =
      n > 0 &&
      runHistory[2] === n &&
      runHistory[3] === n * 3 &&
      runHistory[4] === n &&
      runHistory[5] === n;
    return (
      (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
      (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
    );
  }

  private finderPenaltyTerminateAndCount(
    currentRunColor: boolean,
    currentRunLength: int,
    runHistory: Array<int>
  ): int {
    if (currentRunColor) {
      // Terminate dark run
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      currentRunLength = 0;
    }
    currentRunLength += this.size; // Add light border to final run
    this.finderPenaltyAddHistory(currentRunLength, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  }

  private finderPenaltyAddHistory(
    currentRunLength: int,
    runHistory: Array<int>
  ): void {
    if (runHistory[0] === 0) currentRunLength += this.size;
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  }
}

// Appends the given number of low-order bits of the given value
// to the given buffer. Requires 0 <= len <= 31 and 0 <= val < 2^len.
function appendBits(val: int, len: int, bb: Array<bit>): void {
  if (len < 0 || len > 31 || val >>> len !== 0)
    throw new RangeError('Value out of range');
  for (let i = len - 1; i >= 0; i--)
    // Append bit by bit
    bb.push((val >>> i) & 1);
}

// Returns true iff the i'th bit of x is set to 1.
function getBit(x: int, i: int): boolean {
  return ((x >>> i) & 1) !== 0;
}

// Throws an exception if the given condition is false.
function assert(cond: boolean): void {
  if (!cond) throw new Error('Assertion error');
}

/* ---- Data segment class ---- */

/*
 * A segment of character/binary/control data in a QR Code symbol.
 * Instances of this class are immutable.
 * The mid-level way to create a segment is to take the payload data
 * and call a static factory function such as QrSegment.makeNumeric().
 * The low-level way to create a segment is to custom-make the bit buffer
 * and call the QrSegment() constructor with appropriate values.
 */
export class QrSegment {
  // Creates a new QR Code segment with the given attributes and data.
  public constructor(
    // The mode indicator of this segment.
    public readonly mode: QrSegmentMode,
    // The length of this segment's unencoded data. Measured in characters for
    // numeric/alphanumeric/kanji mode, bytes for byte mode, and 0 for ECI mode.
    // Always zero or positive. Not the same as the data's bit length.
    public readonly numChars: int,
    // The data bits of this segment. Accessed through getData().
    public readonly bitData: Array<bit>
  ) {
    if (numChars < 0) throw new RangeError('Invalid argument');
    this.bitData = bitData.slice(); // Make defensive copy
  }

  /* -- Methods -- */

  // Returns a new copy of the data bits of this segment.
  public getData(): Array<bit> {
    return this.bitData.slice(); // Make defensive copy
  }
}

/*
 * Describes how a segment's data bits are interpreted. Immutable.
 */
export type QrSegmentMode = [
  // The mode indicator bits, which is a uint4 value (range 0 to 15).
  modeBits: int,
  // Number of character count bits for three different version ranges.
  numBitsCharCount1: int,
  numBitsCharCount2: int,
  numBitsCharCount3: int,
];

const MODE_NUMERIC: QrSegmentMode = [0x1, 10, 12, 14];
const MODE_ALPHANUMERIC: QrSegmentMode = [0x2, 9, 11, 13];
const MODE_BYTE: QrSegmentMode = [0x4, 8, 16, 16];

function numCharCountBits(mode: QrSegmentMode, ver: int): int {
  return mode[Math.floor((ver + 7) / 17) + 1];
}

// ecl argument if it can be done without increasing the version.
export function encodeText(text: string, ecl: QrCodeEcc): QrCode {
  const segs: Array<QrSegment> = makeSegments(text);
  return encodeSegments(segs, ecl);
}

export function encodeBinary(
  data: Readonly<Array<byte>>,
  ecl: QrCodeEcc
): QrCode {
  const seg: QrSegment = makeBytes(data);
  return encodeSegments([seg], ecl);
}

// Returns a segment representing the given binary data encoded in
// byte mode. All input byte arrays are acceptable. Any text string
// can be converted to UTF-8 bytes and encoded as a byte mode segment.
export function makeBytes(data: Readonly<Array<byte>>): QrSegment {
  const bb: Array<bit> = [];
  for (const b of data) appendBits(b, 8, bb);
  return new QrSegment(MODE_BYTE, data.length, bb);
}

function makeNumeric(digits: string): QrSegment {
  if (!isNumeric(digits))
    throw new RangeError('String contains non-numeric characters');
  const bb: Array<bit> = [];
  for (let i = 0; i < digits.length;) {
    // Consume up to 3 digits per iteration
    const n: int = Math.min(digits.length - i, 3);
    appendBits(Number.parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
    i += n;
  }
  return new QrSegment(MODE_NUMERIC, digits.length, bb);
}

// The characters allowed are: 0 to 9, A to Z (uppercase only), space,
// dollar, percent, asterisk, plus, hyphen, period, slash, colon.
function makeAlphanumeric(text: string): QrSegment {
  if (!isAlphanumeric(text))
    throw new RangeError(
      'String contains unencodable characters in alphanumeric mode'
    );
  const bb: Array<bit> = [];
  let i: int;
  for (i = 0; i + 2 <= text.length; i += 2) {
    // Process groups of 2
    let temp: int = ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
    temp += ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
    appendBits(temp, 11, bb);
  }
  if (i < text.length)
    // 1 character remaining
    appendBits(ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
  return new QrSegment(MODE_ALPHANUMERIC, text.length, bb);
}

export function makeSegments(text: string): Array<QrSegment> {
  // Select the most efficient segment encoding automatically
  if (text === '') return [];
  else if (isNumeric(text)) return [makeNumeric(text)];
  else if (isAlphanumeric(text)) return [makeAlphanumeric(text)];
  else return [makeBytes(toUtf8ByteArray(text))];
}

// Tests whether the given string can be encoded as a segment in numeric mode.
// A string is encodable iff each character is in the range 0 to 9.
function isNumeric(text: string): boolean {
  return NUMERIC_REGEX.test(text);
}

function isAlphanumeric(text: string): boolean {
  return ALPHANUMERIC_REGEX.test(text);
}

function getTotalBits(segs: Readonly<Array<QrSegment>>, version: int): number {
  let result: number = 0;
  for (const seg of segs) {
    const ccbits: int = numCharCountBits(seg.mode, version);
    if (seg.numChars >= 1 << ccbits) return Number.POSITIVE_INFINITY;
    result += 4 + ccbits + seg.bitData.length;
  }
  return result;
}

// Returns a new array of bytes representing the given string encoded in UTF-8.
function toUtf8ByteArray(str: string): Array<byte> {
  str = encodeURI(str);
  const result: Array<byte> = [];
  for (let i = 0; i < str.length; i++) {
    if (str.charAt(i) !== '%') {
      result.push(str.charCodeAt(i));
    } else {
      result.push(Number.parseInt(str.substring(i + 1, i + 3), 16));
      i += 2;
    }
  }
  return result;
}

function getNumRawDataModules(ver: int): int {
  if (ver < MIN_VERSION || ver > MAX_VERSION)
    throw new RangeError('Version number out of range');
  let result: int = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign: int = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  assert(result >= 208 && result <= 29648);
  return result;
}

function getNumDataCodewords(ver: int, ecl: QrCodeEcc): int {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl[0]][ver] *
      NUM_ERROR_CORRECTION_BLOCKS[ecl[0]][ver]
  );
}

function reedSolomonComputeDivisor(degree: int): Array<byte> {
  if (degree < 1 || degree > 255) throw new RangeError('Degree out of range');
  const result: Array<byte> = [];
  for (let i = 0; i < degree - 1; i++) result.push(0);
  result.push(1); // Start off with the monomial x^0

  // and drop the highest monomial term which is always 1x^degree.
  let root = 1;
  for (let i = 0; i < degree; i++) {
    // Multiply the current product by (x - r^i)
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(
  data: Readonly<Array<byte>>,
  divisor: Readonly<Array<byte>>
): Array<byte> {
  const result: Array<byte> = divisor.map((_) => 0);
  for (const b of data) {
    // Polynomial division
    const factor: byte = b ^ (result.shift() as byte);
    result.push(0);
    divisor.forEach(
      (coef, i) => (result[i] ^= reedSolomonMultiply(coef, factor))
    );
  }
  return result;
}

function reedSolomonMultiply(x: byte, y: byte): byte {
  if (x >>> 8 !== 0 || y >>> 8 !== 0) throw new RangeError('Byte out of range');
  // Russian peasant multiplication
  let z: int = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  assert(z >>> 8 === 0);
  return z as byte;
}

// The smallest possible QR Code version within the given range is automatically
// chosen for the output. Iff boostEcl is true, then the ECC level of the result
// may be higher than the ecl argument if it can be done without increasing the
// version. The mask number is either between 0 to 7 (inclusive) to force that
// mask, or -1 to automatically choose an appropriate mask (which may be slow).
// between modes (such as alphanumeric and byte) to encode text in less space.
export function encodeSegments(
  segs: Readonly<Array<QrSegment>>,
  ecl: QrCodeEcc,
  minVersion: int = 1,
  maxVersion: int = 40,
  mask: int = -1,
  boostEcl: boolean = true
): QrCode {
  if (
    !(
      MIN_VERSION <= minVersion &&
      minVersion <= maxVersion &&
      maxVersion <= MAX_VERSION
    ) ||
    mask < -1 ||
    mask > 7
  ) {
    throw new RangeError('Invalid value');
  }

  // Find the minimal version number to use
  let version: int;
  let dataUsedBits: int;
  for (version = minVersion; ; version++) {
    const dataCapacityBits: int = getNumDataCodewords(version, ecl) * 8;
    const usedBits: number = getTotalBits(segs, version);
    if (usedBits <= dataCapacityBits) {
      dataUsedBits = usedBits;
      break; // This version number is found to be suitable
    }
    if (version >= maxVersion)
      // All versions in the range could not fit the given data
      throw new RangeError('Data too long');
  }

  for (const newEcl of [MEDIUM, QUARTILE, HIGH]) {
    // From low to high
    if (boostEcl && dataUsedBits <= getNumDataCodewords(version, newEcl) * 8)
      ecl = newEcl;
  }

  // Concatenate all segments to create the data bit string
  const bb: Array<bit> = [];
  for (const seg of segs) {
    appendBits(seg.mode[0], 4, bb);
    appendBits(seg.numChars, numCharCountBits(seg.mode, version), bb);
    for (const b of seg.getData()) bb.push(b);
  }
  assert(bb.length === dataUsedBits);

  // Add terminator and pad up to a byte if applicable
  const dataCapacityBits: int = getNumDataCodewords(version, ecl) * 8;
  assert(bb.length <= dataCapacityBits);
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
  appendBits(0, (8 - (bb.length % 8)) % 8, bb);
  assert(bb.length % 8 === 0);

  // Pad with alternating bytes until data capacity is reached
  for (let padByte = 0xec; bb.length < dataCapacityBits; padByte ^= 0xec ^ 0x11)
    appendBits(padByte, 8, bb);

  // Pack bits into bytes in big endian
  const dataCodewords = Array.from(
    { length: Math.ceil(bb.length / 8) },
    () => 0 as byte
  );
  bb.forEach(
    (b: bit, i: int) => (dataCodewords[i >>> 3] |= b << (7 - (i & 7)))
  );

  // Create the QR Code object
  return new QrCode(version, ecl, dataCodewords, mask);
}

/**
 * Encodes the given data into a QR code format according to the given options.
 */
export function encode(
  data: QrCodeGenerateData,
  options?: QrCodeGenerateOptions
): QrCodeGenerateResult {
  const {
    ecc = 'L',
    boostEcc = false,
    minVersion = 1,
    maxVersion = 40,
    maskPattern = -1,
    border = 1,
  } = options || {};

  const segment =
    typeof data === 'string'
      ? makeSegments(data)
      : Array.isArray(data)
        ? [makeBytes(data)]
        : undefined;

  if (!segment) throw new Error(`Invalid data type: ${typeof data}`);

  const qr = encodeSegments(
    segment,
    EccMap[ecc],
    minVersion,
    maxVersion,
    maskPattern,
    boostEcc
  );

  const result = addBorder(
    {
      version: qr.version,
      maskPattern: qr.mask,
      size: qr.size,
      data: qr.modules,
      types: qr.types,
    },
    border
  );

  if (options?.invert)
    result.data = result.data.map((row) => row.map((mod) => !mod));

  options?.onEncoded?.(result);

  return result;
}

function addBorder(
  input: QrCodeGenerateResult,
  border = 1
): QrCodeGenerateResult {
  if (!border) return input;

  const { size } = input;
  const newSize = size + border * 2;

  input.size = newSize;

  input.data.forEach((row) => {
    for (let i = 0; i < border; i++) {
      row.unshift(false);
      row.push(false);
    }
  });
  for (let i = 0; i < border; i++) {
    input.data.unshift(Array.from({ length: newSize }, (_) => false));
    input.data.push(Array.from({ length: newSize }, (_) => false));
  }

  const b = QrCodeDataType.Border;
  input.types.forEach((row) => {
    for (let i = 0; i < border; i++) {
      row.unshift(b);
      row.push(b);
    }
  });
  for (let i = 0; i < border; i++) {
    input.types.unshift(Array.from({ length: newSize }, (_) => b));
    input.types.push(Array.from({ length: newSize }, (_) => b));
  }

  return input;
}

/**
 * Returns the data value at a given coordinate in the QR code matrix.
 * @param {boolean[][]} data - The QR code data matrix.
 * @param {number} x - The x coordinate (column index) within the matrix.
 * @param {number} y - The y coordinate (row index) within the matrix.
 */
export function getDataAt(
  data: boolean[][],
  x: number,
  y: number,
  defaults = false
) {
  if (x < 0 || y < 0 || x >= data.length || y >= data.length) return defaults;
  return data[y][x];
}

export interface QROutput {
  matrix: boolean[][];
  size: number;
}

export interface QrSvgOptions {
  innerMargin?: number;
  frameWidth?: number;
  mainColor?: string;
  accentColor?: string;
  bgColor?: string;
  frameColor?: string;
  dotRadius?: number;
  finderRadius?: number;
}

export function generateQRCode(text: string): QROutput {
  const result = encode(text, { ecc: 'M', border: 0 });
  return {
    matrix: result.data,
    size: result.size,
  };
}

export function getQrSvg(text: string, margin = 4): string {
  const { matrix, size } = generateQRCode(text);
  const total = size + margin * 2;
  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        rects +=
          `<rect x="${c + margin}" y="${r + margin}" ` +
          `width="1" height="1" fill="#000"/>`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `${rects}</svg>`
  );
}

export function getStyledQrSvg(
  text: string,
  options: QrSvgOptions = {}
): string {
  const {
    innerMargin = 3,
    frameWidth = 1,
    mainColor = '#07164F',
    accentColor = '#C88200',
    bgColor = '#FAF6EE',
    frameColor = '#07164F',
    dotRadius = 0.46,
    finderRadius = 1.75,
  } = options;

  const qr = encode(text, { ecc: 'M', border: 0 });
  const size = qr.size;
  const margin = innerMargin + frameWidth;
  const total = size + margin * 2;

  const elements: string[] = [];

  // Outer brand frame
  elements.push(
    `<rect width="${total}" height="${total}" rx="3.5" fill="${frameColor}"/>`
  );

  // Inner warm champagne card
  const cardInset = frameWidth;
  const cardSize = total - 2 * frameWidth;
  elements.push(
    `<rect x="${cardInset}" y="${cardInset}" width="${cardSize}" ` +
      `height="${cardSize}" rx="2.5" fill="${bgColor}"/>`
  );

  // Finder patterns at top-left, top-right, and bottom-left
  const finders = [
    { x: 0, y: 0 },
    { x: size - 7, y: 0 },
    { x: 0, y: size - 7 },
  ];
  const isFinder = (c: number, r: number) =>
    finders.some((f) => c >= f.x && c < f.x + 7 && r >= f.y && r < f.y + 7);

  for (const f of finders) {
    const ox = f.x + margin + 0.5;
    const oy = f.y + margin + 0.5;
    // Outer rounded squircle ring
    elements.push(
      `<rect x="${ox}" y="${oy}" width="6" height="6" ` +
        `rx="${finderRadius}" ry="${finderRadius}" fill="none" ` +
        `stroke="${mainColor}" stroke-width="1"/>`
    );
    // Inner center circle
    const cx = f.x + margin + 3.5;
    const cy = f.y + margin + 3.5;
    elements.push(
      `<circle cx="${cx}" cy="${cy}" r="1.5" fill="${accentColor}"/>`
    );
  }

  // Detect 5x5 alignment pattern centers
  const alignCenters: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.types[r][c] === QrCodeDataType.Alignment) {
        let isCenter = true;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (
              nr < 0 ||
              nr >= size ||
              nc < 0 ||
              nc >= size ||
              qr.types[nr][nc] !== QrCodeDataType.Alignment
            ) {
              isCenter = false;
              break;
            }
          }
          if (!isCenter) break;
        }
        if (isCenter) {
          alignCenters.push({ x: c, y: r });
        }
      }
    }
  }

  const isAlignment = (c: number, r: number) =>
    alignCenters.some((a) => Math.abs(c - a.x) <= 2 && Math.abs(r - a.y) <= 2);

  // Render alignment patterns as rounded squircle ring with center dot
  for (const a of alignCenters) {
    const ax = a.x - 2 + margin + 0.5;
    const ay = a.y - 2 + margin + 0.5;
    elements.push(
      `<rect x="${ax}" y="${ay}" width="4" height="4" rx="1.0" ry="1.0" ` +
        `fill="none" stroke="${mainColor}" stroke-width="1"/>`
    );
    elements.push(
      `<circle cx="${a.x + margin + 0.5}" cy="${a.y + margin + 0.5}" ` +
        `r="${dotRadius}" fill="${mainColor}"/>`
    );
  }

  // Render data and timing modules as circular dots
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(c, r) || isAlignment(c, r)) continue;
      if (qr.data[r][c]) {
        const cx = c + margin + 0.5;
        const cy = r + margin + 0.5;
        elements.push(
          `<circle cx="${cx}" cy="${cy}" r="${dotRadius}" ` +
            `fill="${mainColor}"/>`
        );
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">` +
    elements.join('') +
    `</svg>`
  );
}
