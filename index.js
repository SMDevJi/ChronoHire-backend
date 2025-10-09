import express from 'express'
import dotenv from 'dotenv';
import connectToDB from './db/db.js';
import authRouter from './routes/auth.js'
import profileRouter from './routes/profile.js'
import cloudinaryRouter from './routes/cloudinary.js'
import interviewRouter from './routes/interview.js'
import paymentRouter from './routes/payment.js'
import rateLimit from 'express-rate-limit';

import cors from 'cors'
dotenv.config();

const app = express()
app.use('/api/payment/confirm', express.raw({ type: 'application/json' }));






const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per windowMs
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again after a while.'
    });
  },
  standardHeaders: false, // Don't Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

app.use('/api/auth/register',limiter);
app.use('/api/auth/resend-otp',limiter);





app.use(express.json())

const corsOptions = {
  origin: process.env.FRONTEND_URL,
};
app.use(cors(corsOptions))

app.use('/api/auth',authRouter)
app.use('/api/profile',profileRouter)
app.use('/api/cloudinary',cloudinaryRouter)
app.use('/api/interviews',interviewRouter)
app.use('/api/payment',paymentRouter)


app.get('/', async (req, res) => {
    res.status(200).json({ status: 'running' })
})

app.listen(process.env.API_PORT, () => {
    connectToDB()
    console.log(`Server listening on port: ${process.env.API_PORT}`)
})