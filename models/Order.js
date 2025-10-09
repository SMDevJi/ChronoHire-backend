import mongoose, { Schema, model } from "mongoose";

const orderSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    checkoutId: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    coins: {
        type: Number,
        required: true,
        min: 0
    }
    
}, { timestamps: true });

const orderModel = model('order', orderSchema);
export default orderModel
