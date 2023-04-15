//import express
import express from "express";

//import server 
import ServerWs from "./server-ws.js";
const socket = new ServerWs(81);
socket.initialize();

//import body-parser (for Express@4)
import bp from "body-parser";

//import router
import Router from "./routes.js";

//import mongoose 
import "./utils/db.js";

//init express
const app = express();
const EXPRESS_PORT = 80;

//use body-parser to parse incoming request and extract the body
app.use(bp.json());

//use ejs view engine
app.set('view engine', 'ejs');

//set static folder (giving global access for a folder)
app.use(express.static('public'));
app.use(express.static('views'));

//use router middleware
app.use(Router);

//port
app.listen(EXPRESS_PORT, () => console.log('Express running at port ' + EXPRESS_PORT + '.'));




