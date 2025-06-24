const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const { HttpStatus, Messages } = require("../../shared/constants");
const { Types } = require("mongoose");

const orderList = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    let matchQuery = {};

    if (status) matchQuery.status = status;

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
        },
      },
      { $unwind: "$userId" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "orderedItems.product",
        },
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { orderId: { $regex: search, $options: "i" } },
            { "userId.name": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { createdOn: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    const orders = await Order.aggregate(pipeline).exec();

    const countPipeline = [...pipeline];
    countPipeline.splice(-2, 2);
    countPipeline.push({ $count: "total" });
    const countResult = await Order.aggregate(countPipeline).exec();
    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.render("orderlist", {
      orders,
      search: search || "",
      status: status || "",
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching Orders:", error.message, error.stack);
    res.render("orderlist", {
      orders: [],
      search: req.query.search || "",
      status: req.query.status || "",
      currentPage: parseInt(req.query.page) || 1,
      totalPages: 1,
      error: "An error occurred while fetching orders. Please try again.",
    });
  }
};

const orderDetails = async (req, res) => {
  try {
    console.log("Fetching updated order details...");
    const order = await Order.findById(req.query.orderId)
      .populate("userId", "name email")
      .populate("orderedItems.product", "productName regularPrice")
      .populate("address");

    console.log("Fetched Order:", order);

    if (!order) return res.status(HttpStatus.NOT_FOUND).send("Order not found");
    console.log("Passing Order to EJS:", order);
    res.render("order-details", { order });
  } catch (error) {
    console.error("Error fetching order details:", error.message, error.stack);
    res.redirect("/admin/pageerror");
  }
};

const updateItemStatus = async (req, res) => {
  try {
    console.log("updateItemStatus called with:", req.body);
    const { orderId, productId, status } = req.body;
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];
    if (!validStatuses.includes(status)) {
      console.log("Invalid status received:", status);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid Status" });
    }

    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .populate("userId");
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    console.log("Order found:", {
      id: order._id,
      currentStatus: order.status,
      finalAmount: order.finalAmount,
      userId: order.userId?._id,
    });

    const item = order.orderedItems.find(
      (item) => item.product._id.toString() === productId
    );
    if (!item) {
      console.log("Product not found in order:", productId);
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Product not found in order" });
    }

    if (item.status === "Return Request" || item.status === "Returned") {
      console.log("Cannot update item status due to:", item.status);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          success: false,
          message:
            "Cannot update status of an item with a return request or returned status",
        });
    }

    item.status = status;

    if (status === "Cancelled") {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity },
      });
      console.log("Product quantity incremented:", item.product._id);
    }

    const allItemsDelivered = order.orderedItems.every(
      (item) => item.status === "Delivered"
    );
    const allItemsCancelled = order.orderedItems.every(
      (item) => item.status === "Cancelled"
    );
    const anyItemReturnRequested = order.orderedItems.some(
      (item) => item.status === "Return Request"
    );
    const allItemsReturned = order.orderedItems.every(
      (item) => item.status === "Returned"
    );

    let refundProcessed = false;
    let refundAmount = 0;

    if (allItemsDelivered) {
      order.status = "Delivered";
    } else if (allItemsCancelled && order.status !== "Cancelled") {
      order.status = "Cancelled";
      refundAmount = order.finalAmount;
      console.log("All items cancelled, setting order status to Cancelled, refund amount:", refundAmount);

      if (refundAmount > 0 && order.userId?._id) {
        const user = await User.findById(order.userId._id);
        if (!user) {
          console.log("User not found for ID:", order.userId._id);
          return res
            .status(HttpStatus.NOT_FOUND)
            .json({ success: false, message: "User not found" });
        }

        console.log("User found:", {
          id: user._id,
          currentWallet: user.wallet,
        });

        const userUpdate = await User.findByIdAndUpdate(
          order.userId._id,
          {
            $inc: { wallet: refundAmount },
            $push: {
              walletTransactions: {
                type: "credit",
                amount: refundAmount,
                description: `Refund for cancelled order #${order.orderId}`,
                orderId: order._id,
                date: new Date(),
              },
            },
          },
          { new: true, runValidators: true }
        );

        if (!userUpdate) {
          console.log("Failed to update user wallet for user ID:", order.userId._id);
          return res
            .status(HttpStatus.SERVER_ERROR)
            .json({ success: false, message: "Failed to update user wallet" });
        }

        console.log(
          "Wallet updated for user:",
          order.userId._id,
          "New balance:",
          userUpdate.wallet,
          "Transaction added:",
          userUpdate.walletTransactions[userUpdate.walletTransactions.length - 1]
        );
        refundProcessed = true;
      } else if (refundAmount <= 0) {
        console.log("No refund processed due to zero or negative finalAmount:", refundAmount);
      } else {
        console.log("User ID missing from order:", orderId);
      }
    } else if (allItemsReturned) {
      order.status = "Returned";
    } else if (anyItemReturnRequested) {
      order.status = "Return Request";
    } else {
      const activeStatuses = order.orderedItems
        .filter(
          (item) =>
            !["Cancelled", "Return Request", "Returned"].includes(item.status)
        )
        .map((item) => item.status);
      const statusPriority = ["Pending", "Processing", "Shipped", "Delivered"];
      order.status =
        activeStatuses.length > 0
          ? statusPriority[
              Math.min(...activeStatuses.map((s) => statusPriority.indexOf(s)))
            ]
          : "Cancelled";
    }

    await order.save();
    console.log("Order status updated:", order._id, "New status:", order.status);

    res.json({
      success: true,
      message: refundProcessed
        ? `Item status updated, order cancelled, ₹${refundAmount} refunded to wallet`
        : "Item status updated successfully",
    });
  } catch (error) {
    console.error("Error updating item status:", error.message, error.stack);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: `Server error: ${error.message}` });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    console.log("updateOrderStatus called with:", req.body);
    const { orderId, status } = req.body;
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
    ];
    if (!validStatuses.includes(status)) {
      console.log("Invalid status received:", status);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid Status" });
    }

    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .populate("userId");
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    console.log("Order found:", {
      id: order._id,
      currentStatus: order.status,
      finalAmount: order.finalAmount,
      userId: order.userId?._id,
    });

    // Prevent cancellation if order is already Delivered, Returned, or has a Return Request
    if (
      status === "Cancelled" &&
      (order.status === "Delivered" ||
        order.status === "Returned" ||
        order.status === "Return Request")
    ) {
      console.log(
        "Cannot cancel order due to status:",
        order.status,
        "Order ID:",
        orderId
      );
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          success: false,
          message:
            "Cannot cancel an order that is Delivered, Returned, or has a Return Request",
        });
    }

    let refundAmount = 0; // Initialize refundAmount to avoid undefined error

    // If cancelling the order
    if (status === "Cancelled") {
      // Prevent duplicate refunds
      if (order.status === "Cancelled") {
        console.log("Order already cancelled:", orderId);
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ success: false, message: "Order is already cancelled" });
      }

      // Update product quantities and item statuses
      for (const item of order.orderedItems) {
        item.status = "Cancelled";
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { quantity: item.quantity },
        });
      }

      // Calculate refund amount
      refundAmount = order.finalAmount;
      console.log("Calculated refund amount:", refundAmount);

      if (refundAmount <= 0) {
        console.log(
          "No refund processed due to zero or negative finalAmount:",
          refundAmount,
          "Order ID:",
          orderId
        );
      } else if (order.userId?._id) {
        // Verify user exists
        const user = await User.findById(order.userId._id);
        if (!user) {
          console.log("User not found for ID:", order.userId._id);
          return res
            .status(HttpStatus.NOT_FOUND)
            .json({ success: false, message: "User not found" });
        }

        console.log("User found:", {
          id: user._id,
          currentWallet: user.wallet,
        });

        // Update user's wallet and add transaction
        const userUpdate = await User.findByIdAndUpdate(
          order.userId._id,
          {
            $inc: { wallet: refundAmount },
            $push: {
              walletTransactions: {
                type: "credit",
                amount: refundAmount,
                description: `Refund for cancelled order #${order.orderId}`,
                orderId: order._id,
                date: new Date(),
              },
            },
          },
          { new: true, runValidators: true }
        );

        if (!userUpdate) {
          console.log(
            "Failed to update user wallet for user ID:",
            order.userId._id
          );
          return res
            .status(HttpStatus.SERVER_ERROR)
            .json({ success: false, message: "Failed to update user wallet" });
        }

        console.log(
          "Wallet updated for user:",
          order.userId._id,
          "New balance:",
          userUpdate.wallet,
          "Transaction added:",
          userUpdate.walletTransactions[userUpdate.walletTransactions.length - 1]
        );
      } else {
        console.log("User ID missing from order:", orderId);
        return res
          .status(HttpStatus.SERVER_ERROR)
          .json({ success: false, message: "User ID missing from order" });
      }
    }

    // Update order status
    order.status = status;

    // If not cancelling, ensure item statuses align with order status
    if (status !== "Cancelled") {
      order.orderedItems.forEach((item) => {
        if (
          !["Cancelled", "Return Request", "Returned"].includes(item.status)
        ) {
          item.status = status;
        }
      });
    }

    await order.save();
    console.log("Order status updated:", order._id, "New status:", status);

    res.json({
      success: true,
      message:
        status === "Cancelled" && refundAmount > 0
          ? `Order cancelled, ₹${refundAmount} refunded to wallet`
          : "Status updated",
    });
  } catch (error) {
    console.error("Error updating status:", error.message, error.stack);
    res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: `Server error: ${error.message}` });
  }
};

