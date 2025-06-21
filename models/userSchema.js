const mongoose=require('mongoose');
const {Schema}=mongoose;

const userSchema=new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        required:false,
        default:null
    },
    googleId:{
        type:String,
    },
    password:{
        type:String,
        required:false
    },
    profileImage:{
        type:String,
    },
    addresses:[
        {
            type:Schema.Types.ObjectId,
            ref:"Address"
        }
    ],//References multiple Addresses
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart"
    }],
    wallet:{
        type:Number,
        default:0
    },
    walletTransactions: [{
        type: { type: String, enum: ['credit', 'debit'], required: true },
        amount: { type: Number, required: true },
        description: { type: String, required: true },
        orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: false },
        date: { type: Date, default: Date.now }
    }],
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:'Wishlist'
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:'Order'
    }],
    creation:{
        type:Date,
        default:Date.now
    },
    referralCode:{
        type:String
    },
    redeemed:{
        type:Boolean
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:'User'
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:'Category'
        },brand:{
            type:String
        },searchOn:{
            type:Date,
            default:Date.now
        }
    }],
    shippingAddress:{
        type:Schema.Types.ObjectId,
        ref:"Address",
        default:null//Stores the user's default shipping address
    }
});


const User=mongoose.model('User',userSchema);
module.exports=User;