import fs from "fs";
import { SerialPort } from "serialport";
import intel_hex from "intel-hex";
import Stk500 from "../index.js";

const stk = new Stk500();

const data = fs.readFileSync("arduino-1.0.6/168/StandardFirmata.cpp.hex", {
  encoding: "utf8",
});

const hex = intel_hex.parse(data).data;

const board = {
  name: "Diecimila / Duemilanove 168",
  baud: 19200,
  signature: Buffer.from([0x1e, 0x94, 0x06]),
  pageSize: 128,
  timeout: 400,
};

function upload(path, done) {
  const serialPort = new SerialPort({
    path,
    baudRate: board.baud,
  });

  serialPort.on("open", function () {
    stk.bootload(serialPort, hex, board, false, function (error) {
      serialPort.close(function (error) {
        console.log(error);
      });

      done(error);
    });
  });
}

if (process && process.argv && process.argv[2]) {
  upload(process.argv[2], function (error) {
    if (!error) {
      console.log("programing SUCCESS!");
      process.exit(0);
    }
  });
} else {
  console.log("call with a path like /dev/tty.something");
  process.exit(0);
}
