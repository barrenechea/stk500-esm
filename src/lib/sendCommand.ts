import receiveData from "./receiveData.js";
import Statics from "./statics.js";

type SendCommandOptions = {
  cmd: Buffer | number[];
  timeout?: number;
  responseData?: Buffer;
  responseLength?: number;
};

async function sendCommand(
  stream: NodeJS.ReadWriteStream,
  opt: SendCommandOptions
): Promise<Buffer> {
  const timeout = opt.timeout || 0;
  let responseData = null;
  let responseLength = 0;

  if (opt.responseData && opt.responseData.length > 0) {
    responseData = opt.responseData;
  }
  if (responseData) {
    responseLength = responseData.length;
  }
  if (opt.responseLength) {
    responseLength = opt.responseLength;
  }

  let cmd = opt.cmd;
  if (Array.isArray(cmd)) {
    cmd = Buffer.from(cmd.concat(Statics.Sync_CRC_EOP));
  }

  try {
    await new Promise<void>((resolve, reject) => {
      stream.write(cmd, (err) => {
        if (err) {
          reject(new Error(`Sending ${cmd.toString("hex")}: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    const data = await receiveData(stream, timeout, responseLength);

    if (responseData && !data.equals(responseData)) {
      throw new Error(
        `${cmd} response mismatch: ${data.toString(
          "hex"
        )}, ${responseData.toString("hex")}`
      );
    }

    return data;
  } catch (error: unknown) {
    throw new Error(
      `Sending ${cmd.toString("hex")}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export default sendCommand;
