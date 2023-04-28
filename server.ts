import { VTChatConfig } from "./src/VTChat/VTChatConfig.js";
import { VTChatServer } from "./src/VTChat/VTChatServer.js";
import { readFileSync } from "fs";

const port = VTChatConfig.listenPort;

const pKey = readFileSync( './SSL/key.pem' ).toString();
const cert = readFileSync( './SSL/cert.pem' ).toString();

VTChatConfig.cert = cert;
VTChatConfig.pKey = pKey;

let standalone = false;

process.argv.forEach(function (val, index, array) {
    if(val==="--standalone") standalone = true;
});

const server = new VTChatServer(port, standalone);

console.log("Server started "+(standalone ? "in standalone mode " : "in development mode ")+"["+port+"]. Rooms: ", server.rooms)