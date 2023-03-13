//import express
import express from "express";

//import server 
import socket from "./server-ws.js";

//import router
import Router from "./routes.js";

//import mongoose 
import "./utils/db.js";

//init express
const app = express();
const EXPRESS_PORT = 80;

//use router middleware
app.use(Router);

//use ejs view engine
app.set('view engine', 'ejs');

//set static folder (giving global access for a folder)
app.use(express.static('public'));
app.use(express.static('views'));

//port
app.listen(EXPRESS_PORT, () => console.log('Express running at port ' + EXPRESS_PORT + '.'));




