// Ported from https://github.com/bminer/intel-hex.js

const DATA = 0;
const END_OF_FILE = 1;
const EXT_SEGMENT_ADDR = 2;
const START_SEGMENT_ADDR = 3;
const EXT_LINEAR_ADDR = 4;
const START_LINEAR_ADDR = 5;

const EMPTY_VALUE = 0xff;

/**
 * Represents the result of parsing Intel HEX data.
 */
interface ParseResult {
  /** The parsed data as a Buffer. */
  data: Buffer;
  /** The start segment address, if present in the HEX data. */
  startSegmentAddress: number | null;
  /** The start linear address, if present in the HEX data. */
  startLinearAddress: number | null;
}

/**
 * Parses Intel HEX format data into a binary buffer.
 *
 * @param data - The Intel HEX data to parse, as a string or Buffer.
 * @param bufferSize - The initial size of the buffer to allocate (default: 8192).
 * @param addressOffset - An offset to apply to all addresses in the HEX data (default: 0).
 * @returns An object containing the parsed binary data and any start addresses found.
 * @throws Will throw an error if the HEX data is invalid or parsing fails.
 */
export default function parseIntelHex(
  data: string | Buffer,
  bufferSize?: number,
  addressOffset?: number
): ParseResult {
  if (data instanceof Buffer) {
    data = data.toString("ascii");
  }

  let buf = Buffer.alloc(bufferSize ?? 8192);
  let bufLength = 0;
  let highAddress = 0;
  let startSegmentAddress: number | null = null;
  let startLinearAddress: number | null = null;
  const offset = addressOffset ?? 0;
  let lineNum = 0;
  let pos = 0;

  const SMALLEST_LINE = 11;
  while (pos + SMALLEST_LINE <= data.length) {
    if (data[pos++] !== ":") {
      throw new Error(`Line ${lineNum + 1} does not start with a colon (:).`);
    }
    lineNum++;

    const dataLength = parseInt(data.slice(pos, pos + 2), 16);
    pos += 2;
    const lowAddress = parseInt(data.slice(pos, pos + 4), 16);
    pos += 4;
    const recordType = parseInt(data.slice(pos, pos + 2), 16);
    pos += 2;
    const dataField = data.slice(pos, pos + dataLength * 2);
    const dataFieldBuf = Buffer.from(dataField, "hex");
    pos += dataLength * 2;
    const checksum = parseInt(data.slice(pos, pos + 2), 16);
    pos += 2;

    let calcChecksum =
      (dataLength + (lowAddress >> 8) + lowAddress + recordType) & 0xff;
    for (let i = 0; i < dataLength; i++) {
      calcChecksum = (calcChecksum + dataFieldBuf[i]) & 0xff;
    }
    calcChecksum = (0x100 - calcChecksum) & 0xff;

    if (checksum !== calcChecksum) {
      throw new Error(
        `Invalid checksum on line ${lineNum}: got ${checksum}, but expected ${calcChecksum}`
      );
    }

    switch (recordType) {
      case DATA: {
        const absoluteAddress = highAddress + lowAddress - offset;
        if (absoluteAddress + dataLength >= buf.length) {
          const tmp = Buffer.alloc((absoluteAddress + dataLength) * 2);
          buf.copy(tmp, 0, 0, bufLength);
          tmp.fill(EMPTY_VALUE, bufLength, absoluteAddress);
          dataFieldBuf.copy(tmp, absoluteAddress);
          bufLength = Math.max(bufLength, absoluteAddress + dataLength);
          buf = tmp;
        } else {
          if (absoluteAddress > bufLength) {
            buf.fill(EMPTY_VALUE, bufLength, absoluteAddress);
          }
          dataFieldBuf.copy(buf, absoluteAddress);
          bufLength = Math.max(bufLength, absoluteAddress + dataLength);
        }
        if (bufLength >= (bufferSize || 8192)) {
          return {
            data: buf.subarray(0, bufLength),
            startSegmentAddress,
            startLinearAddress,
          };
        }
        break;
      }
      case END_OF_FILE:
        if (dataLength !== 0) {
          throw new Error(`Invalid EOF record on line ${lineNum}.`);
        }
        return {
          data: buf.subarray(0, bufLength),
          startSegmentAddress,
          startLinearAddress,
        };
      case EXT_SEGMENT_ADDR:
        if (dataLength !== 2 || lowAddress !== 0) {
          throw new Error(
            `Invalid extended segment address record on line ${lineNum}.`
          );
        }
        highAddress = parseInt(dataField, 16) << 4;
        break;
      case START_SEGMENT_ADDR:
        if (dataLength !== 4 || lowAddress !== 0) {
          throw new Error(
            `Invalid start segment address record on line ${lineNum}.`
          );
        }
        startSegmentAddress = parseInt(dataField, 16);
        break;
      case EXT_LINEAR_ADDR:
        if (dataLength !== 2 || lowAddress !== 0) {
          throw new Error(
            `Invalid extended linear address record on line ${lineNum}.`
          );
        }
        highAddress = parseInt(dataField, 16) << 16;
        break;
      case START_LINEAR_ADDR:
        if (dataLength !== 4 || lowAddress !== 0) {
          throw new Error(
            `Invalid start linear address record on line ${lineNum}.`
          );
        }
        startLinearAddress = parseInt(dataField, 16);
        break;
      default:
        throw new Error(
          `Invalid record type (${recordType}) on line ${lineNum}`
        );
    }

    if (data[pos] === "\r") pos++;
    if (data[pos] === "\n") pos++;
  }

  throw new Error("Unexpected end of input: missing or invalid EOF record.");
}
