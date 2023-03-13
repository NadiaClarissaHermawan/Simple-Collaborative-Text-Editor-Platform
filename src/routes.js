//import express
import express from "express";

//import page controller
import {Home, TextEditor} from "./controllers/pages.js";

//init express router
const router = express.Router();

import Room from "./models/room.js";
// router.get('/hehe', (req, res) =>{
//     Room.find().then((room) => {
//         res.send(room);
//     })
// });

//Home route
router.get('/', Home);

//Text Editor route
router.get('/texteditor', TextEditor);

//export all default router
export default router;
