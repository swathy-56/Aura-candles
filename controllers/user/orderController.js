const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { getResetPassword } = require("./profileController");
const { default: mongoose } = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const PDFDocument = require("pdfkit");
const fs = require("fs");
const Razorpay = require("razorpay");
const { HttpStatus, Messages } = require("../../shared/constants");

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// const getCheckoutPage = async (req, res) => {
//   try {
//     const userId = req.session.user._id;
//     const userData = req.session.user;

//     let cart = await Cart.findOne({ userId })
//       .populate("items.productId")
//       .populate("items.productId.category");

//     if (!cart || cart.items.length === 0) {
//       return res.render("cart", { message: Messages.CART_EMPTY });
//     }

//     const blockedItems = cart.items.filter((item) => {
//       return item.productId.isBlocked === true;
//     });

//     if (blockedItems.length > 0) {
//       return res.render("cart", {
//         cart,
//         message:
//           "Some items in your cart are no longer available or belong to unavailable categories. Please remove them to proceed.",
//         userData: userData,
//       });
//     }

//     const addresses = await Address.find({ userId });

//     const subtotal = cart.items.reduce(
//       (sum, item) => sum + item.price * item.quantity,
//       0
//     );

//     const pendingOrder = await Order.findOne({
//       userId,
//       status: "Pending",
//       "coupon.applied": true,
//     });

//     const totalPrice = pendingOrder?.finalAmount || subtotal;
//     const discount = pendingOrder?.coupon?.discountAmount || 0;
//     const couponCode = pendingOrder?.coupon?.code || "";

//     const coupons = await Coupon.find({
//       isActive: true,
//       expiryDate: { $gte: new Date() },
//     });

//     const user = await User.findById(userId).select("wallet");
//     const walletBalance = user.wallet || 0;

