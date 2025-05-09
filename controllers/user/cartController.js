const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const session = require("express-session");
const mongoose = require("mongoose");

// const addToCart = async (req, res) => {
//     try {
//         if (!req.session || !req.session.user) {
//             return res.status(401).json({ message: "Unauthorized: Please log in first." });
//         }

//         const userId = req.session.user._id;
//         const { productId } = req.body;

//         if (!mongoose.Types.ObjectId.isValid(productId)) {
//             return res.status(400).json({ message: "Invalid product ID." });
//         }

//         const product = await Product.findById(productId)
//             .populate("category", "isListed")
//             .select("salePrice category isBlocked quantity");

//         if (!product) {
//             return res.status(404).json({ message: "Product not found." });
//         }

//         if (product.isBlocked || (product.category && !product.category.isListed)) {
//             return res.status(400).json({ message: "This product cannot be added to the cart." });
//         }

//         if (product.quantity <= 0) {
//             return res.status(400).json({ message: "Product is out of stock." });
//         }

//         if (product.salePrice === undefined || product.salePrice === null) {
//             return res.status(400).json({ message: "Product price is missing. Cannot add to cart." });
//         }

//         let cart = await Cart.findOne({ userId });
//         if (!cart) {
//             cart = new Cart({ userId, items: [] });
//         }

//         const productObjectId = new mongoose.Types.ObjectId(productId);
//         const cartItem = cart.items.find((item) => item.productId.equals(productObjectId));

//         const maxQtyPerPerson = 5;

//         if (cartItem) {
//             const newQuantity = cartItem.quantity + 1;
//             if (newQuantity > maxQtyPerPerson) {
//                 return res.status(400).json({ message: `You can only add up to ${maxQtyPerPerson} units of this product.` });
//             }
//             if (newQuantity > product.quantity) {
//                 return res.status(400).json({ message: "Cannot add more items; product stock is insufficient." });
//             }
//             cartItem.quantity = newQuantity;
//             cartItem.totalPrice = cartItem.quantity * product.salePrice;
//         } else {
//             if (1 > product.quantity) {
//                 return res.status(400).json({ message: "Cannot add item; product stock is insufficient." });
//             }
//             cart.items.push({
//                 productId,
//                 quantity: 1,
//                 price: product.salePrice,
//                 totalPrice: product.salePrice,
//             });
//         }

//         // // Decrement product stock
//         // const updateResult = await Product.updateOne(
//         //     { _id: productId, quantity: { $gte: 1 } },
//         //     { $inc: { quantity: -1 } }
//         // );

//         if (updateResult.modifiedCount === 0) {
//             return res.status(400).json({ success: false, message: "Failed to update stock. Product may be out of stock." });
//         }

//         await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });
//         await cart.save();

//         return res.status(200).json({ success: true, message: "Product added to cart!" });
//     } catch (error) {
//         console.error("Error adding to cart:", error);
//         return res.status(500).json({ message: "Server error", error: error.message });
//     }
// };

