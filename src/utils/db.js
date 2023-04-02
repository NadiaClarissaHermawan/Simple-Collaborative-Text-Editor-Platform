//import mongoose & create a connection to mongoDB
import mongoose from "mongoose";
await mongoose.connect('mongodb://127.0.0.1:27017/skripsi');

//import redis & create a connection to RedisDB
//TODO: host ganti ke IP address dari WSL nya, command untuk cek ip di ubuntu ip addr
import { createClient } from 'redis';
const Redis = createClient({ url: 'redis://:@127.0.0.1:6379' });
await Redis.connect();
export default Redis; 