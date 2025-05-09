const Wishlist = require('../../models/wishlistSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');

// Get Wishlist Page
const getWishlistPage = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }

        const wishlist = await Wishlist.findOne({ userId })
            .populate('products.productId')
            .lean();

        // Filter out items where productId is not populated
        const validProducts = wishlist && wishlist.products
            ? wishlist.products.filter(item => item.productId !== null && item.productId !== undefined)
            : [];

        res.render('wishlist', {
            wishlist: validProducts,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error in getWishlistPage:', error);
        res.status(500).send('Server Error');
    }
};

// Add to Wishlist
const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { productId } = req.body;

        if (!userId) {
            return res.json({ success: false, message: 'Please login to add to wishlist' });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: [{ productId, addedOn: new Date() }]
            });
        } else {
            const productExists = wishlist.products.some(item => item.productId.toString() === productId);
            if (productExists) {
                return res.json({ success: false, message: 'Product already in wishlist' });
            }
            wishlist.products.push({ productId, addedOn: new Date() });
        }

        await wishlist.save();
        res.json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error('Error in addToWishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Remove from Wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { productId } = req.body;

        if (!userId) {
            return res.json({ success: false, message: 'Please login to remove from wishlist' });
        }

        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.json({ success: false, message: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId);
        await wishlist.save();

        res.json({ success: true, message: 'Product removed from wishlist' });
    } catch (error) {
        console.error('Error in removeFromWishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Add to Cart from Wishlist (and remove from wishlist)
const addToCartFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { productId } = req.body;

        if (!userId) {
            return res.json({ success: false, message: 'Please login to add to cart' });
        }

        // Fetch the product to get its price
        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ success: false, message: 'Product not found' });
        }

        // Add to Cart Logic
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({
                userId,
                items: [{
                    productId,
                    quantity: 1,
                    price: product.salePrice // Include the price from Product
                }],
                totalPrice: product.salePrice // Initialize totalPrice
            });
        } else {
            const itemExists = cart.items.some(item => item.productId.toString() === productId);
            if (!itemExists) {
                cart.items.push({
                    productId,
                    quantity: 1,
                    price: product.salePrice // Include the price from Product
                });
                cart.totalPrice = (cart.totalPrice || 0) + product.salePrice; // Update totalPrice
            }
        }
        await cart.save();

        // Remove from Wishlist
        const wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId);
            await wishlist.save();
        }

        res.json({ success: true, message: 'Product added to cart and removed from wishlist' });
    } catch (error) {
        console.error('Error in addToCartFromWishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getWishlistPage,
    addToWishlist,
    removeFromWishlist,
    addToCartFromWishlist
};