const addToCart = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Please log in first." });
    }

    const userId = req.session.user._id;
    const { productId } = req.body;

    const user = await User.findById(userId);
    if (user && user.isBlocked) {
      return res
        .status(403)
        .json({
          message: "Your account is Blocked.You cannot add items to the cart.",
        });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    const product = await Product.findById(productId)
      .populate("category", "isListed categoryOffer")
      .select("salePrice category isBlocked quantity");

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (product.isBlocked || (product.category && !product.category.isListed)) {
      return res
        .status(400)
        .json({ message: "This product cannot be added to the cart." });
    }

    if (product.quantity <= 0) {
      return res.status(400).json({ message: "Product is out of stock." });
    }

    if (product.salePrice === undefined || product.salePrice === null) {
      return res
        .status(400)
        .json({ message: "Product price is missing. Cannot add to cart." });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const productObjectId = new mongoose.Types.ObjectId(productId);
    const cartItem = cart.items.find((item) =>
      item.productId.equals(productObjectId)
    );

    const maxQtyPerPerson = 5;

    if (cartItem) {
      const newQuantity = cartItem.quantity + 1;

      if (newQuantity > maxQtyPerPerson) {
        return res
          .status(400)
          .json({
            message: `You can only add up to ${maxQtyPerPerson} units of this product.`,
          });
      }

      if (newQuantity > product.quantity) {
        return res
          .status(400)
          .json({
            message: "Cannot add more items; product stock is insufficient.",
          });
      }

      cartItem.quantity = newQuantity;
      cartItem.totalPrice = cartItem.quantity * product.salePrice;
    } else {
      if (1 > product.quantity) {
        return res
          .status(400)
          .json({ message: "Cannot add item; product stock is insufficient." });
      }

      cart.items.push({
        productId,
        quantity: 1,
        price: product.salePrice,
        totalPrice: product.salePrice,
      });
    }

    // ✅ REMOVE stock decrement
    // await Product.updateOne(
    //     { _id: productId, quantity: { $gte: 1 } },
    //     { $inc: { quantity: -1 } }
    // );

    // Remove item from wishlist if exists
    await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });

    await cart.save();

    return res
      .status(200)
      .json({ success: true, message: "Product added to cart!" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getCartPage = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      console.log("User not authenticated, redirecting to login.");
      return res.redirect("/login");
    }

    const userId = req.session.user._id;
    console.log("Fetching cart for user:", userId);

    const user = await User.findById(userId);
    if (user && user.isBlocked) {
      return res
        .status(403)
        .json({
          message: "Your account is blocked. You cannot access the cart.",
        });
    }

    const cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: { path: "category", select: "isListed" },
              });


    if (!cart) {
      return res.render("cart", { cart: { items: [] }, total: 0 });
    }

    const totalPrice = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.productId).populate(
          "category"
        );
        const productOffer = product.productOffer || 0;
        const categoryOffer = product.category.categoryOffer || 0;

        const bestOffer = Math.max(productOffer, categoryOffer);
        const finalPrice =
          bestOffer > 0
            ? product.regularPrice - (product.regularPrice * bestOffer) / 100
            : product.salePrice;

        item.price = Math.floor(finalPrice);
        item.totalPrice = Math.floor(item.quantity * finalPrice);
        await item.save();

        return product.quantity > 0
          ? Math.floor(item.quantity * finalPrice)
          : 0;
      })
    ).then((prices) => prices.reduce((sum, price) => sum + price, 0));

    await cart.save();
    console.log("anothercart",cart)

    console.log("Total cart price (excluding out-of-stock):", totalPrice);
    res.render("cart", { cart, total: totalPrice });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).send("Server Error");
  }
};

// const getCartPage = async (req, res) => {
//     try {
//       const userId = req.session.user?._id;
//       if (!userId) {
//         return res.redirect("/login");
//       }
  
//       const userData = req.session.user;
//       const cart = await Cart.findOne({ userId }).populate({
//         path: "items.productId",
//         populate: { path: "category", select: "isListed" },
//       });
  
//       if (!cart) {
//         return res.render("cart", { cart: null, userData, message: "Your cart is empty." });
//       }
  
//       res.render("cart", { cart, userData, message: null });
//     } catch (error) {
//       console.error("Error fetching cart page:", error);
//       res.status(500).send("Server error");
//     }
//   };

const increaseQuantity = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });
    }

    const product = await Product.findById(item.productId).populate("category");

    if (!product || product.quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Product is out of stock" });
    }

    const currentQuantity = item.quantity;
    const newQuantity = currentQuantity + 1;

    if (newQuantity > 5) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Maximum quantity for one product exceeded",
        });
    }

    if (newQuantity > product.quantity) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Not enough stock to add more of this item",
        });
    }

    const productOffer = product.productOffer || 0;
    const categoryOffer = product.category?.categoryOffer || 0;
    const bestOffer = Math.max(productOffer, categoryOffer);
    const finalPrice =
      bestOffer > 0
        ? product.regularPrice - (product.regularPrice * bestOffer) / 100
        : product.salePrice;

    // ✅ Just update cart item
    item.quantity = newQuantity;
    item.totalPrice = Math.floor(item.quantity * finalPrice);

    // No Product.updateOne anymore

    const grandTotal = cart.items.reduce((sum, cartItem) => {
      const itemProduct = cartItem.productId;
      if (itemProduct.quantity <= 0) return sum;
      const itemOffer = itemProduct.productOffer || 0;
      const itemCategoryOffer = itemProduct.category?.categoryOffer || 0;
      const itemBestOffer = Math.max(itemOffer, itemCategoryOffer);
      const itemFinalPrice =
        itemBestOffer > 0
          ? itemProduct.regularPrice -
            (itemProduct.regularPrice * itemBestOffer) / 100
          : itemProduct.salePrice;
      return sum + cartItem.quantity * itemFinalPrice;
    }, 0);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Quantity incremented",
      newQuantity: item.quantity,
      itemTotal: item.totalPrice,
      newPrice: Math.floor(grandTotal),
    });
  } catch (error) {
    console.error("Cart increment error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while updating the quantity",
      });
  }
};

