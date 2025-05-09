// const User = require("../../models/userSchema");
// const Address = require("../../models/addressSchema");
// const Product = require("../../models/productSchema");
// const Category = require("../../models/categorySchema");
// const Brand = require("../../models/brandSchema");
// const Cart = require("../../models/cartSchema");
// const Order = require("../../models/orderSchema");
// const Coupon = require('../../models/couponSchema');
// const { v4: uuidv4 } = require('uuid');
// const dotenv = require("dotenv");
// const { getResetPassword } = require("./profileController");
// const { default: mongoose } = require("mongoose");
// const ObjectId = mongoose.Types.ObjectId;
// const PDFDocument = require('pdfkit');
// const fs = require('fs');
// dotenv.config();

// const getCheckoutPage = async (req, res) => {
//   try {
   
//       const userId = req.session.user._id;
//       const userData = req.session.user;

//       let cart = await Cart.findOne({ userId })
//       .populate("items.productId")
//       .populate("items.productId.category");

//       if (!cart || cart.items.length === 0) {
//           return res.render("cart", { message: "Your cart is empty." });
//       }

//       const blockedItems = cart.items.filter((item) => {
//         return item.productId.isBlocked === true ;
//       });
//       console.log("catssssss",cart)
//       console.log("blockedItems",blockedItems)

//       if (blockedItems.length > 0) {
//         return res.render('cart', {
//           cart,
//           message: "Some items in your cart are no longer available or belong to unavailable categories. Please remove them to proceed.",
//           userData: userData,
//         });
//       }

     

//       const addresses = await Address.find({ userId });
//       console.log("address",addresses)

//       const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
//       const pendingOrder = await Order.findOne({ 
//           userId, 
//           status: 'Pending',
//           'coupon.applied': true 
//       });

//       const totalPrice = pendingOrder?.finalAmount || subtotal;
//       const discount = pendingOrder?.coupon?.discountAmount || 0;
//       const couponCode = pendingOrder?.coupon?.code || '';

//       const coupons = await Coupon.find({
//         isActive: true,
//         expiryDate: { $gte: new Date() }
//       });

//       const user = await User.findById(userId).select('wallet');
//       const walletBalance = user.wallet || 0;

//       res.render("checkout", {
//           cart: cart.items,
//           addresses: addresses,
//           total: totalPrice,
//           cartId: cart._id,
//           userId: userId,
//           userData: userData,
//           couponApplied: pendingOrder?.coupon?.applied || false,
//           discount: pendingOrder?.coupon?.discountAmount || 0,
//           couponCode: couponCode,
//           coupons: coupons,
//           walletBalance: walletBalance
//       });
      
//   } catch (error) {
//       console.error("Error fetching checkout page:", error);
//       res.status(500).json({ message: "Server error" });
//   }
// };

// const applyCoupon = async (req, res) => {
//     try {
//         const { couponCode, cartId } = req.body;
//         const userId = req.session.user._id;

//         const cart = await Cart.findById(cartId);
//         if (!cart) {
//             return res.json({ success: false, message: 'Cart not found' });
//         }

//         let order = await Order.findOne({ 
//             userId,
//             'coupon.code': couponCode 
//         });

//         if (order) {
//             return res.json({ success: false, message: 'Coupon already applied' });
//         }

//         let coupon = await Coupon.findOne({ 
//             code: couponCode, 
//             isActive: true, 
//             expiryDate: { $gte: new Date() } 
//         });

//         if (!coupon) {
//             const user = await User.findById(userId);
//             const referralCoupon = user.coupons.find(c => c.code === couponCode && !c.isUsed && c.expiresAt > new Date());
//             if (!referralCoupon) {
//                 return res.json({ success: false, message: 'Invalid or expired coupon' });
//             }
//             coupon = { 
//                 discountPercentage: referralCoupon.discount,
//                 maxDiscount: referralCoupon.maxDiscount || Number.MAX_VALUE,
//                 minimumAmount: referralCoupon.minAmount || 0
//             };
//             user.coupons = user.coupons.map(c => c.code === couponCode ? { ...c, isUsed: true } : c);
//             await user.save();
//         }

//         const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

//         if (subtotal < coupon.minimumAmount) {
//             return res.json({ 
//                 success: false, 
//                 message: `Cart total must be at least ₹${coupon.minimumAmount} to apply this coupon` 
//             });
//         }

//         const discountAmount = (subtotal * coupon.discountPercentage) / 100;
//         const finalDiscount = Math.min(discountAmount, coupon.maxDiscount);
//         const finalAmount = subtotal - finalDiscount;

//         order = await Order.findOneAndUpdate(
//           { userId, status: 'Pending' },
//           {
//               $set: {
//                   'coupon.code': couponCode,
//                   'coupon.discountAmount': finalDiscount,
//                   'coupon.applied': true,
//                   finalAmount: finalAmount,
//                   totalPrice: subtotal,
//                   userId,
//                   createdOn: new Date(),
//                   orderedItems: cart.items.map(item => ({
//                       product: item.productId._id,
//                       quantity: item.quantity,
//                       price: item.price,
//                       status: 'Pending',
//                   })),
//               }
//           },
//           { new: true, upsert: true } 
//       );

//         res.json({
//             success: true,
//             finalAmount: finalAmount,
//             discountAmount: finalDiscount
//         });
//     } catch (error) {
//         console.error('Error applying coupon:', error);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// };

// const removeCoupon = async (req, res) => {
//   try {
//       const { cartId } = req.body;
//       const userId = req.session.user._id;

//       const cart = await Cart.findById(cartId);
//       if (!cart) {
//           return res.json({ success: false, message: 'Cart not found' });
//       }

//       const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
//       const order = await Order.findOneAndUpdate(
//           { userId, status: 'Pending' },
//           {
//               $set: {
//                   'coupon.code': null,
//                   'coupon.discountAmount': 0,
//                   'coupon.applied': false,
//                   finalAmount: subtotal,
//                   totalPrice: subtotal
//               }
//           },
//           { new: true }
//       );

//       if (!order) {
//           return res.json({ success: false, message: 'No coupon to remove' });
//       }

//       res.json({
//           success: true,
//           finalAmount: subtotal,
//           discountAmount: 0
//       });
//   } catch (error) {
//       console.error('Error removing coupon:', error);
//       res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

// // const createOrder = async (req, res) => {
// //     try {
// //         console.log('createOrder input:', req.body);

// //         const userId = req.session.user?._id;
// //         if (!userId) {
// //             return res.status(401).json({ success: false, message: "User not logged in" });
// //         }

// //         const { addressId, cartId, paymentMethod, finalAmount, paymentId, paymentStatus } = req.body;

// //         if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
// //             return res.status(400).json({ success: false, message: "Invalid total amount" });
// //         }

// //         if (paymentMethod === "Cash On Delivery" && finalAmount > 1000) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Cash on Delivery is not available for orders above ₹1000. Please choose another payment method."
// //             });
// //         }

// //         const currentAddress = await Address.findById(addressId);
// //         if (!currentAddress) {
// //             return res.status(400).json({ success: false, message: "Address not found" });
// //         }

// //         const cart = await Cart.findById(cartId).populate({
// //             path: "items.productId",
// //             populate: { path: 'category', select: 'isListed' }
// //         });
// //         if (!cart || cart.items.length === 0) {
// //             return res.status(400).json({ success: false, message: "Your cart is empty" });
// //         }

// //         // Validate cart items
// //         const invalidItems = cart.items.filter(item => 
// //             !item.productId ||
// //             item.productId.isBlocked ||
// //             item.productId.quantity < item.quantity ||
// //             (item.productId.category && !item.productId.category.isListed)
// //         );
// //         if (invalidItems.length > 0) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Some items in your cart are unavailable, out of stock, or belong to unavailable categories."
// //             });
// //         }

// //         const pendingOrder = await Order.findOne({ userId, status: 'Pending' });
        
// //         let orderItems = cart.items.map(item => ({
// //             product: item.productId._id,
// //             quantity: item.quantity,
// //             price: item.price,
// //             status: 'Failed' ? 'Failed' :'Pending',
// //         }));

