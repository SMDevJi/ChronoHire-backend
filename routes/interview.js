import express from "express";
import Interview from "../models/Interview.js";
import User from "../models/User.js";
import { generateAIQA, extractResumeText, evaluateAnswers } from "../utils/utils.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import authMiddleware from "../middleware/middleware.js";
import mongoose from "mongoose";

const router = express.Router();

const INTERVIEW_COST = process.env.INTERVIEW_COST

// Setup multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });




/**
 * Create new interview
 * POST /api/interviews/create
 */
router.post("/create", upload.single("resumeFile"), authMiddleware, async (req, res) => {
    try {
        const { role, description, yearsOfExperience, difficulty } = req.body;
        const userId = req.user.id
        //console.log(userId, role, description, yearsOfExperience, difficulty)
        const resumeFile = req.file;



        // 1️⃣ Extract resume
        const resumeText = await extractResumeText(resumeFile.path);
        //console.log(resumeText)


        // 2️⃣ Generate 7 AI questions (5 job + 2 resume)
        const questions = await generateAIQA(role, description, resumeText, difficulty, yearsOfExperience);

        //console.log(questions)

        // 3️⃣ Create new interview
        const interview = new Interview({
            userId,
            role,
            description,
            resumeText,
            resumeUpdatedAt: new Date(),
            lastAttempt: {
                difficulty,
                yearsOfExperience,
                questions,
                overallEvaluation: null,
                overallScore: null,
                duration: 0
            },
            previousAttempts: []
        });

        await interview.save();

        res.status(201).json({
            success: true,
            message: "Interview created successfully",
            interviewId: interview._id,
            questions: interview.lastAttempt.questions
        });

        if(resumeFile){
            await fsp.unlink(resumeFile.path);
        }
        

    } catch (error) {
        console.error("Error creating interview:", error);
        //delete resume file
        if (req.file && req.file.path) {
            try {
                await fsp.unlink(req.file.path);
            } catch (err) {
                console.error("Failed to delete resume file after error:", err);
            }
        }
        res.status(500).json({ success: false, message: "Internal Server error" });
    }
});




// GET all interviews of a user (summary)
//api/interviews/get-user
router.get("/get-user", authMiddleware, async (req, res) => {
    //console.log("first")
    try {
        //console.log(req.user.id)
        const userId = req.user.id;

        // Fetch only the fields we need
        const interviews = await Interview.find({ userId })
            .select("role description createdAt lastAttempt.yearsOfExperience")
            .sort({ createdAt: -1 }); // latest first

        const formatted = interviews.map(interview => ({
            id: interview._id,
            role: interview.role,
            description: interview.description,
            yearsOfExperience: interview.lastAttempt?.yearsOfExperience || null,
            createdAt: interview.createdAt
        }));

        res.status(200).json({ success: true, interviews: formatted });

    } catch (error) {
        console.error("Error fetching user interviews:", error);
        res.status(500).json({ success: false, message: "Internal Server error lol." });
    }
});










/**
 * Submit interview attempt (evaluate answers)
 * POST /api/interviews/submit/:id
 */
