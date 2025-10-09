import mongoose, { Schema, model } from "mongoose";

const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: "" },
    picture: { type: String, default: "" },
    otp: { type: Number },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    coins: { type: Number, default: 100 }
})

const userModel = model('user', userSchema)
export default userModel