// //         const generateOrderId = async () => {
// //             let isUnique = false;
// //             let orderId;
// //             while (!isUnique) {
// //                 orderId = Math.floor(100000 + Math.random() * 900000).toString();
// //                 const existingOrder = await Order.findOne({ orderId });
// //                 if (!existingOrder) {
// //                     isUnique = true;
// //                 }
// //             }
// //             return orderId;
// //         };

// //         let walletTransactionTempId = null;
// //         let orderStatus = paymentStatus === 'Failed' ? 'Failed' : 'Pending';
// //         //let orderPaymentStatus = paymentStatus === 'Failed' ? 'Failed' : 'Pending';

// //         console.log('Order status:', orderStatus, 'Payment status:', paymentStatus);

// //         if (paymentMethod === "Wallet" && paymentStatus !== 'Failed') {
// //             const user = await User.findById(userId);
// //             const walletBalance = user.wallet || 0;

// //             if (walletBalance < finalAmount) {
// //                 return res.status(400).json({
// //                     success: false,
// //                     message: "Insufficient wallet balance to complete the purchase.",
// //                 });
// //             }

// //             walletTransactionTempId = new mongoose.Types.ObjectId();

// //             await User.findByIdAndUpdate(userId, {
// //                 $inc: { wallet: -finalAmount },
// //                 $push: {
// //                     walletTransactions: {
// //                         _id: walletTransactionTempId,
// //                         type: 'debit',
// //                         amount: finalAmount,
// //                         description: `Payment for order #pending`,
// //                         orderId: null,
// //                         date: new Date(),
// //                     },
// //                 },
// //             });
// //         }

// //         const totalPrice = pendingOrder?.totalPrice || cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
// //         const actualDiscount = pendingOrder?.coupon?.discountAmount || 0;

// //         const orderData = await Order.create({
// //             userId,
// //             orderId: await generateOrderId(),
// //             orderedItems: orderItems,
// //             address: currentAddress._id,
// //             totalPrice: totalPrice,
// //             finalAmount: finalAmount,
// //             discount: actualDiscount,
// //             coupon: pendingOrder?.coupon || { code: null, discountAmount: 0, applied: false },
// //             paymentMethod,
// //             paymentId: paymentMethod === "Razorpay" && paymentStatus !== 'Failed' ? paymentId : undefined,
// //             status: orderStatus,
// //             paymentStatus: paymentStatus || 'Pending',
// //             createdOn: new Date(),
// //         });

// //         console.log('Attempting to create order:', orderData);

// //         const newOrder = await Order.create(orderData);

// //         console.log('Order created successfully:', newOrder._id, newOrder.status);

// //         if (paymentMethod === "Wallet" && walletTransactionTempId && orderStatus !== 'Failed') {
// //             await User.findOneAndUpdate(
// //                 { _id: userId, "walletTransactions._id": walletTransactionTempId },
// //                 {
// //                     $set: {
// //                         "walletTransactions.$.orderId": newOrder._id,
// //                         "walletTransactions.$.description": `Payment for order #${newOrder.orderId}`,
// //                     },
// //                 }
// //             );
// //         }

// //         // Reduce stock only if payment is not failed
// //         if (orderStatus !== 'Failed') {
// //             for (const item of cart.items) {
// //                 await Product.findByIdAndUpdate(item.productId._id, {
// //                     $inc: { quantity: -item.quantity }
// //                 });
// //             }
// //         }

// //         // Clean up only if order is not failed
// //         if (orderStatus !== 'Failed') {
// //             await Cart.findByIdAndDelete(cartId);
// //             if (pendingOrder) await Order.findByIdAndDelete(pendingOrder._id);
// //         }

// //         return res.status(200).json({ 
// //             success: orderStatus !== 'Failed',
// //             message: orderStatus === 'Failed' ? "Order created but payment failed" : "Order placed successfully", 
// //             orderId: newOrder._id 
// //         });

// //     } catch (error) {
// //         console.error("Order creation error:", error);
// //         return res.status(500).json({ success: false, message: "Failed to create order" });
// //     }
// // };

// const createOrder = async (req, res) => {
//     try {
//         console.log('createOrder input:', req.body);

//         const userId = req.session.user?._id;
//         if (!userId) {
//             return res.status(401).json({ success: false, message: "User not logged in" });
//         }

//         const { addressId, cartId, paymentMethod, finalAmount, paymentId, paymentStatus } = req.body;

//         if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
//             return res.status(400).json({ success: false, message: "Invalid total amount" });
//         }

//         if (paymentMethod === "Cash On Delivery" && finalAmount > 1000) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Cash on Delivery is not available for orders above ₹1000. Please choose another payment method."
//             });
//         }

//         const currentAddress = await Address.findById(addressId);
//         if (!currentAddress) {
//             return res.status(400).json({ success: false, message: "Address not found" });
//         }

//         const cart = await Cart.findById(cartId).populate({
//             path: "items.productId",
//             populate: { path: 'category', select: 'isListed' }
//         });
//         if (!cart || cart.items.length === 0) {
//             return res.status(400).json({ success: false, message: "Your cart is empty" });
//         }

//         // Validate cart items
//         const invalidItems = cart.items.filter(item => 
//             !item.productId ||
//             item.productId.isBlocked ||
//             item.productId.quantity < item.quantity ||
//             (item.productId.category && !item.productId.category.isListed)
//         );
//         if (invalidItems.length > 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Some items in your cart are unavailable, out of stock, or belong to unavailable categories."
//             });
//         }

//         const pendingOrder = await Order.findOne({ userId, status: 'Pending' });
        
//         let orderItems = cart.items.map(item => ({
//             product: item.productId._id,
//             quantity: item.quantity,
//             price: item.price,
//             status: paymentStatus === 'Failed' ? 'Failed' : 'Pending',
//         }));

//         const generateOrderId = async () => {
//             let isUnique = false;
//             let orderId;
//             while (!isUnique) {
//                 orderId = Math.floor(100000 + Math.random() * 900000).toString();
//                 const existingOrder = await Order.findOne({ orderId });
//                 if (!existingOrder) {
//                     isUnique = true;
//                 }
//             }
//             return orderId;
//         };

//         let walletTransactionTempId = null;
//         let orderStatus = paymentStatus === 'Failed' ? 'Failed' : 'Pending';

//         console.log('Order status:', orderStatus, 'Payment status:', paymentStatus);

//         if (paymentMethod === "Wallet" && paymentStatus !== 'Failed') {
//             const user = await User.findById(userId);
//             const walletBalance = user.wallet || 0;

//             if (walletBalance < finalAmount) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Insufficient wallet balance to complete the purchase.",
//                 });
//             }

//             walletTransactionTempId = new mongoose.Types.ObjectId();

//             await User.findByIdAndUpdate(userId, {
//                 $inc: { wallet: -finalAmount },
//                 $push: {
//                     walletTransactions: {
//                         _id: walletTransactionTempId,
//                         type: 'debit',
//                         amount: finalAmount,
//                         description: `Payment for order #pending`,
//                         orderId: null,
//                         date: new Date(),
//                     },
//                 },
//             });
//         }

//         const totalPrice = pendingOrder?.totalPrice || cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
//         const actualDiscount = pendingOrder?.coupon?.discountAmount || 0;

//         const orderData = {
//             userId,
//             orderId: await generateOrderId(),
//             orderedItems: orderItems,
//             address: currentAddress._id,
//             totalPrice: totalPrice,
//             finalAmount: finalAmount,
//             discount: actualDiscount,
//             coupon: pendingOrder?.coupon || { code: null, discountAmount: 0, applied: false },
//             paymentMethod,
//             paymentId: paymentMethod === "Razorpay" && paymentStatus !== 'Failed' ? paymentId : undefined,
//             status: orderStatus,
//             paymentStatus: paymentStatus || 'Pending',
//             createdOn: new Date(),
//         };

//         console.log('Attempting to create order:', orderData);

//         const newOrder = await Order.create(orderData);

