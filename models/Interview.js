import mongoose from "mongoose";


const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  suggestedAns: { type: String },
  transcript: { type: String },   // answer will be added later
  aiFeedback: { type: String },
  score: { type: Number }
}, { timestamps: true });


const EvaluationSchema = new mongoose.Schema({
  contentRelevance: { relevant: Number, offTopic: Number },
  grammarVocabulary: { correct: Number, minorErrors: Number, majorErrors: Number },
  answerCompleteness: { full: Number, partial: Number, missed: Number }
}, { _id: false });


const AttemptSchema = new mongoose.Schema({
  questions: [QuestionSchema],
  overallEvaluation: EvaluationSchema,
  overallScore: Number,
  duration: Number,
  attemptDate: { type: Date, default: Date.now },
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard"] },
  yearsOfExperience: { type: Number }
}, { timestamps: true });


const InterviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, required: true },
  description: { type: String },
  resumeText: { type: String, required: true },
  resumeUpdatedAt: { type: Date, default: Date.now },
  lastAttempt: { type: AttemptSchema, _id: true },
  previousAttempts: [AttemptSchema]
},{ timestamps: true });

export default mongoose.model("Interview", InterviewSchema);
