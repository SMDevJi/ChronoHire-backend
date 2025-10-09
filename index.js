import express from 'express'
import dotenv from 'dotenv';
import authRouter from './routes/auth.js'
import profileRouter from './routes/profile.js'
import cloudinaryRouter from './routes/cloudinary.js'
import interviewRouter from './routes/interview.js'
import paymentRouter from './routes/payment.js'
import rateLimit from 'express-rate-limit';
import { mongoose } from "mongoose";

import cors from 'cors'
dotenv.config();

const app = express()

const isConnected = false;
const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL)
    isConnected = true;
    console.log('[INFO] Connected to DB.\n\n\n')
  } catch (error) {
    console.log(`[ERROR] Failed to connect to DB: ${error}`)
  }
}

app.use(async (req, res, next) => {
  if (!isConnected) {
    connectToDB()
  }
  next()
})


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

app.use('/api/auth/register', limiter);
app.use('/api/auth/resend-otp', limiter);





app.use(express.json())

const corsOptions = {
  origin: process.env.FRONTEND_URL,
};
app.use(cors(corsOptions))

app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/cloudinary', cloudinaryRouter)
app.use('/api/interviews', interviewRouter)
app.use('/api/payment', paymentRouter)


app.get('/', async (req, res) => {
  res.status(200).json({ status: 'running' })
})

// app.listen(process.env.API_PORT, () => {
//     connectToDB()
//     console.log(`Server listening on port: ${process.env.API_PORT}`)
// })




export default app