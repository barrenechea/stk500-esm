const { SerialPort } = require('serialport')
var intel_hex = require('intel-hex');
var Stk500 = require('..');
var fs = require('fs');

const stk = new Stk500();

var data = fs.readFileSync('arduino-2.3.3/nano/Blink.ino.hex', { encoding: 'utf8' });

var hex = intel_hex.parse(data).data;

var board = {
  name: "Arduino Nano",
  baud: 115200,
  signature: Buffer.from([0x1e, 0x95, 0x0f]),
  pageSize: 128,
  timeout: 400
};

function upload(path, done){
  const serialPort = new SerialPort({
    path,
    baudRate: board.baud,
  });

  serialPort.on('open', function(){
    stk.bootload(serialPort, hex, board, false, function(error){

      serialPort.close(function (error) {
        console.log(error);
      });

      done(error);
    });

  });

}

if(process && process.argv && process.argv[2])
{
  upload(process.argv[2], function(error){
    if(!error)
    {
      console.log("programing SUCCESS!");
      process.exit(0);
    }
  });
}else
{
  console.log("call with a path like /dev/tty.something");
  process.exit(0);
}