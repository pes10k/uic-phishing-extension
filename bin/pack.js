var packer = require('packer');
var readline = require('readline');
var fs = require('fs');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', function (line) {
    var inputFileContents = fs.readFileSync(line, 'utf-8');
    var packedContents = packer.pack(inputFileContents, true);
    console.log(packedContents);
    // rl.write(packedContents);
});
