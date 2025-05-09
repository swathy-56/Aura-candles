const mongoose=require('mongoose');
const {Schema}=mongoose;

const couponSchema=new mongoose.Schema({
    
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true
        },
        discountPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        maxDiscount: {
            type: Number,
            required: true, 
            default: 0 
        },
        isActive: {
            type: Boolean,
            default: true
        },
        expiryDate: {
            type: Date,
            required: true
        },
        minimumAmount: {
            type: Number,
            default: 0
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    });
        
    



const Coupon=mongoose.model('Coupon',couponSchema);
module.exports=Coupon;