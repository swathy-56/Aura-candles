const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const profileController = require('../controllers/user/profileController');
const productController = require("../controllers/user/productController");
const orderController = require('../controllers/user/orderController');
const cartController = require('../controllers/user/cartController');
const wishlistController = require('../controllers/user/wishlistController');
const { userAuth } = require('../middlewares/auth');
const passport = require('passport');
const multer = require('multer');
const storage = require('../helpers/multer');
const uploads = multer({ storage: storage });

// Error Management
router.get('/PageNotFound', userController.pageNotFound);

// Sign up Management
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup); 
router.post('/verify-otp', userController.verifyOtp); 
router.post('/resend-otp', userController.resendOtp); 

// Google Authentication
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
console.log("/auth/google route HIT");
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    console.log(" Google login successful for user:", req.user);
    req.session.user = req.user
    res.redirect('/');
});

// Login Management
router.get('/login', userController.loadLogin);
router.post('/login', userController.login); 
router.get('/logout', userController.logout); 

// Homepage & Shopping Page
router.get('/',userController.checkUserBlocked, userController.loadHomepage);
router.get('/shop',userController.checkUserBlocked, productController.loadshop);
router.get('/productDetails',userController.checkUserBlocked, productController.productDetails);

// Profile Management
router.get('/userProfile', userAuth, profileController.userProfile);
router.get('/account',userController.checkUserBlocked, userAuth, profileController.getUserProfile);
router.patch('/updateProfile',userController.checkUserBlocked, userAuth, uploads.single("profileImage"), profileController.updateProfile); 
router.post('/changeEmail', profileController.sendEmailOtp); 
router.post('/verifyEmailOtp', profileController.verifyEmailOtp);
router.post('/resendEmailOtp', profileController.resendEmailOtp); 
router.patch('/change-password', profileController.changePassword); 

// **Address Management**
router.get('/address-management', userAuth, profileController.getAddresses);
router.post('/add-address', userAuth, profileController.addAddress); 
router.patch('/edit-address/:id', userAuth, profileController.updateAddress); 
router.delete('/delete-address/:id', userAuth, profileController.deleteAddress); 
router.post('/set-default-address/:id', userAuth, profileController.setDefaultAddress); 

// Forgot Password & Reset Password
router.get('/forgot-password', profileController.getForgotPassPage);
router.post('/forgot-email-valid', profileController.forgotEmailValid); 
router.post('/verify-passForgot-otp', profileController.verifyForgotPassOtp); 
router.get('/reset-password', profileController.getResetPassPage);
router.post('/resend-forgot-otp', profileController.resendOtp); 
router.patch('/reset-password', profileController.postNewPassword); 

// Cart Management
router.get('/cart',userController.checkUserBlocked, cartController.getCartPage);
router.post('/addToCart', cartController.addToCart); 
router.delete('/cart/remove/:itemId', cartController.removeItem); 
router.patch('/cart/increment/:itemId', cartController.increaseQuantity); 
router.patch('/cart/decrement/:itemId', cartController.decreaseQuantity); 
router.get('/cart/validate', cartController.validateCartForCheckout);

// Checkout Page
router.get('/checkout',userController.checkUserBlocked, userAuth, orderController.getCheckoutPage);

router.post('/add-address', profileController.addAddress); 

// Coupon Management
router.post('/apply-coupon', userAuth, orderController.applyCoupon); 
router.post('/remove-coupon', userAuth, orderController.removeCoupon); 

// Order Management
router.post('/create-razorpay-order', orderController.createRazorpayOrder);
router.post('/create-order', orderController.createOrder);
router.get('/order-placed', orderController.getOrderPlacedPage);
router.get('/order-failure', orderController.getOrderFailurePage);
router.get('/orders', userController.checkUserBlocked, orderController.viewOrder);
router.get('/viewOrder', orderController.orderDetail);
router.post('/cancelOrder', orderController.cancelOrder);
router.post('/returnOrder', orderController.returnOrder);
router.get('/download-invoice/:orderId', orderController.downloadInvoice);
router.get('/retryPayment', orderController.retryPaymentGet);


// Wallet Management
router.get('/wallet', userAuth, orderController.viewWallet);

// Wishlist Management
router.get('/wishlist',userController.checkUserBlocked, userAuth, wishlistController.getWishlistPage);
router.post('/addToWishlist', userAuth, wishlistController.addToWishlist); // POST: Adds item to wishlist
router.delete('/removeFromWishlist', userAuth, wishlistController.removeFromWishlist); // DELETE: Removes item
router.post('/addToCartFromWishlist', userAuth, wishlistController.addToCartFromWishlist); // POST: Moves item to cart

module.exports = router;