const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const session = require("express-session");
const mongoose = require("mongoose");
const { HttpStatus, Messages } = require("../../shared/constants");

const addToCart = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: Messages.UNAUTHORIZED_LOGIN });
    }

    const userId = req.session.user._id;
    const { productId } = req.body;

    const user = await User.findById(userId);
    if (user && user.isBlocked) {
      return res.status(403).json({ message: Messages.BLOCKED_CART });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: Messages.INVALID_PRODUCTID });
    }

    const product = await Product.findById(productId)
      .populate("category", "isListed categoryOffer")
      .select("regularPrice category isBlocked quantity productOffer");

    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: Messages.PRODUCT_NOT_FOUND });
    }

    if (product.isBlocked || (product.category && !product.category.isListed)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: Messages.PRODUCT_CART });
    }

    if (product.quantity <= 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: Messages.PRODUCT_OUT_OF_STOCK });
    }

    // Calculate discounted price (same as productController.js)
    const productOffer = product.productOffer || 0;
    const categoryOffer = product.category?.categoryOffer || 0;
    const bestOffer = Math.max(productOffer, categoryOffer);
    const finalPrice = bestOffer > 0
      ? product.regularPrice - (product.regularPrice * bestOffer / 100)
      : product.regularPrice;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [], totalPrice: 0 });
    }

    const productObjectId = new mongoose.Types.ObjectId(productId);
    const cartItem = cart.items.find((item) => item.productId.equals(productObjectId));

    const maxQtyPerPerson = 5;

    if (cartItem) {
      const newQuantity = cartItem.quantity + 1;

      if (newQuantity > maxQtyPerPerson) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: `You can only add up to ${maxQtyPerPerson} units of this product.`,
        });
      }

      if (newQuantity > product.quantity) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: Messages.PRODUCT_STOCK_INSUFFIENT,
        });
      }

      cartItem.quantity = newQuantity;
      cartItem.price = Math.floor(finalPrice); // Store discounted price
    } else {
      if (1 > product.quantity) {
        return res.status(HttpStatus.BAD_REQUEST).json({ message: Messages.PRODUCT_STOCK_INSUFFIENT });
      }

      cart.items.push({
        productId,
        quantity: 1,
        price: Math.floor(finalPrice), // Store discounted price
        status: 'placed',
        cancellationReason: 'none'
      });
    }

    // Update cart.totalPrice
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });
    await cart.save();

    return res.status(200).json({ success: true, message: Messages.PRODUCT_ADDED_TO_CART });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(HttpStatus.SERVER_ERROR).json({ message: Messages.SERVER_ERROR, error: error.message });
  }
};

const getCartPage = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      console.log("User not authenticated, redirecting to login.");
      return res.redirect("/login");
    }

    const userId = req.session.user._id;
   

    const user = await User.findById(userId);
    if (user && user.isBlocked) {
      return res.status(403).json({ message: Messages.BLOCKED_CART });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: { path: "category", select: "isListed categoryOffer" },
    });

    if (!cart) {
      return res.render("cart", { cart: { items: [] }, total: 0 });
    }

    // Recalculate prices to ensure consistency
    await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.productId).populate("category");
        if (!product) {
          item.price = 0; // Handle deleted products
          return;
        }

        const productOffer = product.productOffer || 0;
        const categoryOffer = product.category?.categoryOffer || 0;
        const bestOffer = Math.max(productOffer, categoryOffer);
        const finalPrice = bestOffer > 0
          ? product.regularPrice - (product.regularPrice * bestOffer) / 100
          : product.regularPrice;

        item.price = Math.floor(finalPrice);
      })
    );

    // Update cart.totalPrice
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    await cart.save();

    console.log("Total cart price:", cart.totalPrice);
    res.render("cart", { cart, total: cart.totalPrice });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(HttpStatus.SERVER_ERROR).send("Server Error");
  }
};

const increaseQuantity = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.CART_NOT_FOUND });
    }

    const item = cart.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.ITEM_NOT_FOUND_CART });
    }

    const product = await Product.findById(item.productId).populate("category");

    if (!product || product.quantity <= 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.PRODUCT_OUT_OF_STOCK });
    }

    const newQuantity = item.quantity + 1;

    if (newQuantity > 5) {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.MAX_QTY_EXCEEDED });
    }

    if (newQuantity > product.quantity) {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.PRODUCT_OUT_OF_STOCK });
    }

    const productOffer = product.productOffer || 0;
    const categoryOffer = product.category?.categoryOffer || 0;
    const bestOffer = Math.max(productOffer, categoryOffer);
    const finalPrice = bestOffer > 0
      ? product.regularPrice - (product.regularPrice * bestOffer) / 100
      : product.regularPrice;

    item.quantity = newQuantity;
    item.price = Math.floor(finalPrice);

    // Update cart.totalPrice
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Quantity incremented",
      newQuantity: item.quantity,
      itemTotal: item.quantity * item.price,
      newPrice: Math.floor(cart.totalPrice),
    });
  } catch (error) {
    console.error("Cart increment error:", error);
    res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: Messages.SERVER_ERROR });
  }
};