//         console.log('Order created successfully:', newOrder._id, newOrder.status);

//         if (paymentMethod === "Wallet" && walletTransactionTempId && orderStatus !== 'Failed') {
//             await User.findOneAndUpdate(
//                 { _id: userId, "walletTransactions._id": walletTransactionTempId },
//                 {
//                     $set: {
//                         "walletTransactions.$.orderId": newOrder._id,
//                         "walletTransactions.$.description": `Payment for order #${newOrder.orderId}`,
//                     },
//                 }
//             );
//         }

//         // Reduce stock only if payment is not failed
//         if (orderStatus !== 'Failed') {
//             for (const item of cart.items) {
//                 await Product.findByIdAndUpdate(item.productId._id, {
//                     $inc: { quantity: -item.quantity }
//                 });
//             }
//         }

//         // Clean up only if order is not failed
//         if (orderStatus !== 'Failed') {
//             await Cart.findByIdAndDelete(cartId);
//             if (pendingOrder) await Order.findByIdAndDelete(pendingOrder._id);
//         }

//         return res.status(200).json({ 
//             success: orderStatus !== 'Failed',
//             message: orderStatus === 'Failed' ? "Order created but payment failed" : "Order placed successfully", 
//             orderId: newOrder._id 
//         });
//     } catch (error) {
//         console.error("Order creation error:", error);
//         return res.status(500).json({ success: false, message: `Failed to create order: ${error.message}` });
//     }
// };

// const retryPayment = async (req, res) => {
//     try {
//         const { orderId } = req.body;
//         const userId = req.session.user?._id;
//         if (!userId) {
//             return res.status(401).json({ success: false, message: "User not logged in" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(orderId)) {
//             return res.status(400).json({ success: false, message: "Invalid order ID" });
//         }

//         const order = await Order.findById(orderId).populate({
//             path: 'orderedItems.product',
//             populate: { path: 'category', select: 'isListed' }
//         });
//         if (!order || order.userId.toString() !== userId.toString()) {
//             return res.status(404).json({ success: false, message: "Order not found" });
//         }

//         if (order.status !== 'Failed' || order.paymentStatus !== 'Failed') {
//             return res.status(400).json({ success: false, message: "Order is not in a failed state" });
//         }

//         // Validate order items
//         const invalidItems = order.orderedItems.filter(item => 
//             !item.product ||
//             item.product.isBlocked ||
//             item.product.quantity < item.quantity ||
//             (item.product.category && !item.product.category.isListed)
//         );
//         if (invalidItems.length > 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Some items in your order are unavailable, out of stock, or belong to unavailable categories."
//             });
//         }

//         // Recreate cart for checkout
//         let cart = await Cart.findOne({ userId });
//         if (!cart) {
//             cart = new Cart({ userId, items: [] });
//         } else {
//             cart.items = [];
//         }

//         cart.items = order.orderedItems.map(item => ({
//             productId: item.product._id,
//             quantity: item.quantity,
//             price: item.price,
//             totalPrice: item.price * item.quantity
//         }));
//         await cart.save();

//         // Redirect to checkout page
//         return res.status(200).json({
//             success: true,
//             message: "Cart restored for retrying payment",
//             redirect: `/checkout?cartId=${cart._id}`
//         });
//     } catch (error) {
//         console.error("Error retrying payment:", error);
//         return res.status(500).json({ success: false, message: "Server error" });
//     }
// };

// const orderDetail = async (req, res) => {
//     const orderId = req.query.orderId; 

//     if (!req.session || !req.session.user) {
//         return res.status(401).send("User not logged in");
//     }

//     const userId = req.session.user._id;

//     try {
//         const order = await Order.findOne({
//             _id: orderId,
//             userId: userId 
//         })
//             .populate('address')
//             .populate({
//                 path: 'orderedItems.product',
//                 model: 'Product'
//             });

//         if (!order) {
//             return res.status(404).send("Order not found");
//         }

//         res.render("orderDetails", { orders: [order] });
//     } catch (error) {
//         console.error("Error fetching order:", error);
//         res.status(500).send("Internal server error");
//     }
// };

// const viewOrder = async (req, res) => {
//     try {
//         if (!req.session || !req.session.user || !req.session.user._id) {
//             return res.status(401).send("Please log in to view orders");
//         }

//         const userId = req.session.user._id;
//         const searchQuery = req.query.search?.trim() || '';
//         const page = parseInt(req.query.page) || 1;
//         const limit = 10;
//         const skip = (page - 1) * limit;

//         let query = { userId };

//         if (searchQuery) {
//             const isValidObjectId = mongoose.Types.ObjectId.isValid(searchQuery);

//             query.$or = [
//                 { 'userId.name': { $regex: searchQuery, $options: 'i' } },
//             ];

//             if (isValidObjectId) {
//                 query.$or.push({ _id: new mongoose.Types.ObjectId(searchQuery) });
//             }

//             const productMatch = await Product.find({
//                 productName: { $regex: searchQuery, $options: 'i' }
//             }).select('_id');

//             if (productMatch.length > 0) {
//                 query.$or.push({
//                     'orderedItems.product': { $in: productMatch.map(p => p._id) }
//                 });
//             }
//         }

//         const totalOrders = await Order.countDocuments(query);
//         const totalPages = Math.ceil(totalOrders / limit);

//         const orders = await Order.find(query)
//             .populate('userId', 'name email')
//             .populate('orderedItems.product', 'productName salePrice')
//             .sort({ createdOn: -1 })
//             .skip(skip)
//             .limit(limit);

//         res.render('orders', {
//             orders,
//             search: searchQuery,
//             currentPage: page,
//             totalPages,
//             totalOrders
//         });
//     } catch (error) {
//         console.error('Error in viewOrder:', error);
//         res.status(500).send('Server error: ' + error.message);
//     }
// };

// const cancelOrder = async (req, res) => {
//     try {
//         const { orderId, productId, fullOrder, cancelReason } = req.body;
//         const userId = req.session.user?._id;

//         if (!mongoose.Types.ObjectId.isValid(orderId)) {
//             return res.status(400).json({ message: "Invalid order ID" });
//         }

//         const order = await Order.findById(orderId).populate("orderedItems.product");
//         if (!order) {
//             return res.status(404).json({ message: "Order not found." });
//         }

//         if (order.status === 'Failed') {
//             return res.status(400).json({ message: "Failed orders cannot be cancelled. Please retry payment." });
//         }

//         let refundAmount = 0;

//         if (fullOrder) {
//             if (order.status.toLowerCase() === "delivered" || order.status.toLowerCase() === "cancelled") {
//                 return res.status(400).json({ message: "Order cannot be cancelled." });
//             }

//             for (const item of order.orderedItems) {
//                 item.status = "Cancelled";
//                 await Product.findByIdAndUpdate(item.product._id, {
//                     $inc: { quantity: item.quantity },
//                 });
//             }
//             order.status = "Cancelled";
//             refundAmount = order.finalAmount;
//         } else {
//             if (!mongoose.Types.ObjectId.isValid(productId)) {
//                 return res.status(400).json({ message: "Invalid product ID" });
//             }

//             const item = order.orderedItems.find(
//                 (item) => item.product._id.toString() === productId
//             );
//             if (!item) {
//                 return res.status(404).json({ message: "Product not found in order." });
//             }

//             if (item.status && (item.status.toLowerCase() === "delivered" || item.status.toLowerCase() === "cancelled")) {
//                 return res.status(400).json({ message: "Item cannot be cancelled." });
//             }

//             item.status = "Cancelled";
//             await Product.findByIdAndUpdate(item.product._id, {
//                 $inc: { quantity: item.quantity },
//             });

//             refundAmount = item.price * item.quantity;

//             const remainingItems = order.orderedItems.filter(item => item.status !== "Cancelled");
//             if (remainingItems.length === 0) {
//                 order.status = "Cancelled";
//             } else {
//                 order.totalPrice = remainingItems.reduce(
//                     (sum, item) => sum + item.price * item.quantity,
//                     0
//                 );
//                 order.finalAmount = order.totalPrice - (order.discount || 0);
//             }
//         }

