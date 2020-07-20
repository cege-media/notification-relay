const forever = require("forever-monitor");

const childFile = "app.js";
const child = new forever.Monitor(childFile, {
  max: 3,
  silent: false,
  args: [],
});

child.on("exit", function () {
  console.log(`${childFile} has exited after 3 restarts`);
});

child.start();