const decreaseQuantity = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId: userId }).populate(
      "items.productId"
    );

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });
    }

    const currentQuantity = item.quantity;
    if (currentQuantity === 1) {
      return res
        .status(400)
        .json({ success: false, message: "Minimum quantity reached" });
    }

    const product = await Product.findById(item.productId).populate("category");

    // Calculate final price with discounts
    const productOffer = product.productOffer || 0;
    const categoryOffer = product.category.categoryOffer || 0;
    const bestOffer = Math.max(productOffer, categoryOffer);
    const finalPrice =
      bestOffer > 0
        ? product.regularPrice - (product.regularPrice * bestOffer) / 100
        : product.salePrice;

    // Decrement quantity and update item total price
    item.quantity -= 1;
    item.totalPrice = Math.floor(item.quantity * finalPrice);

   

    // Calculate grand total for the entire cart, excluding out-of-stock items
    const grandTotal = cart.items.reduce((sum, cartItem) => {
      const itemProduct = cartItem.productId;
      if (itemProduct.quantity <= 0) return sum;
      const itemOffer = itemProduct.productOffer || 0;
      const itemCategoryOffer = itemProduct.category.categoryOffer || 0;
      const itemBestOffer = Math.max(itemOffer, itemCategoryOffer);
      const itemFinalPrice =
        itemBestOffer > 0
          ? itemProduct.regularPrice -
            (itemProduct.regularPrice * itemBestOffer) / 100
          : itemProduct.salePrice;
      return sum + cartItem.quantity * itemFinalPrice;
    }, 0);

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Quantity decremented",
      newQuantity: item.quantity,
      itemTotal: item.totalPrice,
      newPrice: Math.floor(grandTotal),
    });
  } catch (error) {
    console.error("Cart decrement error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while updating the quantity",
      });
  }
};

const removeItem = async (req, res) => {
  try {
    console.log("Received request to remove item:", req.params.itemId);

    if (!req.session.user) {
      return res
        .status(401)
        .json({ success: false, message: "User not logged in" });
    }

    const itemId = req.params.itemId;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const quantityToRestore = item.quantity;
    const cartLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => item._id.toString() !== itemId.toString()
    );

    if (cart.items.length < cartLength) {
      
      await cart.save();
      return res.json({ success: true, message: "Item removed successfully" });
    }

    return res.status(404).json({ success: false, message: "Item not found" });
  } catch (error) {
    console.error("Error removing item:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const validateCartForCheckout = async (req, res) => {
    try {
      if (!req.session.user) {
        return res
          .status(401)
          .json({ success: false, message: "User not logged in" });
      }
  
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ userId }).populate({
        path: "items.productId",
        populate: { path: "category", select: "isListed" },
      });
  
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
      }
      console.log("carttssssss",cart.items[0].productId)
  
      const blockedItems = cart.items.filter((item) => item.productId.isBlocked);
      if (blockedItems.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Some items in your cart are no longer available. Please remove them to proceed.",
        });
      }
      console.log("bloked",blockedItems)
  
      const unlistedCategoryItems = cart.items.filter(
        (item) =>
          item.productId.category &&
          typeof item.productId.category.isListed !== "undefined" &&
          item.productId.category.isListed === false
      );
      if (unlistedCategoryItems.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Some items in your cart belong to unavailable categories. Please remove them to proceed.",
        });
      }
  
      const outOfStockItems = cart.items.filter(
        (item) => item.productId.quantity <= 0
      );
      if (outOfStockItems.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Some items in your cart are out of stock. Please remove them to proceed.",
        });
      }
  
      const insufficientStockItems = cart.items.filter(
        (item) => item.quantity > item.productId.quantity
      );
      if (insufficientStockItems.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Some items in your cart exceed available stock. Please adjust quantities.",
        });
      }
  
      return res
        .status(200)
        .json({ success: true, message: "Cart is valid for checkout" });
    } catch (error) {
        console.log("haooooo")
      console.error("Error validating cart for checkout:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };

module.exports = {
  addToCart,
  getCartPage,
  removeItem,
  decreaseQuantity,
  increaseQuantity,
  validateCartForCheckout,
};