//         await order.save();

//         if (refundAmount > 0) {
//             await User.findByIdAndUpdate(userId, {
//                 $inc: { wallet: refundAmount },
//                 $push: {
//                     walletTransactions: {
//                         type: 'credit',
//                         amount: refundAmount,
//                         description: `Refund for cancelled item in order #${order.orderId}`,
//                         orderId: order._id,
//                     },
//                 },
//             });
//         }

//         return res.json({ 
//             success: true, 
//             message: `Item cancelled successfully. ₹${refundAmount} refunded to wallet.` 
//         });
//     } catch (error) {
//         console.error("Error cancelling order:", error);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// };

// const getOrderPlacedPage = async (req, res) => {
//     try {
//         const userId = req.session.user?._id;
//         if (!userId) {
//             return res.status(401).send("User not logged in");
//         }

//         const userData = await User.findById(userId);
//         let orderId = req.query.orderId;

//         if (!mongoose.Types.ObjectId.isValid(orderId)) {
//             return res.status(400).send("Invalid order ID");
//         }

//         const order = await Order.findOne({ _id: new ObjectId(orderId) })
//             .populate("orderedItems.product");

//         if (!order) {
//             return res.status(404).send("Order not found");
//         }

//         res.render("order-placed", { order, userData });
//     } catch (error) {
//         console.error("Error rendering order-placed page:", error);
//         res.status(500).send("Server error");
//     }
// };

// const getOrderFailurePage = async (req, res) => {
//     try {
//         const userId = req.session.user?._id;
//         if (!userId) {
//             return res.status(401).send("User not logged in");
//         }

//         const { cartId, reason, orderId } = req.query;

//         if (!mongoose.Types.ObjectId.isValid(cartId)) {
//             return res.status(400).send("Invalid cart ID");
//         }

//         res.render("order-failure", { cartId, reason, orderId });
//     } catch (error) {
//         console.error("Error rendering order-failure page:", error);
//         res.status(500).send("Server error");
//     }
// };

// const downloadInvoice = async (req, res) => {
//     try {
//         const orderId = req.params.orderId;
//         const userId = req.session.user?._id;

//         if (!userId) {
//             return res.status(401).send("User not logged in");
//         }

//         const order = await Order.findOne({ _id: orderId, userId })
//             .populate('address')
//             .populate({
//                 path: 'orderedItems.product',
//                 model: 'Product'
//             });

//         if (!order) {
//             return res.status(404).send("Order not found");
//         }

//         if (order.status === 'Cancelled' || order.status === 'Failed') {
//             return res.status(403).send('Invoice not available for cancelled or failed orders.');
//         }

//         const doc = new PDFDocument({ size: 'A4', margin: 50 });
//         const filename = `invoice_${orderId}.pdf`;

//         res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//         res.setHeader('Content-Type', 'application/pdf');

//         doc.pipe(res);

//         const effectiveDiscount = order.totalPrice - order.finalAmount;

//         const totalPrice = order.totalPrice;
//         const productDiscounts = order.orderedItems.map(item => {
//             const itemTotal = item.quantity * item.price;
//             const itemDiscount = totalPrice > 0 ? (itemTotal / totalPrice) * effectiveDiscount : 0;
//             return Math.round(itemDiscount * 100) / 100;
//         });

//         doc.rect(0, 0, doc.page.width, 80).fill('#1a3c34');
//         doc.fillColor('#ffffff')
//            .fontSize(24)
//            .text('Invoice', 50, 30, { align: 'center' });

//         doc.fillColor('#000000');

//         doc.moveDown(2);
//         doc.fontSize(12)
//            .font('Helvetica-Bold')
//            .text(`Order ID: ${order.orderId}`, 50, doc.y, { align: 'left' });
//         doc.font('Helvetica')
//            .text(`Order Date: ${order.createdOn.toDateString()}`, 50, doc.y, { align: 'left' });

//         doc.moveDown(1);
//         doc.fontSize(14)
//            .font('Helvetica-Bold')
//            .fillColor('#1a3c34')
//            .text('Shipping Address:', { underline: true });
//         doc.fontSize(12)
//            .font('Helvetica')
//            .fillColor('#000000')
//            .text(`${order.address.name}`)
//            .text(`${order.address.phone}`)
//            .text(`${order.address.city}, ${order.address.state} ${order.address.pincode}`)
//            .text(`${order.address.landMark}`)
//            .moveDown();

//         doc.fontSize(14)
//            .font('Helvetica-Bold')
//            .fillColor('#1a3c34')
//            .text('Order Items:', { underline: true });
//         doc.moveDown(0.5);

//         const tableTop = doc.y;
//         const tableLeft = 50;
//         const colWidths = {
//             product: 200,
//             qty: 50,
//             price: 70,
//             discount: 70,
//             total: 70
//         };

//         doc.rect(tableLeft, tableTop - 5, 460, 25)
//            .fill('#f0f0f0');

//         doc.fontSize(12)
//            .font('Helvetica-Bold')
//            .fillColor('#1a3c34')
//            .text('Product', tableLeft, tableTop, { width: colWidths.product })
//            .text('Qty', tableLeft + colWidths.product, tableTop, { width: colWidths.qty, align: 'center' })
//            .text('Price', tableLeft + colWidths.product + colWidths.qty, tableTop, { width: colWidths.price, align: 'right' })
//            .text('Discount', tableLeft + colWidths.product + colWidths.qty + colWidths.price, tableTop, { width: colWidths.discount, align: 'right' })
//            .text('Total', tableLeft + colWidths.product + colWidths.qty + colWidths.price + colWidths.discount, tableTop, { width: colWidths.total, align: 'right' });

//         doc.moveTo(tableLeft, tableTop + 20)
//            .lineTo(tableLeft + 460, tableTop + 20)
//            .stroke();

//         let yPosition = tableTop + 25;
//         order.orderedItems.forEach((item, index) => {
//             const itemTotal = item.quantity * item.price;
//             const itemDiscount = productDiscounts[index];
//             const discountedTotal = itemTotal - itemDiscount;

//             doc.fontSize(12)
//                .font('Helvetica')
//                .fillColor('#000000')
//                .text(item.product.productName, tableLeft, yPosition, { width: colWidths.product })
//                .text(item.quantity.toString(), tableLeft + colWidths.product, yPosition, { width: colWidths.qty, align: 'center' })
//                .text(`₹${item.price}`, tableLeft + colWidths.product + colWidths.qty, yPosition, { width: colWidths.price, align: 'center' })
//                .text(`₹${itemDiscount.toFixed(2)}`, tableLeft + colWidths.product + colWidths.qty + colWidths.price, yPosition, { width: colWidths.discount, align: 'center' })
//                .text(`₹${discountedTotal.toFixed(2)}`, tableLeft + colWidths.product + colWidths.qty + colWidths.price + colWidths.discount, yPosition, { width: colWidths.total, align: 'center' });

//             doc.moveTo(tableLeft, yPosition + 20)
//                .lineTo(tableLeft + 460, yPosition + 20)
//                .stroke();

//             yPosition += 20;
//         });

//         let currentX = tableLeft;
//         [0, colWidths.product, colWidths.qty, colWidths.price, colWidths.discount, colWidths.total].forEach(width => {
//             doc.moveTo(currentX, tableTop - 5)
//                .lineTo(currentX, yPosition)
//                .stroke();
//             currentX += width;
//         });

//         doc.moveDown(2);
//         doc.fontSize(14)
//            .font('Helvetica-Bold')
//            .fillColor('#1a3c34')
//            .text('Order Summary:', { underline: true });
//         doc.moveDown(0.5);
//         doc.fontSize(12)
//            .font('Helvetica')
//            .fillColor('#000000')
//            .text(`Subtotal: ₹${order.totalPrice}`, 400, doc.y, { align: 'right' })
//            .text(`Discount: ₹${effectiveDiscount.toFixed(2)}`, { align: 'right' })
//            .text(`Shipping: Free`, { align: 'right' })
//            .text(`Total: ₹${order.finalAmount}`, { align: 'right' });