const getReturnRequests = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      // Match orders with at least one item in "Return Request" status
      { $match: { "orderedItems.status": "Return Request" } },
      // Filter orderedItems to include only those with "Return Request" status
      {
        $project: {
          userId: 1,
          orderId: 1,
          totalPrice: 1,
          discount: 1,
          finalAmount: 1,
          coupon: 1,
          orderedItems: {
            $filter: {
              input: "$orderedItems",
              as: "item",
              cond: { $eq: ["$$item.status", "Return Request"] },
            },
          },
        },
      },
      // Populate userId and product details
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId",
        },
      },
      { $unwind: "$userId" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      // Restructure orderedItems to include populated product details
      {
        $addFields: {
          orderedItems: {
            $map: {
              input: "$orderedItems",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    product: {
                      $arrayElemAt: [
                        "$productDetails",
                        {
                          $indexOfArray: [
                            "$productDetails._id",
                            "$$item.product",
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      // Remove temporary productDetails field
      { $project: { productDetails: 0 } },
    ]);

    res.render("return", { returns: orders });
  } catch (error) {
    console.error("Error fetching returns:", error.message, error.stack);
    res.redirect("/admin/pageerror");
  }
};


const processReturn = async (req, res) => {
  try {
    const { orderId, productId, action, adminNote } = req.body;
    console.log("Request body received:", {
      orderId,
      productId,
      action,
      adminNote,
    });

    if (
      !Types.ObjectId.isValid(orderId) ||
      !Types.ObjectId.isValid(productId)
    ) {
      console.log("Invalid orderId or productId:", orderId, productId);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.INVALID_PRODUCTID });
    }

    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("orderedItems.product");
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: Messages.ORDER_NOT_FOUND });
    }

    const item = order.orderedItems.find(
      (i) => i.product._id.toString() === productId
    );
    if (!item) {
      console.log("Item not found in order:", productId);
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: Messages.PRODUCT_NOT_FOUND });
    }

    if (item.status !== "Return Request") {
      console.log("Item status is not Return Request:", item.status);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          success: false,
          message: "Item is not in return request status",
        });
    }

    let refundAmount = 0;

    if (action === "approve") {
      // Calculate refund amount
      const itemTotal = item.price * item.quantity;
      const totalPriceBeforeDiscount = order.orderedItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );
      const effectiveDiscount = order.coupon.applied
        ? order.coupon.discountAmount
        : 0;
      const itemDiscount =
        totalPriceBeforeDiscount > 0
          ? (itemTotal / totalPriceBeforeDiscount) * effectiveDiscount
          : 0;
      refundAmount = itemTotal - itemDiscount;

      // Update item status
      item.status = "Returned";

      // Restock product
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity },
      });

      // Credit refund to user's wallet
      if (refundAmount > 0) {
        const userUpdate = await User.findByIdAndUpdate(
          order.userId._id,
          {
            $inc: { wallet: refundAmount },
            $push: {
              walletTransactions: {
                type: "credit",
                amount: refundAmount,
                description: `Refund for returned item in order #${order.orderId}`,
                orderId: order._id,
                date: new Date(),
              },
            },
          },
          { new: true, runValidators: true }
        );
        if (!userUpdate) {
          console.log("User update failed, no document returned");
          return res
            .status(HttpStatus.SERVER_ERROR)
            .json({ success: false, message: "Failed to update user wallet" });
        }
        console.log(
          "User wallet updated:",
          userUpdate.wallet,
          userUpdate.walletTransactions
        );
      }
    } else if (action === "reject") {
      item.status = "Delivered";
    } else {
      console.log("Invalid action:", action);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid action. Use 'approve' or 'reject'" });
    }

    // Update order status
    const allItemsReturned = order.orderedItems.every(
      (i) => i.status.toLowerCase() === "returned"
    );
    const allItemsReturnRequested = order.orderedItems.every(
      (i) =>
        i.status.toLowerCase() === "return request" ||
        i.status.toLowerCase() === "returned"
    );
    if (allItemsReturned) {
      order.status = "Returned";
    } else if (allItemsReturnRequested) {
      order.status = "Return Request";
    } else {
      order.status = "Delivered";
    }

    // // Add admin note if provided
    // if (adminNote) {
    //   order.adminNote = adminNote;
    // }

    await order.save();
    console.log("Order updated:", order._id, "Status:", order.status);

    return res.json({
      success: true,
      message: action === "approve"
        ? `Return approved, ₹${refundAmount.toFixed(2)} refunded to wallet`
        : "Return rejected",
    });
  } catch (error) {
    console.error("Error processing return:", error.message, error.stack);
    return res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: Messages.SERVER_ERROR });
  }
};

module.exports = {
  orderList,
  orderDetails,
  updateItemStatus,
  updateOrderStatus,
  getReturnRequests,
  processReturn,
};