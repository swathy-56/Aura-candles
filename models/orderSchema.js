const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  orderId: {
    type: String,
    unique: true,
    required: true,
    default: () => Math.floor(100000 + Math.random() * 900000).toString(), // 6-digit default
  },
  orderedItems: [
    {
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, default: 0 },
      status: {
        type: String,
        enum: [
          "Pending",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
          "Return Request",
          "Returned",
          "Failed",
        ],
        default: "Pending",
      },
      returnReason: {
        type: String,
        default: "",
      },
    },
  ],
  totalPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  address: {
    name: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    landMark: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: Number,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    altPhone: {
      type: String,
      required: true,
    },
  },
  invoiceDate: { type: Date },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
      "Failed",
    ],
  },
  createdOn: { type: Date, default: Date.now, required: true },
  coupon: {
    code: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    applied: { type: Boolean, default: false },
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["Cash On Delivery", "Razorpay", "Wallet"],
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ["Pending", "Success", "Failed"],
    default: "Pending",
  },
  paymentId: {
    type: String,
    required: false,
  },
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
