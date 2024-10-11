import fs from "fs/promises";
import { SerialPort } from "serialport";
import STK500, { type Board } from "../src/index.js";

const board: Board = {
  name: "Arduino Uno",
  baudRate: 115200,
  signature: new Uint8Array([0x1e, 0x95, 0x0f]),
  pageSize: 128,
  timeout: 400,
};

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
    const hex = await fs.readFile("arduino-1.0.6/uno/StandardFirmata.cpp.hex", {
      encoding: "utf8",
    });
    serialPort = await createSerialPort(path, board.baudRate);
    const stk = new STK500(serialPort, board);
    await stk.bootload(hex);
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
