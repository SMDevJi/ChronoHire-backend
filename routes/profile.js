import express from "express";
import User from "../models/User.js";
import dotenv from 'dotenv';
import authMiddleware from "../middleware/middleware.js";
import { deleteFile } from "../utils/cloudinary.js";
import jwt from 'jsonwebtoken'
dotenv.config();

const router = express.Router()



router.put('/update', authMiddleware, async (req, res) => {

    const { name, picture } = req.body;
    const userId = req.user.id;

    try {
        const oldUser=await User.findById(userId)
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, picture },
            { new: true }
        );

        if(oldUser.picture!=picture){
            await deleteFile(oldUser.picture)
        }
        
        const jwtToken = jwt.sign({
            id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            picture: updatedUser.picture,
            coins: updatedUser.coins
        }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRESIN });

        return res.status(200).json({ success: true, message: "Profile updated successfully.", updatedUser,authorization:jwtToken })
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Internal server error." })
    }
});



export default router