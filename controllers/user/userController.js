const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const { HttpStatus, Messages } = require("../../shared/constants");

const pageNotFound = (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });
    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      quantity: { $gt: 0 },
    });

    productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    productData = productData.slice(0, 4);

    //console.log("Fetched products:", productData);
    if (user) {
      const userData = await User.findOne({ _id: user._id });
      return res.render("home", { user: userData, products: productData });
    } else {
      return res.render("home", { products: productData });
    }
  } catch (error) {
    console.log("Home Page not found", error);
    res.status(HttpStatus.SERVER_ERROR).send("Server error");
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(HttpStatus.SERVER_ERROR).send("server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
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
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error Sending email:", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword, referralCode } = req.body;

    // Check if passwords match
    if (password !== cPassword) {
      return res.render("signup", { message: Messages.WRONG_PASSWORD });
    }

    // Check if the user already exists
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: Messages.EMAIL_EXISTS });
    }

    // Validate phone number (assuming phone validation function exists)
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.render("signup", { message: Messages.INVALID_PHONE });
    }

    // Validate referral code (if provided)
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
      if (!referrer) {
        return res.render("signup", { message: Messages.INVALID_REF_CODE });
      }
    }

    // Generate OTP
    const otp = generateOtp();

    // Store user data and OTP in the session
    req.session.userData = { name, phone, email, password, referralCode };
    req.session.userOtp = otp;
    req.session.otpCreatedAt = Date.now();

    console.log('Signup Session Data:', {
      userData: req.session.userData,
      userOtp: req.session.userOtp,
      otpCreatedAt: req.session.otpCreatedAt,
    });

    // Send OTP via email
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("signup", { message: Messages.FAILED_TO_SEND_OTP });
    }

    console.log("Generated OTP:", otp); // Log OTP for debugging

    // Redirect to OTP verification page
    res.render("verify-otp");
  } catch (error) {
    console.error("Signup error:", error);
    res.redirect("/pageNotFound");
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {}
};


const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    const otpExpiryTime = 1 * 60 * 1000; // 1 minute
    const currentTime = Date.now();

    // Log session data
    console.log('Verify OTP Session Data:', {
      otpCreatedAt: req.session.otpCreatedAt,
      userOtp: req.session.userOtp,
      submittedOtp: otp,
      currentTime,
      timeDifference: req.session.otpCreatedAt ? currentTime - req.session.otpCreatedAt : 'otpCreatedAt missing',
      isExpired: req.session.otpCreatedAt ? currentTime - req.session.otpCreatedAt > otpExpiryTime : 'cannot check',
    });

    // Check session data
    if (!req.session.otpCreatedAt || !req.session.userOtp) {
      console.log('Sending response: Session data missing');
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Session data missing. Please try again.',
      });
    }

    // Check OTP presence
    if (!otp) {
      console.log('Sending response: OTP missing');
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'OTP is required.',
      });
    }

    // Check OTP expiry
    if (currentTime - req.session.otpCreatedAt > otpExpiryTime) {
      console.log('Sending response: OTP expired');
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'OTP expired. Please request a new one.',
      });
    }

    // Check OTP validity
    if (otp !== req.session.userOtp) {
      console.log('Sending response: Invalid OTP');
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: Messages.INVALID_OTP,
      });
    }

    // Validate user data
    const user = req.session.userData;
    if (!user) {
      console.log('Sending response: User data missing');
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'User data not found in session.',
      });
    }

    // Hash password
    const passwordHash = await securePassword(user.password);
    if (!passwordHash) {
      console.log('Sending response: Password hashing failed');
      return res.status(HttpStatus.SERVER_ERROR).json({
        success: false,
        message: 'Failed to hash password.',
      });
    }

    // Create new user
    const newUser = new User({
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: passwordHash,
      referralCode: `${user.name
        .toLowerCase()
        .replace(/\s+/g, "")}${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // Handle referral bonuses
    if (user.referralCode) {
      const referrer = await User.findOne({ referralCode: user.referralCode });
      if (referrer) {
        referrer.wallet += 100;
        referrer.redeemedUsers.push(newUser._id);
        referrer.walletTransactions.push({
          type: 'credit',
          amount: 100,
          description: `Referral bonus for referring ${newUser.name}`,
        });
        await referrer.save();

        newUser.wallet += 50;
        newUser.redeemed = true;
        newUser.walletTransactions.push({
          type: 'credit',
          amount: 50,
          description: 'Referral bonus for using a referral code',
        });
      }
    }

    await newUser.save();

    // Set user in session
    req.session.user = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
    };

    console.log('Sending response: OTP verified successfully');
    return res.json({ success: true, redirectUrl: '/' });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    console.log('Sending response: Server error');
    return res.status(HttpStatus.SERVER_ERROR).json({
      success: false,
      message: Messages.SERVER_ERROR,
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData || {};
    if (!email) {
      console.log('Email not found in session');
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: Messages.EMAIL_NOT_FOUND });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpCreatedAt = Date.now();

    console.log('Resend OTP Session Data:', {
      userOtp: req.session.userOtp,
      otpCreatedAt: req.session.otpCreatedAt,
      email,
    });

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log('Resend OTP:', otp);
      return res
        .status(200)
        .json({ success: true, message: Messages.OTP_RESEND_SUCCESS });
    } else {
      console.log('Failed to send OTP');
      return res
        .status(HttpStatus.SERVER_ERROR)
        .json({ success: false, message: Messages.FAILED_TO_RESEND });
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    return res
      .status(HttpStatus.SERVER_ERROR)
      .json({ success: false, message: Messages.SERVER_ERROR });
  }
};


const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const checkUserBlocked = async (req, res, next) => {
  if (req.session && req.session.user) {
    const user = await User.findById(req.session.user._id);

    if (!user || user.isBlocked) {
      req.session.user = null;
      return res.redirect("/login?blocked=true");
    } else {
      next();
    }
  } else {
    next();
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render("login", { message: Messages.USER_NOT_FOUND });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: Messages.USER_BLOCKED });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: Messages.INCORRECT_PASSWORD });
    }

    req.session.user = {
      _id: findUser._id,
      name: findUser.name,
      email: findUser.email,
    };
    req.session.save();
    res.redirect("/");
  } catch (error) {
    console.error("login error", error);
    res.render("login", { message: Messages.LOGIN_FAILED });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login");
    });
  } catch (error) {
    console.log("Logout error", error);
    res.redirect("/pageNotFound");
  }
};

const uploadProduct = async (req, res) => {
  try {
    if (!req.file) {
      console.log("no file uploaded");
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: Messages.UPLOAD_IMAGE });
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
    res.status(HttpStatus.SERVER_ERROR).send("server error");
  }
};

module.exports = {
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
};
