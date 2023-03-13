//import mongoose
import { Schema } from "mongoose";

//schema model
const Cursor = new Schema({
    line : Number,
    caret : Number,
    color : String,
    status : Number
});

export default Cursor;