//     res.render("checkout", {
//       cart: cart.items,
//       addresses: addresses,
//       total: totalPrice,
//       cartId: cart._id,
//       userId: userId,
//       userData: userData,
//       couponApplied: pendingOrder?.coupon?.applied || false,
//       discount: pendingOrder?.coupon?.discountAmount || 0,
//       couponCode: couponCode,
//       coupons: coupons,
//       walletBalance: walletBalance,
//     });
//   } catch (error) {
//     console.error("Error fetching checkout page:", error);
//     res
//       .status(HttpStatus.SERVER_ERROR)
//       .json({ message: Messages.SERVER_ERROR });
//   }
// };

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userData = req.session.user;

    let cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .populate("items.productId.category");

    if (!cart || cart.items.length === 0) {
      return res.render("cart", { message: Messages.CART_EMPTY });
    }

    const blockedItems = cart.items.filter((item) => {
      return item.productId.isBlocked === true;
    });

    if (blockedItems.length > 0) {
      return res.render("cart", {
        cart,
        message:
          "Some items in your cart are no longer available or belong to unavailable categories. Please remove them to proceed.",
        userData: userData,
      });
    }

    // Fetch user to get default shipping address
    const user = await User.findById(userId).select("wallet shippingAddress");
    const addresses = await Address.find({ userId });

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const pendingOrder = await Order.findOne({
      userId,
      status: "Pending",
      "coupon.applied": true,
    });

    const totalPrice = pendingOrder?.finalAmount || subtotal;
    const discount = pendingOrder?.coupon?.discountAmount || 0;
    const couponCode = pendingOrder?.coupon?.code || "";

    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gte: new Date() },
    });

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
      walletBalance: walletBalance,
      defaultAddress: user.shippingAddress, // Add default address
    });
  } catch (error) {
    console.error("Error fetching checkout page:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ message: Messages.SERVER_ERROR });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, cartId } = req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: Messages.USER_NOT_AUTHENTICATED });
    }

    if (!couponCode || !cartId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Coupon code and cart ID are required",
      });
    }

    const cart = await Cart.findById(cartId).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: Messages.CART_NOT_FOUND });
    }

    // Check for existing order with this coupon
    let order = await Order.findOne({
      userId,
      "coupon.code": couponCode,
      status: { $ne: "Cancelled" },
    });

    if (order) {
      return res.json({
        success: false,
        message: Messages.COUPON_ALREADY_APPLIED,
      });
    }

    // Find coupon
    let coupon = await Coupon.findOne({
      code: couponCode,
      isActive: true,
      expiryDate: { $gte: new Date() },
    });

    if (!coupon) {
      const user = await User.findById(userId);
      const referralCoupon = user.coupons.find(
        (c) => c.code === couponCode && !c.isUsed && c.expiresAt > new Date()
      );
      if (!referralCoupon) {
        return res.json({ success: false, message: Messages.INVALID_COUPON });
      }
      coupon = {
        discountPercentage: referralCoupon.discount,
        maxDiscount: referralCoupon.maxDiscount || Number.MAX_VALUE,
        minimumAmount: referralCoupon.minAmount || 0,
      };
      user.coupons = user.coupons.map((c) =>
        c.code === couponCode ? { ...c, isUsed: true } : c
      );
      await user.save();
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (subtotal < coupon.minimumAmount) {
      return res.json({
        success: false,
        message: `Cart total must be at least ₹${coupon.minimumAmount} to apply this coupon`,
      });
    }

    const discountAmount = (subtotal * coupon.discountPercentage) / 100;
    const finalDiscount = Math.min(discountAmount, coupon.maxDiscount);
    const finalAmount = subtotal - finalDiscount;

    res.json({
      success: true,
      finalAmount: finalAmount,
      discountAmount: finalDiscount,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(HttpStatus.SERVER_ERROR).json({
      success: false,
      message: Messages.SERVER_ERROR,
      error: error.message,
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const { cartId } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.json({ success: false, message: Messages.CART_NOT_FOUND });
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    res.json({
      success: true,
      finalAmount: subtotal,
      discountAmount: 0,
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: Messages.SERVER_ERROR });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, cartId } = req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: Messages.USER_NOT_FOUND });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.INVALID_AMOUNT });
    }

    if (!cartId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Cart ID is required" });
    }

    const cart = await Cart.findById(cartId).populate({
      path: "items.productId",
      populate: { path: "category" },
    });
    if (!cart || cart.items.length === 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.CART_EMPTY });
    }

    const invalidItems = cart.items.filter(
      (item) =>
        !item.productId ||
        item.productId.isBlocked ||
        (item.productId.category && !item.productId.category.isListed) ||
        (typeof item.productId.quantity === "number" &&
          item.quantity > item.productId.quantity)
    );

    if (invalidItems.length > 0) {
      const outOfStockItems = invalidItems
        .filter(
          (item) =>
            typeof item.productId.quantity === "number" &&
            item.quantity > item.productId.quantity
        )
        .map(
          (item) =>
            `${item.productId.productName} (Available: ${item.productId.quantity}, Requested: ${item.quantity})`
        );
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: outOfStockItems.length
          ? `Insufficient stock for: ${outOfStockItems.join(", ")}`
          : "Some items in your cart are unavailable or out of stock.",
      });
    }

    const options = {
      amount: amount * 100, // In paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: Messages.SERVER_ERROR });
  }
};

const createRazorpayRetryPayment = async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: Messages.USER_NOT_FOUND });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.INVALID_AMOUNT });
    }

    if (!orderId) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Order ID is required" });
    }

    const orderData = await Order.findById(orderId);
    if (!orderData) {
      res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    const options = {
      amount: amount * 100, // In paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: Messages.SERVER_ERROR });
  }
};

