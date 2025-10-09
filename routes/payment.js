import express from "express";
import Stripe from 'stripe'
import Order from "../models/Order.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/middleware.js";
import dotenv from 'dotenv';
import mongoose from "mongoose";
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;


const plans = [
    {
        name: 'Basic Plan',
        credits: 100,
        price: 5,
        description: 'Perfect for a quick interview practice.',
    },
    {
        name: 'Standard Plan',
        credits: 200,
        price: 10,
        description: 'Ideal for moderate interview preparation.',
    },
    {
        name: 'Premium Plan',
        credits: 500,
        price: 20,
        description: 'For extensive and advanced practice.',
    },
];

/*
'alipay',
'cashapp',
'crypto',
'us_bank_account',
'amazon_pay',
'samsung_pay',
*/

const router = express.Router()

router.post('/create-checkout-session', authMiddleware, async (req, res) => {
    try {
        const { product } = req.body; //name,price
        const email = req.user.email
        const userId = req.user.id
        let credits;
        try {
            credits = (plans.find(p => p.price === product.price)).credits
        } catch (error) {
             return res.status(400).json({ success: false, message: "Plan not found!" })
        }


        const session = await stripe.checkout.sessions.create({
            payment_method_types: [
                'card'
            ],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: product.name
                        },
                        unit_amount: product.price * 100
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            customer_email: email,  // Attach the user email directly to the session
            metadata: {
                userId: userId,
                email: email,         // Add email to metadata for later tracking
                product_name: product.name,
                product_price: product.price,
                product_coins: credits
            },
            success_url: `${process.env.FRONTEND_URL}/payment-success/?title=${product.name}&price=${product.price}&coins=${credits}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`
        })

        res.status(200).json({ success: true, checkout_url: session.url })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Internal server error." })
    }


})









router.post('/confirm', async (request, response) => {
    let event = request.body;

    if (endpointSecret) {
        const signature = request.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(
                request.body,
                signature,
                endpointSecret
            );
        } catch (err) {
            console.log(`⚠️  Webhook signature verification failed.`, err.message);
            return response.sendStatus(400);
        }
    }

    // Handle the event
    //console.log(event.data.object.metadata)
    switch (event.type) {
        case 'checkout.session.completed':
            // const paymentIntent = event.data.object;
            // console.log(paymentIntent.id, event.data.object.metadata)
            //console.log(`PaymentIntent for ${paymentIntent.amount_total} was successful!`);

            await User.findByIdAndUpdate(
                event.data.object.metadata.userId,
                { $inc: { coins: parseInt(event.data.object.metadata.product_coins) } },
                { new: true, runValidators: true }
            );
            await Order.create({
                productName: event.data.object.metadata.product_name,
                userId: event.data.object.metadata.userId,
                checkoutId: event.data.object.id,
                price: event.data.object.metadata.product_price,
                coins: event.data.object.metadata.product_coins
            })
            break;
        default:
            console.log(`Unhandled event type ${event.type}.`);
    }


    response.send();
});








router.get('/get-orders', authMiddleware, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);




        let orders;
        try {
            orders = await Order.find({ 'userId': userId })
        } catch (error) {
            return res.status(404).json({ success: false, message: "Orders not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Orders fetched successfully.",
            orders: orders
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});




export default router