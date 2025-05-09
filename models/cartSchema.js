const mongoose=require('mongoose');
const {Schema}=mongoose;


const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            default: 'placed'
        },
        cancellationReason: {
            type: String,  // Fix: Remove unnecessary quotes around 'String'
            default: 'none'
        }
    }],
    totalPrice: {  // Fix: Move total price outside items array if it's the cart total
        type: Number,
        default: 0
    }
}, { timestamps: true });  // Fix: Add timestamps



const Cart=mongoose.model('Cart',cartSchema);

module.exports=Cart;