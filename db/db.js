import { mongoose } from "mongoose";
import dotenv from 'dotenv';
dotenv.config();

const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log('[INFO] Connected to DB.\n\n\n')
    } catch (error) {
        console.log(`[ERROR] Failed to connect to DB: ${error}`)
    }
}

export default connectToDB