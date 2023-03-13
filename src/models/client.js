//import mongoose
import { Schema } from "mongoose";
import Cursor from "./cursor.js";

//schema model
const Client = new Schema({
    name : String,
    cursor : Cursor 
});

export default Client;