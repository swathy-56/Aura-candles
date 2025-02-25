const express=require('express');
const router=express.Router();
const userController=require('../controllers/user/userController');
const passport = require('passport');

router.get('/PageNotFound',userController.pageNotFound);

router.get('/signup',userController.loadSignup);
router.get('/signup',userController.signup);
router.post('/signup',userController.signup)
router.get('/shop',userController.loadShopping);
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/siiignup'}),(req,res)=>{
    res.redirect('/');
});

router.get('/login',userController.loadLogin);
router.post('/login',userController.login);

router.get('/',userController.loadHomepage);
router.get('/logout',userController.logout);




module.exports=router;