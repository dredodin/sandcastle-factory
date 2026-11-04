import { createServer } from "node:net";

const [path] = process.argv.slice(2);
if (!path) throw new Error("usage: listen.mts <pipe path>");
createServer().listen(path, () => console.log("up"));