//         doc.moveDown(2);
//         doc.fontSize(10)
//            .font('Helvetica-Oblique')
//            .fillColor('#666666')
//            .text('Thank you for shopping with Aura Candles!', { align: 'center' });

//         doc.end();
//     } catch (error) {
//         console.error("Error generating invoice:", error);
//         res.status(500).send("Internal server error");
//     }
// };

// const returnOrder = async (req, res) => {
//     try {
//         const { orderId, productId, returnReason } = req.body;
//         const userId = req.session.user?._id;

//         if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
//             return res.status(400).json({ success: false, message: "Invalid order or product ID" });
//         }
//         if (!returnReason || returnReason.trim() === "") {
//             return res.status(400).json({ success: false, message: "Return reason is mandatory" });
//         }

//         const order = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
//         if (!order) {
//             return res.status(404).json({ success: false, message: "Order not found" });
//         }

//         const item = order.orderedItems.find(item => item.product._id.toString() === productId);
//         if (!item) {
//             return res.status(404).json({ success: false, message: "Product not found in order" });
//         }

//         if (!item.status || item.status.toLowerCase() !== "delivered") {
//             return res.status(400).json({ success: false, message: "Only delivered items can be returned" });
//         }

//         if (item.status.toLowerCase() === "returned" || item.status.toLowerCase() === "return request") {
//             return res.status(400).json({ success: false, message: "Item is already returned or has a pending return request" });
//         }

//         item.status = "Return Request";
//         item.returnReason = returnReason;

//         const allItemsReturned = order.orderedItems.every(item => item.status.toLowerCase() === "returned");
//         const allItemsReturnRequested = order.orderedItems.every(item => item.status.toLowerCase() === "return request" || item.status.toLowerCase() === "returned");
//         if (allItemsReturned) {
//             order.status = "Returned";
//         } else if (allItemsReturnRequested) {
//             order.status = "Return Request";
//         }

//         await order.save();

//         item.status = "Returned";
//         const returnAmount = item.price * item.quantity;

//         const remainingItems = order.orderedItems.filter(item => item.status !== "Returned");
//         if (remainingItems.length === 0) {
//             order.status = "Returned";
//             order.finalAmount = 0;
//             order.totalPrice = 0;
//         } else {
//             order.totalPrice = remainingItems.reduce(
//                 (sum, item) => sum + item.price * item.quantity,
//                 0
//             );
//             order.finalAmount = order.totalPrice - (order.discount || 0);
//         }

//         await order.save();

//         await User.findByIdAndUpdate(userId, {
//             $inc: { wallet: returnAmount },
//             $push: {
//                 walletTransactions: {
//                     type: 'credit',
//                     amount: returnAmount,
//                     description: `Refund for returned item in order #${order.orderId}`,
//                     orderId: order._id,
//                 },
//             },
//         });

//         return res.json({ success: true, message: `Return request processed successfully. ₹${returnAmount} credited to wallet.` });
//     } catch (error) {
//         console.error("Return request error:", error);
//         return res.status(500).json({ success: false, message: "Internal server error" });
//     }
// };

// const viewWallet = async (req, res) => {
//     try {
//         const userId = req.session.user?._id;
//         if (!userId) {
//             return res.redirect('/login');
//         }

//         const user = await User.aggregate([
//             { $match: { _id: new mongoose.Types.ObjectId(userId) } },
//             {
//                 $project: {
//                     wallet: 1,
//                     walletTransactions: 1,
//                     name: 1,
//                     email: 1,
//                 },
//             },
//             {
//                 $unwind: '$walletTransactions',
//             },
//             {
//                 $sort: {
//                     'walletTransactions.date': -1,
//                 },
//             },
//             {
//                 $group: {
//                     _id: '$_id',
//                     wallet: { $first: '$wallet' },
//                     walletTransactions: { $push: '$walletTransactions' },
//                     name: { $first: '$name' },
//                     email: { $first: '$email' },
//                 },
//             },
//         ]);

//         const userData = user.length > 0 ? user[0] : { wallet: 0, walletTransactions: [], name: '', email: '' };

//         for (let transaction of userData.walletTransactions) {
//             transaction.transactionId = transaction._id.toString();
//             if (transaction.orderId) {
//                 const order = await Order.findById(transaction.orderId).lean();
//                 if (order) {
//                     transaction.source = `Order #${order.orderId}`;
//                     transaction.orderLink = `/viewOrder?orderId=${order._id}`;
//                 } else {
//                     transaction.source = 'Unknown Order';
//                     transaction.orderLink = null;
//                 }
//             } else {
//                 transaction.source = transaction.description || 'Manual Adjustment';
//                 transaction.orderLink = null;
//             }
//         }

//         res.render('wallet', {
//             walletBalance: userData.wallet || 0,
//             transactions: userData.walletTransactions || [],
//             user: {
//                 name: userData.name,
//                 email: userData.email
//             },
//         });
//     } catch (error) {
//         console.error('Error in viewWallet:', error);
//         res.status(500).send('Server Error');
//     }
// };

// const retryPaymentGet = async (req, res) => {
//     try {
//         const { orderId } = req.query;
//         const userId = req.session.user?._id;
//         if (!userId) {
//             return res.redirect('/login');
//         }

//         if (!mongoose.Types.ObjectId.isValid(orderId)) {
//             return res.status(400).send("Invalid order ID");
//         }

//         const order = await Order.findById(orderId).populate({
//             path: 'orderedItems.product',
//             populate: { path: 'category', select: 'isListed' }
//         });
//         if (!order || order.userId.toString() !== userId.toString()) {
//             return res.status(404).send("Order not found");
//         }

//         if (order.status !== 'Failed' || order.paymentStatus !== 'Failed') {
//             return res.status(400).send("Order is not in a failed state");
//         }

//         // Validate order items
//         const invalidItems = order.orderedItems.filter(item => 
//             !item.product ||
//             item.product.isBlocked ||
//             item.product.quantity < item.quantity ||
//             (item.product.category && !item.product.category.isListed)
//         );
//         if (invalidItems.length > 0) {
//             return res.status(400).send("Some items in your order are unavailable, out of stock, or belong to unavailable categories.");
//         }

//         // Recreate cart for checkout
//         let cart = await Cart.findOne({ userId });
//         if (!cart) {
//             cart = new Cart({ userId, items: [] });
//         } else {
//             cart.items = [];
//         }

//         cart.items = order.orderedItems.map(item => ({
//             productId: item.product._id,
//             quantity: item.quantity,
//             price: item.price,
//             totalPrice: item.price * item.quantity
//         }));
//         await cart.save();

//         // Redirect to checkout page
//         res.redirect(`/checkout?cartId=${cart._id}`);
//     } catch (error) {
//         console.error("Error retrying payment:", error);
//         res.status(500).send("Server error");
//     }
// };

// module.exports = {
//     getCheckoutPage,
//     applyCoupon,
//     removeCoupon,
//     createOrder,
//     orderDetail,
//     viewOrder,
//     cancelOrder,
//     getOrderPlacedPage,
//     getOrderFailurePage,
//     returnOrder,
//     downloadInvoice,
//     viewWallet,
//     retryPayment,
//     retryPaymentGet
// };

const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Coupon = require('../../models/couponSchema');
const { v4: uuidv4 } = require('uuid');
const dotenv = require("dotenv");
const { getResetPassword } = require("./profileController");
const { default: mongoose } = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Razorpay = require('razorpay');

dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userData = req.session.user;

        let cart = await Cart.findOne({ userId })
            .populate("items.productId")
            .populate("items.productId.category");

        if (!cart || cart.items.length === 0) {
            return res.render("cart", { message: "Your cart is empty." });
        }

        const blockedItems = cart.items.filter((item) => {
            return item.productId.isBlocked === true;
        });

        if (blockedItems.length > 0) {
            return res.render('cart', {
                cart,
                message: "Some items in your cart are no longer available or belong to unavailable categories. Please remove them to proceed.",
                userData: userData,
            });
        }

        const addresses = await Address.find({ userId });

        const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const pendingOrder = await Order.findOne({
            userId,
            status: 'Pending',
            'coupon.applied': true
        });

        const totalPrice = pendingOrder?.finalAmount || subtotal;
        const discount = pendingOrder?.coupon?.discountAmount || 0;
        const couponCode = pendingOrder?.coupon?.code || '';

        const coupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gte: new Date() }
        });

        const user = await User.findById(userId).select('wallet');
        const walletBalance = user.wallet || 0;

        res.render("checkout", {
            cart: cart.items,
            addresses: addresses,
            total: totalPrice,
            cartId: cart._id,
            userId: userId,
            userData: userData,
            couponApplied: pendingOrder?.coupon?.applied || false,
            discount: pendingOrder?.coupon?.discountAmount || 0,
            couponCode: couponCode,
            coupons: coupons,
            walletBalance: walletBalance
        });

    } catch (error) {
        console.error("Error fetching checkout page:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartId } = req.body;
        const userId = req.session.user._id;

        const cart = await Cart.findById(cartId);
        if (!cart) {
            return res.json({ success: false, message: 'Cart not found' });
        }

        let order = await Order.findOne({
            userId,
            'coupon.code': couponCode
        });

        if (order) {
            return res.json({ success: false, message: 'Coupon already applied' });
        }

        let coupon = await Coupon.findOne({
            code: couponCode,
            isActive: true,
            expiryDate: { $gte: new Date() }
        });

        if (!coupon) {
            const user = await User.findById(userId);
            const referralCoupon = user.coupons.find(c => c.code === couponCode && !c.isUsed && c.expiresAt > new Date());
            if (!referralCoupon) {
                return res.json({ success: false, message: 'Invalid or expired coupon' });
            }
            coupon = {
                discountPercentage: referralCoupon.discount,
                maxDiscount: referralCoupon.maxDiscount || Number.MAX_VALUE,
                minimumAmount: referralCoupon.minAmount || 0
            };
            user.coupons = user.coupons.map(c => c.code === couponCode ? { ...c, isUsed: true } : c);
            await user.save();
        }

        const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (subtotal < coupon.minimumAmount) {
            return res.json({
                success: false,
                message: `Cart total must be at least ₹${coupon.minimumAmount} to apply this coupon`
            });
        }

        const discountAmount = (subtotal * coupon.discountPercentage) / 100;
        const finalDiscount = Math.min(discountAmount, coupon.maxDiscount);
        const finalAmount = subtotal - finalDiscount;

        order = await Order.findOneAndUpdate(
            { userId, status: 'Pending' },
            {
                $set: {
                    'coupon.code': couponCode,
                    'coupon.discountAmount': finalDiscount,
                    'coupon.applied': true,
                    finalAmount: finalAmount,
                    totalPrice: subtotal,
                    userId,
                    createdOn: new Date(),
                    orderedItems: cart.items.map(item => ({
                        product: item.productId._id,
                        quantity: item.quantity,
                        price: item.price,
                        status: 'Pending',
                    })),
                }
            },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            finalAmount: finalAmount,
            discountAmount: finalDiscount
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const { cartId } = req.body;
        const userId = req.session.user._id;

        const cart = await Cart.findById(cartId);
        if (!cart) {
            return res.json({ success: false, message: 'Cart not found' });
        }

        const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const order = await Order.findOneAndUpdate(
            { userId, status: 'Pending' },
            {
                $set: {
                    'coupon.code': null,
                    'coupon.discountAmount': 0,
                    'coupon.applied': false,
                    finalAmount: subtotal,
                    totalPrice: subtotal
                }
            },
            { new: true }
        );

        if (!order) {
            return res.json({ success: false, message: 'No coupon to remove' });
        }

        res.json({
            success: true,
            finalAmount: subtotal,
            discountAmount: 0
        });
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const createRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
        const options = {
            amount: amount * 100, // In paise
            currency: 'INR',
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, orderId: order.id });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
    }
};

const createOrder = async (req, res) => {
    try {
        console.log('createOrder input:', req.body);

        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        const { addressId, cartId, paymentMethod, finalAmount, paymentId, paymentStatus } = req.body;

        if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid total amount" });
        }

        if (paymentMethod === "Cash On Delivery" && finalAmount > 1000) {
            return res.status(400).json({
                success: false,
                message: "Cash on Delivery is not available for orders above ₹1000. Please choose another payment method."
            });
        }

        const currentAddress = await Address.findById(addressId);
        if (!currentAddress) {
            return res.status(400).json({ success: false, message: "Address not found" });
        }

        const cart = await Cart.findById(cartId).populate({
            path: "items.productId",
            populate: { path: 'category', select: 'isListed' }
        });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty" });
        }

        const invalidItems = cart.items.filter(item =>
            !item.productId ||
            item.productId.isBlocked ||
            item.productId.quantity < item.quantity ||
            (item.productId.category && !item.productId.category.isListed)
        );
        if (invalidItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Some items in your cart are unavailable, out of stock, or belong to unavailable categories."
            });
        }

        const pendingOrder = await Order.findOne({ userId, status: 'Pending' });

        let orderItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            status: paymentStatus === 'Failed' ? 'Failed' : 'Pending',
        }));

        const generateOrderId = async () => {
            let isUnique = false;
            let orderId;
            while (!isUnique) {
                orderId = Math.floor(100000 + Math.random() * 900000).toString();
                const existingOrder = await Order.findOne({ orderId });
                if (!existingOrder) {
                    isUnique = true;
                }
            }
            return orderId;
        };

        let walletTransactionTempId = null;
        let orderStatus = paymentStatus === 'Failed' ? 'Failed' : 'Pending';

        console.log('Order status:', orderStatus, 'Payment status:', paymentStatus);

        if (paymentMethod === "Wallet" && paymentStatus !== 'Failed') {
            const user = await User.findById(userId);
            const walletBalance = user.wallet || 0;

            if (walletBalance < finalAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient wallet balance to complete the purchase.",
                });
            }

            walletTransactionTempId = new mongoose.Types.ObjectId();

            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: -finalAmount },
                $push: {
                    walletTransactions: {
                        _id: walletTransactionTempId,
                        type: 'debit',
                        amount: finalAmount,
                        description: `Payment for order #pending`,
                        orderId: null,
                        date: new Date(),
                    },
                },
            });
        }

        const totalPrice = pendingOrder?.totalPrice || cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const actualDiscount = pendingOrder?.coupon?.discountAmount || 0;

        const orderData = {
            userId,
            orderId: await generateOrderId(),
            orderedItems: orderItems,
            address: currentAddress._id,
            totalPrice: totalPrice,
            finalAmount: finalAmount,
            discount: actualDiscount,
            coupon: pendingOrder?.coupon || { code: null, discountAmount: 0, applied: false },
            paymentMethod,
            paymentId: paymentMethod === "Razorpay" && paymentStatus !== 'Failed' ? paymentId : undefined,
            status: orderStatus,
            paymentStatus: paymentStatus || 'Pending',
            createdOn: new Date(),
        };

        console.log('Attempting to create order:', orderData);

        const newOrder = await Order.create(orderData);

        console.log('Order created successfully:', newOrder._id, newOrder.status);

        if (paymentMethod === "Wallet" && walletTransactionTempId && orderStatus !== 'Failed') {
            await User.findOneAndUpdate(
                { _id: userId, "walletTransactions._id": walletTransactionTempId },
                {
                    $set: {
                        "walletTransactions.$.orderId": newOrder._id,
                        "walletTransactions.$.description": `Payment for order #${newOrder.orderId}`,
                    },
                }
            );
        }

        if (orderStatus !== 'Failed') {
            for (const item of cart.items) {
                await Product.findByIdAndUpdate(item.productId._id, {
                    $inc: { quantity: -item.quantity }
                });
            }
        }

        if (orderStatus !== 'Failed') {
            await Cart.findByIdAndDelete(cartId);
            if (pendingOrder) await Order.findByIdAndDelete(pendingOrder._id);
        }

        return res.status(200).json({
            success: orderStatus !== 'Failed',
            message: orderStatus === 'Failed' ? "Order created but payment failed" : "Order placed successfully",
            orderId: newOrder._id
        });
    } catch (error) {
        console.error("Order creation error:", error);
        return res.status(500).json({ success: false, message: `Failed to create order: ${error.message}` });
    }
};

