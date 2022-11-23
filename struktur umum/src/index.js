//import express
import express from "express";

//init express
const app = express();
const PORT = 80;

//import & use router middleware
import Router from "./routes.js";
app.use(Router);

//use ejs view engine
app.set('view engine', 'ejs');

//set static folder (access to public folder for media etc)
app.use(express.static('public'));

//port
app.listen(PORT, () => console.log('Server running at port ' + PORT + '.'));

//TODO: LAST HERE
//--------------------------------------
const socket = new WebSocket("wss://javascript.info");
socket.onopen = function(e) {
    alert("[open] Connection established");
    alert("Sending to server");
    socket.send("My name is John");
};

socket.onmessage = function(event) {
    alert(`[message] Data received from server: ${event.data}`);
};

socket.onclose = function(event) {
    if (event.wasClean) {
        alert(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        alert('[close] Connection died');
    }
};

socket.onerror = function(error) {
    alert(`[error]`);
};