const createOrder = async (req, res) => {
  try {
    console.log("createOrder input:", req.body);

    const userId = req.session.user?._id;
    if (!userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: Messages.USER_NOT_FOUND });
    }

    const {
      addressId,
      cartId,
      paymentMethod,
      finalAmount,
      paymentId,
      paymentStatus,
      orderId: providedOrderId,
      couponCode,
    } = req.body;

    console.log("here in create order controller =>", req.body);

    // ---------------------------

    let couponDiscount = 0;

    if (couponCode) {
      // Find coupon
      let coupon = await Coupon.findOne({
        code: couponCode,
        isActive: true,
        expiryDate: { $gte: new Date() },
      });

      if (!coupon) {
        const user = await User.findById(userId);
        const referralCoupon = user.coupons.find(
          (c) => c.code === couponCode && !c.isUsed && c.expiresAt > new Date()
        );
        if (!referralCoupon) {
          return res.json({ success: false, message: Messages.INVALID_COUPON });
        }
        coupon = {
          discountPercentage: referralCoupon.discount,
          maxDiscount: referralCoupon.maxDiscount || Number.MAX_VALUE,
          minimumAmount: referralCoupon.minAmount || 0,
        };
        user.coupons = user.coupons.map((c) =>
          c.code === couponCode ? { ...c, isUsed: true } : c
        );
        await user.save();
      }

      const cart = await Cart.findById(cartId).populate({
        path: "items.productId",
        populate: { path: "category" },
      });

      const subtotal = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      if (subtotal < coupon.minimumAmount) {
        return res.json({
          success: false,
          message: `Cart total must be at least ₹${coupon.minimumAmount} to apply this coupon`,
        });
      }

      const discountAmount = (subtotal * coupon.discountPercentage) / 100;
      couponDiscount = Math.min(discountAmount, coupon.maxDiscount);
    }

    // ----------------------------

    if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.INVALID_AMOUNT });
    }

    if (paymentMethod === "Cash On Delivery" && finalAmount > 1000) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Cash on Delivery is not available for orders above ₹1000.",
      });
    }

    const currentAddress = await Address.findById(addressId);
    if (!currentAddress) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.ADDRESS_NOT_FOUND });
    }

    const cart = await Cart.findById(cartId).populate({
      path: "items.productId",
      populate: { path: "category" },
    });

    if (!cart || cart.items.length === 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.CART_EMPTY });
    }

    const invalidItems = cart.items.filter(
      (item) =>
        !item.productId ||
        item.productId.isBlocked ||
        item.productId.quantity < item.quantity ||
        (item.productId.category && !item.productId.category.isListed)
    );
    if (invalidItems.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Some items in your cart are unavailable or out of stock.",
      });
    }

    const pendingOrder = await Order.findOne({
      userId,
      status: "Pending",
    }).populate("orderedItems.product");

    let orderItems = cart.items.map((item) => {
      const categoryOffer = item.productId.category.categoryOffer || 0;
      const productOffer = item.productId.productOffer || 0;
      const totalOffer = Math.max(categoryOffer, productOffer);

      return {
        product: item.productId._id,
        quantity: item.quantity,
        price:
          item.productId.regularPrice -
          (item.productId.regularPrice * totalOffer) / 100,
        status: paymentStatus === "Failed" ? "Failed" : "Pending",
      };
    });

    const cartItemsSet = new Set(
      cart.items.map((item) => `${item.productId._id}:${item.quantity}`)
    );

    let walletTransactionTempId = null;
    let orderStatus = paymentStatus === "Failed" ? "Failed" : "Pending";

    if (paymentMethod === "Wallet" && paymentStatus !== "Failed") {
      const user = await User.findById(userId);
      const walletBalance = user.wallet || 0;
      if (walletBalance < finalAmount) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "Insufficient wallet balance.",
        });
      }

      walletTransactionTempId = new mongoose.Types.ObjectId();
      await User.findByIdAndUpdate(userId, {
        $inc: { wallet: -finalAmount },
        $push: {
          walletTransactions: {
            _id: walletTransactionTempId,
            type: "debit",
            amount: finalAmount,
            description: `Payment for order #pending`,
            orderId: null,
            date: new Date(),
          },
        },
      });
    }

    const totalPrice = cart.items.reduce(
      (sum, item) => sum + item.productId.regularPrice * item.quantity,
      0
    );
    const actualDiscount = totalPrice - finalAmount;

    let newOrder;

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

    const orderData = {
      userId,
      orderId: providedOrderId || (await generateOrderId()),
      orderedItems: orderItems,
      address: {
        name: currentAddress.name,
        city: currentAddress.city,
        phone: currentAddress.phone,
        pincode: currentAddress.pincode,
        state: currentAddress.state,
        landMark: currentAddress.landMark,
        altPhone: currentAddress.altPhone,
      },
      totalPrice: totalPrice,
      finalAmount: finalAmount,
      originalAmount: finalAmount,
      discount: actualDiscount,
      coupon: couponCode
        ? {
            code: couponCode,
            discountAmount: couponDiscount,
            applied: true,
          }
        : {
            code: null,
            discountAmount: 0,
            applied: false,
          },
      paymentMethod,
      paymentId:
        paymentMethod === "Razorpay" && paymentStatus !== "Failed"
          ? paymentId
          : undefined,
      status: orderStatus,
      paymentStatus: paymentStatus || "Pending",
      createdOn: new Date(),
    };

    newOrder = await Order.create(orderData);
    console.log("Created new order:", newOrder._id, newOrder.status);

    if (
      paymentMethod === "Wallet" &&
      walletTransactionTempId &&
      orderStatus !== "Failed"
    ) {
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

    // Delete the cart regardless of order status
    await Cart.findByIdAndDelete(cartId);
    console.log("Deleted cart:", cartId);

    // Update product quantities only if the order is not failed
    if (orderStatus !== "Failed") {
      if (pendingOrder) {
        const pendingOrderItemsSet = new Set(
          pendingOrder.orderedItems
            .filter((item) => item.product)
            .map((item) => `${item.product._id}:${item.quantity}`)
        );
        const itemsMatch =
          cartItemsSet.size === pendingOrderItemsSet.size &&
          [...cartItemsSet].every((item) => pendingOrderItemsSet.has(item));
        if (itemsMatch) {
          await Order.findByIdAndDelete(pendingOrder._id);
          console.log("Deleted matching pending order:", pendingOrder._id);
        } else {
          console.log(
            "Skipped deletion of unrelated pending order:",
            pendingOrder._id
          );
        }
      }

      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity },
        });
      }
    }

    return res.status(200).json({
      success: orderStatus !== "Failed",
      message:
        orderStatus === "Failed"
          ? "Order created but payment failed"
          : "Order placed successfully",
      orderId: newOrder._id,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return res.status(HttpStatus.SERVER_ERROR).json({
      success: false,
      message: `Failed to create order: ${error.message}`,
    });
  }
};

