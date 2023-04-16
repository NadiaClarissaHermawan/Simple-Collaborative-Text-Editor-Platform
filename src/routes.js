//import express
import express from 'express';

//import page controller
import {Home, TextEditor} from './controllers/routerController.js';

//init express router
const router = express.Router();

//Home route
router.get('/', Home);

//Text Editor route
router.get('/texteditor', TextEditor);

//create room route
// router.post('/createroom', CreateRoom);

//export all default router
export default router;
