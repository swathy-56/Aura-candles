const bcrypt = require("bcrypt");
const User=require('../../models/userSchema');
const Category=require('../../models/categorySchema');
const Brand=require('../../models/brandSchema');
const Product=require('../../models/productSchema');
const env=require('dotenv').config();
const nodemailer=require('nodemailer');


const pageNotFound=(req,res)=>{
    try{
        res.render('page-404');
    }catch(error){
        res.redirect('/pageNotFound')
    }
}



const loadHomepage=async(req,res)=>{
    try{
        const user=req.session.user;
        const categories=await Category.find({isListed:true});
        let productData=await Product.find(
          {isBlocked:false,
            category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
          }
        )

        productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        productData=productData.slice(0,4);

        //console.log("Fetched products:", productData);
        if(user){

          const userData= await User.findOne({_id:user._id});
          return res.render('home',{user:userData,products:productData});
        }else{
          return res.render('home',{products:productData});
        }
    }catch(error){
      
     console.log('Home Page not found',error);
     res.status(500).send('Server error');

    }
}


const loadSignup=async(req,res)=>{
    try{
        return res.render('signup');
    }catch(error){
        console.log('Home page not loading:',error);
        res.status(500).send('server error');
    }

}



function generateOtp(){
    return Math.floor(100000+Math.random()*900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.NODEMAILER_EMAIL,
          pass: process.env.NODEMAILER_PASSWORD,
        },
      });
  
      const info = await transporter.sendMail({
        from: process.env.NODEMAILER_EMAIL,
        to: email,
        subject: 'Verify your account',
        text: `Your OTP is ${otp}`,
        html: `<b>Your OTP: ${otp}</b>`,
      });
  
      return info.accepted.length > 0;
    } catch (error) {
      console.error('Error Sending email:', error);
      return false;
    }
  }




  const signup = async (req, res) => {
    try {
      const { name, phone, email, password, cPassword, referralCode } = req.body;
  
      // Check if passwords match
      if (password !== cPassword) {
        return res.render('signup', { message: 'Passwords do not match' });
      }
  
      // Check if the user already exists
      const findUser = await User.findOne({ email });
      if (findUser) {
        return res.render('signup', { message: 'User with this email already exists' });
      }
  
      // Validate referral code (if provided)
      let referrer = null;
      if (referralCode) {
        referrer = await User.findOne({ referralCode });
        if (!referrer) {
          return res.render('signup', { message: 'Invalid referral code' });
        }
      }
  
      // Generate OTP
      const otp = generateOtp();
  
      // Store user data and OTP in the session
      req.session.userData = { name, phone, email, password, referralCode };
      req.session.userOtp = otp;
  
      // Send OTP via email
      const emailSent = await sendVerificationEmail(email, otp);
      if (!emailSent) {
        return res.render('signup', { message: 'Failed to send OTP. Please try again.' });
      }
  
      console.log('Generated OTP:', otp); // Log OTP for debugging
  
      // Redirect to OTP verification page
      res.render('verify-otp');
    } catch (error) {
      console.error('Signup error:', error);
      res.redirect('/pageNotFound');
    }
  };



  const securePassword=async(password)=>{
    try{
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash;
    }catch(error){

    }
  }



  const verifyOtp = async (req, res) => {
    try {
      const { otp } = req.body;
  
      if (otp === req.session.userOtp) {
        const user = req.session.userData;
  
        // Hash the password
        const passwordHash = await securePassword(user.password);
  
        // Create the new user
        const newUser = new User({
          name: user.name,
          email: user.email,
          phone: user.phone,
          password: passwordHash,
          referralCode: `${user.name.toLowerCase().replace(/\s+/g, '')}${Math.floor(
            1000 + Math.random() * 9000
          )}`,
        });
  
        // Handle referral bonuses
        if (user.referralCode) {
          const referrer = await User.findOne({ referralCode: user.referralCode });
          if (referrer) {
            referrer.wallet += 100; // Add ₹100 to the referrer's wallet
            referrer.redeemedUsers.push(newUser._id);
            referrer.walletTransactions.push({
              type: 'credit',
              amount: 100,
              description: `Referral bonus for referring ${newUser.name}`,
            });
            await referrer.save();
  
            newUser.wallet += 50; // Add ₹50 to the new user's wallet
            newUser.redeemed = true;
            newUser.walletTransactions.push({
              type: 'credit',
              amount: 50,
              description: 'Referral bonus for using a referral code',
            });
          }
        }
  
        await newUser.save();
  
        // Set the user in the session
        req.session.user = {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
        };
  
        res.json({ success: true, redirectUrl: '/' });
      } else {
        res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
  };


  const resendOtp = async (req, res) => {
    try {
      const { email } = req.session.userData || {}; // Safely access userData
  
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email not found in session' });
      }
  
      // Generate a new OTP
      const otp = generateOtp();
      req.session.userOtp = otp;
  
      // Send OTP via email
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        console.log('Resend OTP:', otp); // Log OTP for debugging
        res.status(200).json({ success: true, message: 'OTP Resent Successfully' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again.' });
      }
    } catch (error) {
      console.error('Error resending OTP:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error. Please try again.' });
    }
  };

  const loadLogin=async(req,res)=>{
    try {
      
      if(!req.session.user){
        return res.render('login');
      }else{
        res.redirect('/');
      }

    } catch (error) {
      
     res.redirect('/pageNotFound');

    }
  };

  const checkUserBlocked = async (req,res,next)=>{
    if(req.session && req.session.user){
      const user=await User.findById(req.session.user._id);

      if(!user||user.isBlocked){
        req.session.destroy((err)=>{
          if(err)console.error("Session destroy error:", err);
          return res.redirect('/login?blocked=true');
        });
      }else{
        next();
      }
    }else{
      next();
    }
  }


  const login=async(req,res)=>{
    try{
      const {email,password}=req.body;

      const findUser=await User.findOne({isAdmin:0,email:email});

      if(!findUser){
        return res.render('login',{message:'User not found'});
      }
      if(findUser.isBlocked){
        return res.render('login',{message:'User is blocked by admin'});
      }
      const passwordMatch=await bcrypt.compare(password,findUser.password);

      if(!passwordMatch){
        return res.render('login',{message:'Incorrect Password'});
      }

      req.session.user={
        _id: findUser._id,
            name: findUser.name,
            email: findUser.email,
      };
      req.session.save();
      res.redirect('/');
    }catch(error){
      console.error('login error',error);
      res.render('login',{message:'login failed.Please try again later'});
    }
  };


  const logout=async(req,res)=>{
    try {
      req.session.destroy((err)=>{
        if(err){
          console.log('Session destruction error',err.message);
          return res.redirect('/pageNotFound');
        }
        return res.redirect('/login');
      })
    } catch (error) {
      
      console.log('Logout error',error);
      res.redirect('/pageNotFound');
    }
  };

  

const uploadProduct = async (req, res) => {
  try {
    if (!req.file) {
      console.log("no file uploaded");
      return res.status(400).json({ message: " Please upload an image" });
    }

    console.log("uploaded file:", req.file);

    const newProduct = new Product({
      name: req.body.name,
      image: "/uploads" + req.file.filename,
      description: req.body.description,
      price: req.body.price,
    });

    await newProduct.save();
    res.redirect("/");
  } catch (error) {
    console.log("Error uploading product:", error);
    res.status(500).send("server error");
  }
};


module.exports={
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp, 
    resendOtp,
    loadLogin,
    checkUserBlocked,
    login,
    logout,
    uploadProduct,
   
    
}