const orderDetail = async (req, res) => {
  const orderId = req.params.orderId;

  if (!req.session || !req.session.user) {
    return res.status(HttpStatus.UNAUTHORIZED).send("User not logged in");
  }

  const userId = req.session.user._id;

  try {
    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
    }).populate({
      path: "orderedItems.product",
      model: "Product",
    });

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).send("Order not found");
    }

    res.render("orderDetails", { orders: [order] });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(HttpStatus.SERVER_ERROR).send("Internal server error");
  }
};

const viewOrder = async (req, res) => {
  try {
    if (!req.session || !req.session.user || !req.session.user._id) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .send("Please log in to view orders");
    }

    const userId = req.session.user._id;
    const searchQuery = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = { userId };

    if (searchQuery) {
      const isValidObjectId = mongoose.Types.ObjectId.isValid(searchQuery);

      query.$or = [{ "userId.name": { $regex: searchQuery, $options: "i" } }];

      if (isValidObjectId) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(searchQuery) });
      }

      const productMatch = await Product.find({
        productName: { $regex: searchQuery, $options: "i" },
      }).select("_id");

      if (productMatch.length > 0) {
        query.$or.push({
          "orderedItems.product": { $in: productMatch.map((p) => p._id) },
        });
      }
    }

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .populate("userId", "name email phone")
      .populate("orderedItems.product", "productName regularPrice")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    console.log({
      orders,
      search: searchQuery,
      page,
      totalPages,
      totalOrders,
    });
    res.render("orders", {
      orders,
      search: searchQuery,
      currentPage: page,
      totalPages,
      totalOrders,
    });
  } catch (error) {
    console.error("Error in viewOrder:", error);
    res.status(HttpStatus.SERVER_ERROR).send("Server error: " + error.message);
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId, productId, fullOrder, cancelReason } = req.body;
    const userId = req.session.user?._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: Messages.INVALID_ORDERID });
    }

    const order = await Order.findById(orderId).populate(
      "orderedItems.product"
    );
    if (!order) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: Messages.ORDER_NOT_FOUND });
    }

    if (order.status === "Failed") {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: Messages.FAILED_ORDERS });
    }

    let refundAmount = 0;

    if (fullOrder) {
      if (
        order.status.toLowerCase() === "delivered" ||
        order.status.toLowerCase() === "cancelled"
      ) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: Messages.ORDER_CANNOT_BE_CANCELLED });
      }

      for (const item of order.orderedItems) {
        item.status = "Cancelled";
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { quantity: item.quantity },
        });
      }

      order.status = "Cancelled";
      refundAmount = order.finalAmount;
      order.cancelReason = cancelReason;
    } else {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: Messages.INVALID_PRODUCTID });
      }

      const item = order.orderedItems.find(
        (item) => item.product._id.toString() === productId
      );
      if (!item) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ message: Messages.PRODUCT_NOT_FOUND });
      }

      if (
        item.status &&
        (item.status.toLowerCase() === "delivered" ||
          item.status.toLowerCase() === "cancelled")
      ) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: Messages.ITEM_CANNOT_BE_CANCELLED });
      }

      item.status = "Cancelled";
      item.cancelReason = cancelReason;
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity },
      });

      // Calculate the item's contribution to the total price
      const itemTotal = item.price * item.quantity;

      // Proportionally distribute the coupon discount
      const effectiveDiscount = order.coupon.applied
        ? order.coupon.discountAmount
        : 0;
      const totalPriceBeforeDiscount = order.orderedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const itemDiscount =
        totalPriceBeforeDiscount > 0
          ? (itemTotal / totalPriceBeforeDiscount) * effectiveDiscount
          : 0;

      // Calculate refund amount (item's price after discount)
      refundAmount = itemTotal - itemDiscount;

      // Check if all items are now cancelled
      const remainingItems = order.orderedItems.filter(
        (item) => item.status !== "Cancelled"
      );

      if (remainingItems.length === 0) {
        order.status = "Cancelled";
        // Do NOT reset totalPrice or finalAmount; they should retain original values
      }
      // Remove the else block that recalculates finalAmount
    }

    await order.save();

    if (refundAmount > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { wallet: refundAmount },
        $push: {
          walletTransactions: {
            type: "credit",
            amount: refundAmount,
            description: `Refund for cancelled item in order #${order.orderId}`,
            orderId: order._id,
          },
        },
      });
    }

    return res.json({
      success: true,
      message: `Item cancelled successfully. ₹${refundAmount.toFixed(
        2
      )} refunded to wallet.`,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ message: Messages.SERVER_ERROR });
  }
};