const decreaseQuantity = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.CART_NOT_FOUND });
    }

    const item = cart.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.ITEM_NOT_FOUND_CART });
    }

    if (item.quantity === 1) {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.MIN_QTY_REACHED });
    }

    const product = await Product.findById(item.productId).populate("category");

    const productOffer = product.productOffer || 0;
    const categoryOffer = product.category?.categoryOffer || 0;
    const bestOffer = Math.max(productOffer, categoryOffer);
    const finalPrice = bestOffer > 0
      ? product.regularPrice - (product.regularPrice * bestOffer) / 100
      : product.regularPrice;

    item.quantity -= 1;
    item.price = Math.floor(finalPrice);

    // Update cart.totalPrice
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Quantity decremented",
      newQuantity: item.quantity,
      itemTotal: item.quantity * item.price,
      newPrice: Math.floor(cart.totalPrice),
    });
  } catch (error) {
    console.error("Cart decrement error:", error);
    res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: Messages.SERVER_ERROR });
  }
};

const removeItem = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: Messages.USER_NOT_FOUND });
    }

    const itemId = req.params.itemId;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.CART_NOT_FOUND });
    }

    const item = cart.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.PRODUCT_NOT_FOUND });
    }

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId.toString());

    // Update cart.totalPrice
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    await cart.save();

    return res.json({ success: true, message: Messages.ITEM_REMOVED_CART });
  } catch (error) {
    console.error("Error removing item:", error);
    return res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: Messages.SERVER_ERROR });
  }
};

const validateCartForCheckout = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: Messages.USER_NOT_FOUND });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: { path: "category", select: "isListed" },
    });

    if (!cart || cart.items.length === 0) {
მოჁ

      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.CART_EMPTY });
    }

    const blockedItems = cart.items.filter((item) => item.productId.isBlocked);
    if (blockedItems.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: Messages.ITEMS_CART_NO_LONGER_AVAILABLE,
      });
    }

    const unlistedCategoryItems = cart.items.filter(
      (item) =>
        item.productId.category &&
        typeof item.productId.category.isListed !== "undefined" &&
        item.productId.category.isListed === false
    );
    if (unlistedCategoryItems.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: Messages.ITEMS_CATEGORY_NO_LONGER_AVAILABLE,
      });
    }

    const outOfStockItems = cart.items.filter((item) => item.productId.quantity <= 0);
    if (outOfStockItems.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: Messages.ITEMS_CART_NO_LONGER_AVAILABLE,
      });
    }

    const insufficientStockItems = cart.items.filter((item) => item.quantity > item.productId.quantity);
    if (insufficientStockItems.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: Messages.CART_QTY,
      });
    }

    return res.status(200).json({ success: true, message: Messages.CART_VALID });
  } catch (error) {
    console.error("Error validating cart for checkout:", error);
    return res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: Messages.SERVER_ERROR });
  }
};

// const cartItemQuantityCheck = async (req,res)=>{
//   try {
//     const {cartId} = req.body;

//    const cartData = await Cart.findById(cartId).populate('items.productId')    
   
//    if(!cartDAta){
//     return res.status(404).json({success:false,message:'Cart not found'});
//    }

//    const insuffientItems = [];

//    for(const item of cartData.items){
//     const product =item.productId;
//     const cartQty = item.quantity;

//     if(!product ||typeof product.quantity !== 'number'){
//       insuffientItems.push({
//         productId:product?._id,
//         productName:product?.productName || 'unknown',
//         message:'Invalid product or stock data'
//       });
//       continue;
//     }

//     if(cartQty >product.quantity){
//       insuffientItems.push({
//         productId:product?._id,
//         productName:product?.productName || 'unknown',
//         cartQuantity:cartQty,
//         availableStock:product.quantity,
//         message:'Invalid product or stock data'
//       });
//     }

//    }

//    if(insuffientItems.length > 0){
//     return res.status(400).json({
//       success:false,
//       message:'Some products in the cart exceed available stock',
//       data:insuffientItems
//     });
//    }

//    return res.status(200).json({
//     success:true,
//     message:'All cart items are within stock limits'
//    });

//   } catch (error) {
//     console.error('Error in cartItemQuantityCheck:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error'
//     });
//   }
// }


module.exports = {
  addToCart,
  getCartPage,
  removeItem,
  decreaseQuantity,
  increaseQuantity,
  validateCartForCheckout,
};