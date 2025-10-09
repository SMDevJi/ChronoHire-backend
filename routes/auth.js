import express from "express";
import User from "../models/User.js";
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import dotenv from 'dotenv';
dotenv.config();

const generateOTP = () => crypto.randomInt(100000, 999999);
const otpValidMins = 1
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.APP_PASSWORD
    }
});

const router = express.Router()

router.post('/register', async (req, res) => {
    try {
        let { name, email, password } = req.body
        email = email.toLowerCase()

        const userExists = await User.findOne({ email: email })

        if (userExists) {
            return res.status(400).json({ success: false, message: "This email is already registered." })
        }

        let hashedPassword;
        const salt = await bcrypt.genSalt(10)
        hashedPassword = await bcrypt.hash(password, salt)

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + otpValidMins * 60 * 1000);

        await User.create({
            name, email, password: hashedPassword, otp, otpExpiry
        })

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: 'ChronoHire OTP Verification',
            html: `<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 40px;">
                        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                            <h2 style="color: #333333;">Your OTP Code</h2>
                            <p style="font-size: 16px; color: #555555;">Hi ${name},</p>
                            <p style="font-size: 16px; color: #555555;">
                            Your One-Time Password (OTP) is:
                            </p>
                            <p style="font-size: 32px; font-weight: bold; color: #007BFF; text-align: center; margin: 30px 0;">${otp}</p>
                            <p style="font-size: 14px; color: #999999;">
                            This code is valid for the next ${otpValidMins} minutes. If you did not request this, please ignore this email.
                            </p>
                            <hr style="margin: 40px 0;">
                            <p style="font-size: 12px; color: #cccccc; text-align: center;">
                            &copy; ${new Date().getFullYear()} ChronoHire. All rights reserved.
                            </p>
                        </div>
                    </div>
                        `
        });

        return res.status(200).json({ success: true, message: "User registered successfully.", otpValidMins })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Internal server error." })
    }


})






router.post('/verify-otp', async (req, res) => {
    try {
        let { email, otp } = req.body;
        email = email.toLowerCase()
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ success: false, message: 'User not found' });
        if (user.isVerified) return res.status(400).json({ success: false, message: 'User already verified' });

        if (user.otp !== Number(otp) || user.otpExpiry < new Date()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        const newToken = jwt.sign({
            id: user._id,
            name: user.name,
            email: user.email,
            picture: user.picture,
            coins: user.coins
        }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRESIN });

        res.status(200).json({ success: true, message: 'Email verified successfully.', authorization: newToken });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error verifying OTP', error });
    }
})





router.post('/resend-otp', async (req, res) => {
    try {
        let { email } = req.body;
        email = email.toLowerCase()
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ success: false, message: 'User not found' });
        if (user.isVerified) return res.status(400).json({ success: false, message: 'User already verified' });

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + otpValidMins * 60 * 1000);
        await user.save();

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: 'ChronoHire OTP Verification',
            html: `<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 40px;">
                        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                            <h2 style="color: #333333;">Your OTP Code</h2>
                            <p style="font-size: 16px; color: #555555;">Hi ${user.name},</p>
                            <p style="font-size: 16px; color: #555555;">
                            Your One-Time Password (OTP) is:
                            </p>
                            <p style="font-size: 32px; font-weight: bold; color: #007BFF; text-align: center; margin: 30px 0;">${otp}</p>
                            <p style="font-size: 14px; color: #999999;">
                            This code is valid for the next ${otpValidMins} minutes. If you did not request this, please ignore this email.
                            </p>
                            <hr style="margin: 40px 0;">
                            <p style="font-size: 12px; color: #cccccc; text-align: center;">
                            &copy; ${new Date().getFullYear()} ChronoHire. All rights reserved.
                            </p>
                        </div>
                    </div>
                        `
        });

        res.status(200).json({ success: true, message: 'OTP resent successfully.', otpValidMins });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: 'Error resending OTP', error });
    }
})










router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        email = email.toLowerCase();


        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const passwordCorrect = await bcrypt.compare(password, user.password);
        if (!passwordCorrect) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        if (!user.isVerified) {
            const otp = generateOTP();
            user.otp = otp;
            user.otpExpiry = new Date(Date.now() + otpValidMins * 60 * 1000);
            await user.save();

            await transporter.sendMail({
                from: process.env.EMAIL,
                to: email,
                subject: 'ChronoHire OTP Verification',
                html: `<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 40px;">
                        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                            <h2 style="color: #333333;">Your OTP Code</h2>
                            <p style="font-size: 16px; color: #555555;">Hi ${user.name},</p>
                            <p style="font-size: 16px; color: #555555;">
                            Your One-Time Password (OTP) is:
                            </p>
                            <p style="font-size: 32px; font-weight: bold; color: #007BFF; text-align: center; margin: 30px 0;">${otp}</p>
                            <p style="font-size: 14px; color: #999999;">
                            This code is valid for the next ${otpValidMins} minutes. If you did not request this, please ignore this email.
                            </p>
                            <hr style="margin: 40px 0;">
                            <p style="font-size: 12px; color: #cccccc; text-align: center;">
                            &copy; ${new Date().getFullYear()} ChronoHire. All rights reserved.
                            </p>
                        </div>
                    </div>
                        `
            });

            return res.status(403).json({ success: false, message: 'Email not verified. Please verify OTP.', otpValidMins });
        }
        const newToken = jwt.sign({
            id: user._id,
            name: user.name,
            email: user.email,
            picture: user.picture,
            coins: user.coins
        }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRESIN });

        return res.status(200).json({ success: true, authorization: newToken });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});






export default router