const getOrderPlacedPage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).send(Messages.USER_NOT_FOUND);
    }

    const userData = await User.findById(userId);
    let orderId = req.query.orderId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(HttpStatus.BAD_REQUEST).send(Messages.INVALID_ORDERID);
    }

    const order = await Order.findOne({ _id: new ObjectId(orderId) }).populate(
      "orderedItems.product"
    );

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).send(Messages.ORDER_NOT_FOUND);
    }

    res.render("order-placed", { order, userData });
  } catch (error) {
    console.error("Error rendering order-placed page:", error);
    res.status(HttpStatus.SERVER_ERROR).send(Messages.SERVER_ERROR);
  }
};

const getOrderFailurePage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).send(Messages.USER_NOT_FOUND);
    }

    const { cartId, reason, orderId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(cartId)) {
      return res.status(HttpStatus.BAD_REQUEST).send(Messages.INVALID_CARTID);
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(HttpStatus.BAD_REQUEST).send(Messages.INVALID_ORDERID);
    }

    // Fetch the order to get the finalAmount
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).send(Messages.ORDER_NOT_FOUND);
    }

    res.render("order-failure", {
      cartId,
      reason,
      orderId,
      amount: order.finalAmount, // Send finalAmount as amount
    });
  } catch (error) {
    console.error("Error rendering order-failure page:", error);
    res.status(HttpStatus.SERVER_ERROR).send(Messages.SERVER_ERROR);
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user?._id;

    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).send(
        Messages.USER_NOT_FOUND
      );
    }

    const order = await Order.findOne({ _id: orderId, userId }).populate({
      path: "orderedItems.product",
      model: "Product",
    });

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).send(
        Messages.ORDER_NOT_FOUND
      );
    }

    if (order.status === "Cancelled" || order.status === "Failed") {
      return res.status(403).send(Messages.INVOICE_NOT_AVAILABLE);
    }

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const filename = `invoice_${orderId}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    const effectiveDiscount = Number(
      (order.totalPrice - order.finalAmount).toFixed(2)
    );

    // Calculate item discounts and totals to match order summary
    const totalPrice = Number(order.totalPrice.toFixed(2));
    const finalAmount = Number(order.finalAmount.toFixed(2));
    const productDiscounts = [];
    const productTotals = [];
    let accumulatedDiscount = 0;

    order.orderedItems.forEach((item, index) => {
      const itemTotal = Number((item.quantity * item.price).toFixed(2));
      let itemDiscount;

      if (index === order.orderedItems.length - 1) {
        // For the last item, assign remaining discount to match effectiveDiscount
        itemDiscount = Number(
          (effectiveDiscount - accumulatedDiscount).toFixed(2)
        );
      } else {
        // Proportional discount based on item total
        itemDiscount = Number(
          (
            (itemTotal / totalPrice) * effectiveDiscount
          ).toFixed(2)
        );
        accumulatedDiscount = Number(
          (accumulatedDiscount + itemDiscount).toFixed(2)
        );
      }

      const discountedTotal = Number(
        (itemTotal - itemDiscount).toFixed(2)
      );

      productDiscounts.push(itemDiscount);
      productTotals.push(discountedTotal);
    });

    // Verify that discounted totals sum to finalAmount
    const sumDiscountedTotals = Number(
      productTotals.reduce((sum, total) => sum + total, 0).toFixed(2)
    );
    if (sumDiscountedTotals !== finalAmount) {
      // Adjust the last item's total to ensure sum matches finalAmount
      const adjustment = Number(
        (finalAmount - sumDiscountedTotals).toFixed(2)
      );
      productTotals[productTotals.length - 1] = Number(
        (
          productTotals[productTotals.length - 1] + adjustment
        ).toFixed(2)
      );
      // Adjust the last discount accordingly
      const lastItemTotal =
        order.orderedItems[order.orderedItems.length - 1].quantity *
        order.orderedItems[order.orderedItems.length - 1].price;
      productDiscounts[productDiscounts.length - 1] = Number(
        (
          lastItemTotal - productTotals[productTotals.length - 1]
        ).toFixed(2)
      );
    }

    doc.rect(0, 0, doc.page.width, 80).fill("#1a3c34");
    doc
      .fillColor("#ffffff")
      .fontSize(24)
      .text("Invoice", 50, 30, { align: "center" });

    doc.fillColor("#000000");

    doc.moveDown(2);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`Order ID: ${order.orderId}`, 50, doc.y, { align: "left" });
    doc
      .font("Helvetica")
      .text(`Order Date: ${order.createdOn.toDateString()}`, 50, doc.y, {
        align: "left",
      });

    doc.moveDown(1);
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#1a3c34")
      .text("Shipping Address:", { underline: true });
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#000000")
      .text(`${order.address.name}`)
      .text(`${order.address.phone}`)
      .text(
        `${order.address.city}, ${order.address.state} ${order.address.pincode}`
      )
      .text(`${order.address.landMark}`)
      .moveDown();

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#1a3c34")
      .text("Order Items:", { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = {
      product: 200,
      qty: 50,
      price: 70,
      discount: 70,
      total: 70,
    };

    doc.rect(tableLeft, tableTop - 5, 460, 25).fill("#f0f0f0");

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1a3c34")
      .text("Product", tableLeft, tableTop, { width: colWidths.product })
      .text("Qty", tableLeft + colWidths.product, tableTop, {
        width: colWidths.qty,
        align: "center",
      })
      .text("Price", tableLeft + colWidths.product + colWidths.qty, tableTop, {
        width: colWidths.price,
        align: "right",
      })
      .text(
        "Discount",
        tableLeft + colWidths.product + colWidths.qty + colWidths.price,
        tableTop,
        { width: colWidths.discount, align: "right" }
      )
      .text(
        "Total",
        tableLeft +
          colWidths.product +
          colWidths.qty +
          colWidths.price +
          colWidths.discount,
        tableTop,
        { width: colWidths.total, align: "right" }
      );

    doc
      .moveTo(tableLeft, tableTop + 20)
      .lineTo(tableLeft + 460, tableTop + 20)
      .stroke();

    let yPosition = tableTop + 25;
    order.orderedItems.forEach((item, index) => {
      const itemDiscount = productDiscounts[index];
      const discountedTotal = productTotals[index];

      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#000000")
        .text(item.product.productName, tableLeft, yPosition, {
          width: colWidths.product,
        })
        .text(
          item.quantity.toString(),
          tableLeft + colWidths.product,
          yPosition,
          { width: colWidths.qty, align: "center" }
        )
        .text(
          `₹${item.price.toFixed(2)}`,
          tableLeft + colWidths.product + colWidths.qty,
          yPosition,
          { width: colWidths.price, align: "center" }
        )
        .text(
          `₹${itemDiscount.toFixed(2)}`,
          tableLeft + colWidths.product + colWidths.qty + colWidths.price,
          yPosition,
          { width: colWidths.discount, align: "center" }
        )
        .text(
          `₹${discountedTotal.toFixed(2)}`,
          tableLeft +
            colWidths.product +
            colWidths.qty +
            colWidths.price +
            colWidths.discount,
          yPosition,
          { width: colWidths.total, align: "center" }
        );

      doc
        .moveTo(tableLeft, yPosition + 20)
        .lineTo(tableLeft + 460, yPosition + 20)
        .stroke();

      yPosition += 25;
    });

    let currentX = tableLeft;
    [
      0,
      colWidths.product,
      colWidths.qty,
      colWidths.price,
      colWidths.discount,
      colWidths.total,
    ].forEach((width) => {
      doc
        .moveTo(currentX, tableTop - 5)
        .lineTo(currentX, yPosition)
        .stroke();
      currentX += width;
    });

    doc.moveDown(2);
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#1a3c34")
      .text("Order Summary:", { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#000000")
      .text(`Subtotal: ₹${totalPrice.toFixed(2)}`, 400, doc.y, {
        align: "right",
      })
      .text(`Discount: ₹${effectiveDiscount.toFixed(2)}`, { align: "right" })
      .text(`Shipping: Free`, { align: "right" })
      .text(`Total: ₹${finalAmount.toFixed(2)}`, { align: "right" });

    doc.moveDown(2);
    doc
      .fontSize(10)
      .font("Helvetica-Oblique")
      .fillColor("#666666")
      .text("Thank you for shopping with Aura Candles!", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(HttpStatus.SERVER_ERROR).send(Messages.SERVER_ERROR);
  }
};

const returnOrder = async (req, res) => {
  try {
    const { orderId, productId, returnReason } = req.body;
    const userId = req.session.user?._id;

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.INVALID_PRODUCTID });
    }
    if (!returnReason || returnReason.trim() === "") {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.RETURN_REASON });
    }

    const order = await Order.findOne({ _id: orderId }).populate(
      "orderedItems.product"
    );
    if (!order) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: Messages.ORDER_NOT_FOUND });
    }

    const item = order.orderedItems.find(
      (item) => item.product._id.toString() === productId
    );
    if (!item) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: Messages.PRODUCT_NOT_FOUND });
    }

    if (!item.status || item.status.toLowerCase() !== "delivered") {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.DELIVERED_ITEMS_RETURNED });
    }
    
    if (
      item.status.toLowerCase() === "returned" ||
      item.status.toLowerCase() === "return request"
    ) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.PENDING_RETURN_REQUEST });
    }

    item.status = "Return Request";
    item.returnReason = returnReason;

    const allItemsReturned = order.orderedItems.every(
      (item) => item.status.toLowerCase() === "returned"
    );
    const allItemsReturnRequested = order.orderedItems.every(
      (item) =>
        item.status.toLowerCase() === "return request" ||
        item.status.toLowerCase() === "returned"
    );
    if (allItemsReturned) {
      order.status = "Returned";
    } else if (allItemsReturnRequested) {
      order.status = "Return Request";
    }

    await order.save();

    return res.json({
      success: true,
      message: `Return request submitted successfully.`,
    });
  } catch (error) {
    console.error("Return request error:", error);
    return res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: Messages.SERVER_ERROR });
  }
};


const viewWallet = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.redirect("/login");
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
        $unwind: "$walletTransactions",
      },
      {
        $sort: {
          "walletTransactions.date": -1,
        },
      },
      {
        $group: {
          _id: "$_id",
          wallet: { $first: "$wallet" },
          walletTransactions: { $push: "$walletTransactions" },
          name: { $first: "$name" },
          email: { $first: "$email" },
        },
      },
    ]);

    const userData =
      user.length > 0
        ? user[0]
        : { wallet: 0, walletTransactions: [], name: "", email: "" };

    for (let transaction of userData.walletTransactions) {
      transaction.transactionId = transaction._id.toString();
      if (transaction.orderId) {
        const order = await Order.findById(transaction.orderId).lean();
        if (order) {
          transaction.source = `Order #${order.orderId}`;
          transaction.orderLink = `/viewOrder?orderId=${order._id}`;
        } else {
          transaction.source = "Unknown Order";
          transaction.orderLink = null;
        }
      } else {
        transaction.source = transaction.description || "Manual Adjustment";
        transaction.orderLink = null;
      }
    }

    res.render("wallet", {
      walletBalance: userData.wallet || 0,
      transactions: userData.walletTransactions || [],
      user: {
        name: userData.name,
        email: userData.email,
      },
    });
  } catch (error) {
    console.error("Error in viewWallet:", error);
    res.status(HttpStatus.SERVER_ERROR).send(Messages.SERVER_ERROR);
  }
};

const updateOrderPaymentStatus = async (req, res) => {
  try {
    const { orderId, paymentStatus, paymentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.INVALID_ORDERID });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: Messages.ORDER_NOT_FOUND });
    }

    if (order.userId.toString() !== req.session.user?._id) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: Messages.UNAUTHORIZED });
    }

    order.paymentStatus = paymentStatus;
    order.status = paymentStatus === "Success" ? "Pending" : "Failed";

    if (paymentStatus === "Success") {
      order.orderedItems = order.orderedItems.map((item) => ({
        ...item.toObject(),
        status: "Pending",
      }));
    }

    if (paymentId && paymentStatus === "Success") {
      order.paymentId = paymentId;
    }

    await order.save();

    res.status(200).json({ success: true, message: "Payment Status Updated" });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: Messages.SERVER_ERROR });
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
  createRazorpayOrder,
  updateOrderPaymentStatus,
  createRazorpayRetryPayment,
};
