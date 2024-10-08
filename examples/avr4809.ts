import fs from "fs/promises";
import { SerialPort } from "serialport";
import intel_hex from "intel-hex";
import Stk500 from "../src/index.js";

const stk = new Stk500();

const board = {
  name: "ATmega4809",
  baudRate: 19200,
  signature: Buffer.from([0x1e, 0x94, 0x06]),
  pageSize: 128,
  timeout: 400,
};

async function readHexFile(filePath) {
  const data = await fs.readFile(filePath, { encoding: "utf8" });
  return intel_hex.parse(data).data;
}

function createSerialPort(path, baudRate) {
  return new Promise((resolve, reject) => {
    const serialPort = new SerialPort({ path, baudRate });
    serialPort.on("open", () => resolve(serialPort));
    serialPort.on("error", reject);
  });
}

async function closeSerialPort(serialPort) {
  return new Promise<void>((resolve) => {
    serialPort.close((error) => {
      if (error) console.log(error);
      resolve();
    });
  });
}

async function upload(path) {
  let serialPort;
  try {
    const hex = await readHexFile("arduino-1.0.6/168/avr4809.cpp.hex");
    serialPort = await createSerialPort(path, board.baudRate);
    await stk.bootload(serialPort, hex, board, true);
    console.log("Programming SUCCESS!");
  } catch (error) {
    console.error("Programming failed:", error);
  } finally {
    if (serialPort) {
      await closeSerialPort(serialPort);
    }
  }
}

async function main() {
  if (process.argv[2]) {
    await upload(process.argv[2]);
  } else {
    console.log("Call with a path like /dev/tty.something");
  }
  process.exit(0);
}

main().catch(console.error);
