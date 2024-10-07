import receiveData from "./receiveData.js";
import Statics from "./statics.js";

function sendCommand(stream, opt, callback) {
  const timeout = opt.timeout || 0;
  const startingBytes = [Statics.Resp_STK_INSYNC, Statics.Resp_STK_NOSYNC];
  let responseData = null;
  let responseLength = 0;
  let error;

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
  if (cmd instanceof Array) {
    cmd = Buffer.from(cmd.concat(Statics.Sync_CRC_EOP));
  }

  const finish = receiveData(
    stream,
    timeout,
    responseLength,
    function (err, data) {
      if (err) {
        error = new Error(
          "Sending " + cmd.toString("hex") + ": " + err.message
        );
        return callback(error);
      }

      if (responseData && !data.equals(responseData)) {
        error = new Error(
          cmd +
            " response mismatch: " +
            data.toString("hex") +
            ", " +
            responseData.toString("hex")
        );
        return callback(error);
      }
      callback(null, data);
    }
  );

  stream.write(cmd, function (err) {
    if (err) {
      error = new Error("Sending " + cmd.toString("hex") + ": " + err.message);
      return finish(error);
    }
  });
}

export default sendCommand;