router.post("/submit/:id", authMiddleware, async (req, res) => {

    try {
        const { id } = req.params;
        const { answers, duration } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent negative coins
        if (user.coins < 10) {
            return res.status(400).json({ success: false, message: "Not enough coins" });
        }


        const interview = await Interview.findById(id);
        if (!interview) {
            return res.status(404).json({ success: false, message: "Interview not found" });
        }

        if (interview.userId != req.user.id) {
            return res.status(403).json({ success: false, message: "You are not allowed to submit this interview!" });
        }

        const currentAttempt = interview.lastAttempt;
        if (!currentAttempt) {
            return res.status(400).json({ success: false, message: "No attempt to submit" });
        }

        //console.log(id,answers,duration)
        // Merge answers into questions
        const answeredQuestions = currentAttempt.questions.map(q => {
            const ans = answers.find(a => a._id == q._id.toString());
            return {
                ...q.toObject(),
                transcript: ans?.transcript || ""
            };
        });

        //console.log(answeredQuestions)
        // // Evaluate with AI
        const { evaluatedQuestions, overallEvaluation, overallScore } = await evaluateAnswers(answeredQuestions);
        console.log(evaluatedQuestions, overallEvaluation, overallScore)

        // Move old evaluated attempt into previousAttempts
        if (currentAttempt.overallEvaluation) {
            interview.previousAttempts.push(currentAttempt);
        }

        // Save evaluated attempt as lastAttempt
        interview.lastAttempt = {
            ...currentAttempt.toObject(),
            questions: evaluatedQuestions,
            overallEvaluation,
            overallScore,
            duration,
            attemptDate: new Date()
        };

        await interview.save();

        user.coins -= INTERVIEW_COST;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Interview submitted and evaluated successfully",
            coinBalance: user.coins,
            evaluation: interview.lastAttempt
        });

    } catch (error) {
        console.error("Error submitting interview:", error);
        res.status(500).json({ success: false, message: "Internal Server error" });
    }
});





/**
 * Reattempt interview
 * POST /api/interviews/reattempt/:id
 */
router.post("/reattempt/:id", upload.single("resumeFile"), authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { difficulty, yearsOfExperience } = req.body;
        const resumeFile = req.file;

        console.log(difficulty, yearsOfExperience)
        if (resumeFile) {
            console.log(resumeFile)
        }


        if (!difficulty || !yearsOfExperience) {
            return res.status(400).json({ success: false, message: "Please provide all details!" });
        }

        const interview = await Interview.findById(id);
        if (!interview) {
            return res.status(404).json({ success: false, message: "Interview not found" });
        }



        // If last attempt exists, move to previousAttempts (excluding questions)
        if (interview.lastAttempt.overallEvaluation) {
            const previousAttempt = { ...interview.lastAttempt.toObject() };
            delete previousAttempt.questions;
            interview.previousAttempts.push(previousAttempt);
        }

        // Update resume if new one provided
        let resumeText = interview.resumeText;
        if (resumeFile) {
            resumeText = await extractResumeText(resumeFile.path);
            interview.resumeText = resumeText;
            interview.resumeUpdatedAt = new Date();
        }

        // Generate new questions
        const questions = await generateAIQA(interview.role, interview.description, resumeText, difficulty, yearsOfExperience);


        // New attempt
        interview.lastAttempt = {
            difficulty,
            yearsOfExperience,
            questions,
            overallEvaluation: null,
            overallScore: null,
            duration: 0,
            attemptDate: new Date()
        };

        await interview.save();

        res.status(201).json({
            success: true,
            message: "New attempt created successfully",
            interviewId: interview._id,
            newAttemptId: interview.lastAttempt._id
        });

        if(resumeFile){
            await fsp.unlink(resumeFile.path);
        }
        

    } catch (error) {
        console.error("Error creating reattempt.", error);
        if (req.file && req.file.path) {
            try {
                await fsp.unlink(req.file.path);
            } catch (err) {
                console.error("Failed to delete resume file after error:", err);
            }
        }
        res.status(500).json({ success: false, message: "Internal Server error" });
    }
});














/**
 * Get interview details
 * GET /api/interviews/:id
 */
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const interview = await Interview.findById(id);

        if (!interview) {
            return res.status(404).json({ success: false, message: "Interview not found" });
        }

        if (interview.userId != req.user.id) {
            return res.status(403).json({ success: false, message: "You are not allowed to get details of this interview!" });
        }

        res.status(200).json({
            success: true,
            interview: {
                role: interview.role,
                description: interview.description,
                cost: INTERVIEW_COST,
                lastAttempt: interview.lastAttempt,
                previousAttempts: interview.previousAttempts
            }
        });
    } catch (error) {
        console.error("Error fetching interview:", error);
        res.status(500).json({ success: false, message: "Internal Server error" });
    }
});









export default router;