const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }

        const order = await Order.findById(orderId).populate({
            path: 'orderedItems.product',
            populate: { path: 'category', select: 'isListed' }
        });
        if (!order || order.userId.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status !== 'Failed' || order.paymentStatus !== 'Failed') {
            return res.status(400).json({ success: false, message: "Order is not in a failed state" });
        }

        const invalidItems = order.orderedItems.filter(item =>
            !item.product ||
            item.product.isBlocked ||
            item.product.quantity < item.quantity ||
            (item.product.category && !item.product.category.isListed)
        );
        if (invalidItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Some items in your order are unavailable, out of stock, or belong to unavailable categories."
            });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        } else {
            cart.items = [];
        }

        cart.items = order.orderedItems.map(item => ({
            productId: item.product._id,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.price * item.quantity
        }));
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Cart restored for retrying payment",
            redirect: `/checkout?cartId=${cart._id}`
        });
    } catch (error) {
        console.error("Error retrying payment:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const orderDetail = async (req, res) => {
    const orderId = req.query.orderId;

    if (!req.session || !req.session.user) {
        return res.status(401).send("User not logged in");
    }

    const userId = req.session.user._id;

    try {
        const order = await Order.findOne({
            _id: orderId,
            userId: userId
        })
            .populate('address')
            .populate({
                path: 'orderedItems.product',
                model: 'Product'
            });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render("orderDetails", { orders: [order] });
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).send("Internal server error");
    }
};

const viewOrder = async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.user._id) {
            return res.status(401).send("Please log in to view orders");
        }

        const userId = req.session.user._id;
        const searchQuery = req.query.search?.trim() || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let query = { userId };

        if (searchQuery) {
            const isValidObjectId = mongoose.Types.ObjectId.isValid(searchQuery);

            query.$or = [
                { 'userId.name': { $regex: searchQuery, $options: 'i' } },
            ];

            if (isValidObjectId) {
                query.$or.push({ _id: new mongoose.Types.ObjectId(searchQuery) });
            }

            const productMatch = await Product.find({
                productName: { $regex: searchQuery, $options: 'i' }
            }).select('_id');

            if (productMatch.length > 0) {
                query.$or.push({
                    'orderedItems.product': { $in: productMatch.map(p => p._id) }
                });
            }
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('orderedItems.product', 'productName salePrice')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        res.render('orders', {
            orders,
            search: searchQuery,
            currentPage: page,
            totalPages,
            totalOrders
        });
    } catch (error) {
        console.error('Error in viewOrder:', error);
        res.status(500).send('Server error: ' + error.message);
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId, productId, fullOrder, cancelReason } = req.body;
        const userId = req.session.user?._id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order ID" });
        }

        const order = await Order.findById(orderId).populate("orderedItems.product");
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }

        if (order.status === 'Failed') {
            return res.status(400).json({ message: "Failed orders cannot be cancelled. Please retry payment." });
        }

        let refundAmount = 0;

        if (fullOrder) {
            if (order.status.toLowerCase() === "delivered" || order.status.toLowerCase() === "cancelled") {
                return res.status(400).json({ message: "Order cannot be cancelled." });
            }

            for (const item of order.orderedItems) {
                item.status = "Cancelled";
                await Product.findByIdAndUpdate(item.product._id, {
                    $inc: { quantity: item.quantity },
                });
            }
            order.status = "Cancelled";
            refundAmount = order.finalAmount;
        } else {
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ message: "Invalid product ID" });
            }

            const item = order.orderedItems.find(
                (item) => item.product._id.toString() === productId
            );
            if (!item) {
                return res.status(404).json({ message: "Product not found in order." });
            }

            if (item.status && (item.status.toLowerCase() === "delivered" || item.status.toLowerCase() === "cancelled")) {
                return res.status(400).json({ message: "Item cannot be cancelled." });
            }

            item.status = "Cancelled";
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { quantity: item.quantity },
            });

            refundAmount = item.price * item.quantity;

            const remainingItems = order.orderedItems.filter(item => item.status !== "Cancelled");
            if (remainingItems.length === 0) {
                order.status = "Cancelled";
            } else {
                order.totalPrice = remainingItems.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                );
                order.finalAmount = order.totalPrice - (order.discount || 0);
            }
        }

        await order.save();

        if (refundAmount > 0) {
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: refundAmount },
                $push: {
                    walletTransactions: {
                        type: 'credit',
                        amount: refundAmount,
                        description: `Refund for cancelled item in order #${order.orderId}`,
                        orderId: order._id,
                    },
                },
            });
        }

        return res.json({
            success: true,
            message: `Item cancelled successfully. ₹${refundAmount} refunded to wallet.`
        });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getOrderPlacedPage = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).send("User not logged in");
        }

        const userData = await User.findById(userId);
        let orderId = req.query.orderId;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send("Invalid order ID");
        }

        const order = await Order.findOne({ _id: new ObjectId(orderId) })
            .populate("orderedItems.product");

        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render("order-placed", { order, userData });
    } catch (error) {
        console.error("Error rendering order-placed page:", error);
        res.status(500).send("Server error");
    }
};

