import { connect } from "node:net";

const [path] = process.argv.slice(2);
if (!path) throw new Error("usage: connect.mts <pipe path>");
connect(path).on("connect", () => {
	console.log(Date.now());
	process.exit();
});