const getOrderFailurePage = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).send("User not logged in");
        }

        const { cartId, reason, orderId } = req.query;

        if (!mongoose.Types.ObjectId.isValid(cartId)) {
            return res.status(400).send("Invalid cart ID");
        }

        res.render("order-failure", { cartId, reason, orderId });
    } catch (error) {
        console.error("Error rendering order-failure page:", error);
        res.status(500).send("Server error");
    }
};

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).send("User not logged in");
        }

        const order = await Order.findOne({ _id: orderId, userId })
            .populate('address')
            .populate({
                path: 'orderedItems.product',
                model: 'Product'
            });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        if (order.status === 'Cancelled' || order.status === 'Failed') {
            return res.status(403).send('Invoice not available for cancelled or failed orders.');
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filename = `invoice_${orderId}.pdf`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        const effectiveDiscount = order.totalPrice - order.finalAmount;

        const totalPrice = order.totalPrice;
        const productDiscounts = order.orderedItems.map(item => {
            const itemTotal = item.quantity * item.price;
            const itemDiscount = totalPrice > 0 ? (itemTotal / totalPrice) * effectiveDiscount : 0;
            return Math.round(itemDiscount * 100) / 100;
        });

        doc.rect(0, 0, doc.page.width, 80).fill('#1a3c34');
        doc.fillColor('#ffffff')
            .fontSize(24)
            .text('Invoice', 50, 30, { align: 'center' });

        doc.fillColor('#000000');

        doc.moveDown(2);
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .text(`Order ID: ${order.orderId}`, 50, doc.y, { align: 'left' });
        doc.font('Helvetica')
            .text(`Order Date: ${order.createdOn.toDateString()}`, 50, doc.y, { align: 'left' });

        doc.moveDown(1);
        doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#1a3c34')
            .text('Shipping Address:', { underline: true });
        doc.fontSize(12)
            .font('Helvetica')
            .fillColor('#000000')
            .text(`${order.address.name}`)
            .text(`${order.address.phone}`)
            .text(`${order.address.city}, ${order.address.state} ${order.address.pincode}`)
            .text(`${order.address.landMark}`)
            .moveDown();

        doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#1a3c34')
            .text('Order Items:', { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const tableLeft = 50;
        const colWidths = {
            product: 200,
            qty: 50,
            price: 70,
            discount: 70,
            total: 70
        };

        doc.rect(tableLeft, tableTop - 5, 460, 25)
            .fill('#f0f0f0');

        doc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#1a3c34')
            .text('Product', tableLeft, tableTop, { width: colWidths.product })
            .text('Qty', tableLeft + colWidths.product, tableTop, { width: colWidths.qty, align: 'center' })
            .text('Price', tableLeft + colWidths.product + colWidths.qty, tableTop, { width: colWidths.price, align: 'right' })
            .text('Discount', tableLeft + colWidths.product + colWidths.qty + colWidths.price, tableTop, { width: colWidths.discount, align: 'right' })
            .text('Total', tableLeft + colWidths.product + colWidths.qty + colWidths.price + colWidths.discount, tableTop, { width: colWidths.total, align: 'right' });

        doc.moveTo(tableLeft, tableTop + 20)
            .lineTo(tableLeft + 460, tableTop + 20)
            .stroke();

        let yPosition = tableTop + 25;
        order.orderedItems.forEach((item, index) => {
            const itemTotal = item.quantity * item.price;
            const itemDiscount = productDiscounts[index];
            const discountedTotal = itemTotal - itemDiscount;

            doc.fontSize(12)
                .font('Helvetica')
                .fillColor('#000000')
                .text(item.product.productName, tableLeft, yPosition, { width: colWidths.product })
                .text(item.quantity.toString(), tableLeft + colWidths.product, yPosition, { width: colWidths.qty, align: 'center' })
                .text(`₹${item.price}`, tableLeft + colWidths.product + colWidths.qty, yPosition, { width: colWidths.price, align: 'center' })
                .text(`₹${itemDiscount.toFixed(2)}`, tableLeft + colWidths.product + colWidths.qty + colWidths.price, yPosition, { width: colWidths.discount, align: 'center' })
                .text(`₹${discountedTotal.toFixed(2)}`, tableLeft + colWidths.product + colWidths.qty + colWidths.price + colWidths.discount, yPosition, { width: colWidths.total, align: 'center' });

            doc.moveTo(tableLeft, yPosition + 20)
                .lineTo(tableLeft + 460, yPosition + 20)
                .stroke();

            yPosition += 20;
        });

        let currentX = tableLeft;
        [0, colWidths.product, colWidths.qty, colWidths.price, colWidths.discount, colWidths.total].forEach(width => {
            doc.moveTo(currentX, tableTop - 5)
                .lineTo(currentX, yPosition)
                .stroke();
            currentX += width;
        });

        doc.moveDown(2);
        doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#1a3c34')
            .text('Order Summary:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12)
            .font('Helvetica')
            .fillColor('#000000')
            .text(`Subtotal: ₹${order.totalPrice}`, 400, doc.y, { align: 'right' })
            .text(`Discount: ₹${effectiveDiscount.toFixed(2)}`, { align: 'right' })
            .text(`Shipping: Free`, { align: 'right' })
            .text(`Total: ₹${order.finalAmount}`, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(10)
            .font('Helvetica-Oblique')
            .fillColor('#666666')
            .text('Thank you for shopping with Aura Candles!', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).send("Internal server error");
    }
};

const returnOrder = async (req, res) => {
    try {
        const { orderId, productId, returnReason } = req.body;
        const userId = req.session.user?._id;

        if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid order or product ID" });
        }
        if (!returnReason || returnReason.trim() === "") {
            return res.status(400).json({ success: false, message: "Return reason is mandatory" });
        }

        const order = await Order.findOne({ _id: orderId }).populate("orderedItems.product");
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const item = order.orderedItems.find(item => item.product._id.toString() === productId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }

        if (!item.status || item.status.toLowerCase() !== "delivered") {
            return res.status(400).json({ success: false, message: "Only delivered items can be returned" });
        }

        if (item.status.toLowerCase() === "returned" || item.status.toLowerCase() === "return request") {
            return res.status(400).json({ success: false, message: "Item is already returned or has a pending return request" });
        }

        item.status = "Return Request";
        item.returnReason = returnReason;

        const allItemsReturned = order.orderedItems.every(item => item.status.toLowerCase() === "returned");
        const allItemsReturnRequested = order.orderedItems.every(item => item.status.toLowerCase() === "return request" || item.status.toLowerCase() === "returned");
        if (allItemsReturned) {
            order.status = "Returned";
        } else if (allItemsReturnRequested) {
            order.status = "Return Request";
        }

        await order.save();

        item.status = "Returned";
        const returnAmount = item.price * item.quantity;

        const remainingItems = order.orderedItems.filter(item => item.status !== "Returned");
        if (remainingItems.length === 0) {
            order.status = "Returned";
            order.finalAmount = 0;
            order.totalPrice = 0;
        } else {
            order.totalPrice = remainingItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );
            order.finalAmount = order.totalPrice - (order.discount || 0);
        }

        await order.save();

        await User.findByIdAndUpdate(userId, {
            $inc: { wallet: returnAmount },
            $push: {
                walletTransactions: {
                    type: 'credit',
                    amount: returnAmount,
                    description: `Refund for returned item in order #${order.orderId}`,
                    orderId: order._id,
                },
            },
        });

        return res.json({ success: true, message: `Return request processed successfully. ₹${returnAmount} credited to wallet.` });
    } catch (error) {
        console.error("Return request error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const viewWallet = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(userId) } },
            {
                $project: {
                    wallet: 1,
                    walletTransactions: 1,
                    name: 1,
                    email: 1,
                },
            },
            {
                $unwind: '$walletTransactions',
            },
            {
                $sort: {
                    'walletTransactions.date': -1,
                },
            },
            {
                $group: {
                    _id: '$_id',
                    wallet: { $first: '$wallet' },
                    walletTransactions: { $push: '$walletTransactions' },
                    name: { $first: '$name' },
                    email: { $first: '$email' },
                },
            },
        ]);

        const userData = user.length > 0 ? user[0] : { wallet: 0, walletTransactions: [], name: '', email: '' };

        for (let transaction of userData.walletTransactions) {
            transaction.transactionId = transaction._id.toString();
            if (transaction.orderId) {
                const order = await Order.findById(transaction.orderId).lean();
                if (order) {
                    transaction.source = `Order #${order.orderId}`;
                    transaction.orderLink = `/viewOrder?orderId=${order._id}`;
                } else {
                    transaction.source = 'Unknown Order';
                    transaction.orderLink = null;
                }
            } else {
                transaction.source = transaction.description || 'Manual Adjustment';
                transaction.orderLink = null;
            }
        }

        res.render('wallet', {
            walletBalance: userData.wallet || 0,
            transactions: userData.walletTransactions || [],
            user: {
                name: userData.name,
                email: userData.email
            },
        });
    } catch (error) {
        console.error('Error in viewWallet:', error);
        res.status(500).send('Server Error');
    }
};

const retryPaymentGet = async (req, res) => {
    try {
        const { orderId } = req.query;
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send("Invalid order ID");
        }

        const order = await Order.findById(orderId).populate({
            path: 'orderedItems.product',
            populate: { path: 'category', select: 'isListed' }
        });
        if (!order || order.userId.toString() !== userId.toString()) {
            return res.status(404).send("Order not found");
        }

        if (order.status !== 'Failed' || order.paymentStatus !== 'Failed') {
            return res.status(400).send("Order is not in a failed state");
        }

        const invalidItems = order.orderedItems.filter(item =>
            !item.product ||
            item.product.isBlocked ||
            item.product.quantity < item.quantity ||
            (item.product.category && !item.product.category.isListed)
        );
        if (invalidItems.length > 0) {
            return res.status(400).send("Some items in your order are unavailable, out of stock, or belong to unavailable categories.");
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        } else {
            cart.items = [];
        }

        cart.items = order.orderedItems.map(item => ({
            productId: item.product._id,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.price * item.quantity
        }));
        await cart.save();

        res.redirect(`/checkout?cartId=${cart._id}`);
    } catch (error) {
        console.error("Error retrying payment:", error);
        res.status(500).send("Server error");
    }
};

module.exports = {
    getCheckoutPage,
    applyCoupon,
    removeCoupon,
    createOrder,
    orderDetail,
    viewOrder,
    cancelOrder,
    getOrderPlacedPage,
    getOrderFailurePage,
    returnOrder,
    downloadInvoice,
    viewWallet,
    retryPayment,
    retryPaymentGet,
    createRazorpayOrder
};