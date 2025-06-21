const User=require('../../models/userSchema');
const Order=require('../../models/orderSchema');
const Address=require('../../models/addressSchema');
const sendVerificationEmail = require('../../helpers/emailHelper');
const generateOtp = require('../../helpers/otpHelper');
const securePassword = require('../../helpers/passwordHelper');
const session=require('express-session');
const bcrypt=require('bcrypt');
const mongoose=require('mongoose');
const { HttpStatus, Messages } = require("../../shared/constants");




//Render forgot password page
const getForgotPassPage=async(req,res)=>{
    try {
        res.render('forgot-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

//validate email and send otp
const forgotEmailValid=async(req,res)=>{
    try {
        const {email}=req.body;


        const findUser=await User.findOne({email:email});
        if(findUser){
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.email=email;
                res.render('forgotPass-otp');
                console.log('OTP:',otp);
            }else{
                res.json({success:false,message:Messages.FAILED_TO_SEND_OTP});
            }
        }else{
            res.render('forgot-password',{
                message:'User with this email does not exist'
            });
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}



const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const otpRegex = /^[0-9]{6}$/;

        console.log("Session Data:", req.session);
        console.log("Stored OTP:", req.session.userOtp, "Type:", typeof req.session.userOtp);
        console.log("Entered OTP:", enteredOtp, "Type:", typeof enteredOtp);

        if (!otpRegex.test(enteredOtp)) {
            return res.json({ success: false, message: Messages.INVALID_OTP_FORMAT });
        }

        if (enteredOtp.toString() === req.session.userOtp.toString()) {
            res.json({ success: true, redirectUrl: '/reset-password' });
        } else {
            res.json({ success: false, message: Messages.OTP_NOT_MATCHING });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: Messages.SERVER_ERROR });
    }
};

//Render reset password page
const getResetPassPage=async(req,res)=>{
    try {
        res.render('reset-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

//resend otp
const resendOtp=async(req,res)=>{
    try {
        
        const otp=generateOtp();
        req.session.userOtp=otp;
        const email=req.session.email;
        console.log('Resending OTP to email:',email);
        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log('Resend OTP:',otp);
            res.status(200).json({success:true,message:Messages.OTP_RESEND_SUCCESS});
        }
    } catch (error) {
        console.error('Error in resend otp',error);
        res.status(HttpStatus.SERVER_ERROR).json({success:false,message:Messages.SERVER_ERROR})
    }
}



const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;

        if (!email) {
            return res.render('reset-password', { message: 'Session expired. Please restart the process.' });
        }
        if (newPass1 !== newPass2) {
            return res.render('reset-password', { message: 'Passwords do not match' });
        }

        const passwordHash = await securePassword(newPass1);
        await User.updateOne({ email }, { $set: { password: passwordHash } });

        res.redirect('/login');
    } catch (error) {
        console.error("Error updating password:", error);
        res.redirect('/pageNotFound');
    }
};


const userProfile=async(req,res)=>{
    try {
        
        const userId=req.session.user;
        const userData=await User.findById(userId);
        res.render('userProfile',{
            user:userData,
        })
    } catch (error) {
        console.error('Error for retrieve profile data',error);
        res.redirect('/pageNotFound');
    }
};

const getUserProfile = async (req, res) => {
    try {
        const userId = req.session.user;  // Get user ID from session
        const userData = await User.findById(userId); // Fetch user details

        // Fix: Pass success and error messages from the query parameters
        const successMessage = req.query.success || null;
        const errorMessage = req.query.error || null;

        console.log('user =>',userData)
        res.render('account', {
            user: userData, 
            success: successMessage,
            error: errorMessage
        });
    } catch (error) {
        console.error('Error retrieving profile data:', error);
        res.redirect('/pageNotFound');
    }
};



const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: Messages.USER_NOT_FOUND });
        }

        const { name, phone } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.USER_NOT_FOUND });
        }

        // Name validation
        const nameRegex = /^[A-Za-z\s'-]{3,50}$/; // Allow letters, spaces, hyphens, apostrophes, 3-50 chars
        const containsNonSpace = /[A-Za-z'-]/; // Ensure at least one letter, hyphen, or apostrophe

        if (!name || name.trim().length === 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Name is required and cannot consist of only spaces.' });
        }
        if (!nameRegex.test(name.trim())) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Name must be 3-50 characters long and contain only letters, spaces, hyphens, or apostrophes.' });
        }
        if (!containsNonSpace.test(name.trim())) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Name must contain at least one letter, hyphen, or apostrophe.' });
        }

        // Phone validation
        const phoneRegex = /^\d{10}$/;
        if (phone && !phoneRegex.test(phone)) { 
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
        }

         // File validation
        if (req.file) {
            const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const fileExtension = req.file.originalname.toLowerCase().split('.').pop();

            if (!validImageTypes.includes(req.file.mimetype) || !validExtensions.includes(`.${fileExtension}`)) {
                // Optionally delete the uploaded file to avoid storing invalid files
                const fs = require('fs').promises;
                await fs.unlink(req.file.path).catch(err => console.error('Error deleting invalid file:', err));
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.INVALID_IMAGE });
            }

            user.profileImage = `/uploads/re-image/${req.file.filename}`;
            console.log("Updated profile image path:", user.profileImage);
        }


        // Update user fields
        user.name = name.trim(); 
        if (phone) user.phone = phone; 

        if (req.file) {
            user.profileImage = `/uploads/re-image/${req.file.filename}`;
            console.log("Updated profile image path:", user.profileImage);
        }

        await user.save();

        req.session.user = userId;
        res.json({ 
            success: true, 
            name: user.name, 
            phone: user.phone, 
            profileImage: user.profileImage || 'https://via.placeholder.com/120', 
            email: user.email 
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: Messages.SERVER_ERROR });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Check for authenticated user
        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: Messages.USER_NOT_FOUND });
        }

        // Validate input fields
        if (!currentPassword) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.CURRENT_PASSWORD_REQUIRED });
        }
        if (!newPassword) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.NEW_PASSWORD_REQUIRED });
        }
        if (!confirmPassword) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.CONFIRM_PASSWORD_REQUIRED });
        }
        if (newPassword !== confirmPassword) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.PASSWORDS_NOT_MATCH });
        }

        // Validate new password complexity
        const alpha = /[a-zA-Z]/;
        const digit = /\d/;
        if (newPassword.length < 8) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.PASSWORD_MIN_LENGTH });
        }
        if (!alpha.test(newPassword) || !digit.test(newPassword)) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.PASSWORD_COMPLEXITY });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.USER_NOT_FOUND });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.INCORRECT_CURRENT_PASSWORD });
        }

        // Check if new password is different from current password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.NEW_PASSWORD_SAME_AS_CURRENT });
        }

        // Hash and update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        // Destroy session for security
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
        });

        return res.json({ success: true, message: Messages.PASSWORD_UPDATED_SUCCESS });
    } catch (error) {
        console.error("Error changing password:", error);
        return res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: Messages.SERVER_ERROR });
    }
};

const sendEmailOtp = async (req, res) => {
    try {
        let { newEmail } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: Messages.USER_NOT_FOUND });
        }

        if (!newEmail) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.EMAIL_REQUIRED });
        }

        // Trim and validate email format
        newEmail = newEmail.trim().toLowerCase();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(newEmail)) {
            return res.json({ success: false, message: Messages.INVALID_EMAIL_FORMAT });
        }

        console.log("Received email:", newEmail);

        // Check if email is already in use
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.json({ success: false, message: Messages.EMAIL_EXISTS });
        }

        // Generate OTP
        const otp = generateOtp();
        console.log("Generated OTP:", otp);

        // Store OTP in session with expiry time (5 minutes)
        req.session.userOtp = {
            otp: otp,
            expiresAt: Date.now() + 5 * 60 * 1000, // OTP expires in 5 minutes
        };
        req.session.tempEmail = newEmail; // Store the new email temporarily

        // Send OTP
        const emailSent = await sendVerificationEmail(newEmail, otp);
        if (emailSent) {
            return res.json({ success: true, message: Messages.OTP_SUCCESS });
        } else {
            return res.json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        console.error("Error sending email OTP:", error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
    }
};



// Verify OTP and update email
const verifyEmailOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.session.user;
        const newEmail = req.session.tempEmail;

        if (!userId || !newEmail) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
        }

        // Retrieve stored OTP
        const storedOtpData = req.session.userOtp;

        if (!storedOtpData) {
            return res.json({ success: false, message: "OTP not found. Please request a new one." });
        }

        // Check if OTP is expired
        if (Date.now() > storedOtpData.expiresAt) {
            req.session.userOtp = null; // Clear expired OTP
            return res.json({ success: false, message: "OTP expired. Please request a new one." });
        }

        console.log("Stored OTP:", storedOtpData.otp);
        console.log("User entered OTP:", otp);

        // Check if OTP matches
        if (storedOtpData.otp !== otp) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        // Update email in database
        await User.findByIdAndUpdate(userId, { email: newEmail });

        // Clear OTP and temp email after successful verification
        req.session.userOtp = null;
        req.session.tempEmail = null;

        res.json({ success: true, message: "Email updated successfully" });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
    }
};

const resendEmailOtp = async (req, res) => {
    try {
        let { newEmail } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
        }

        if (!newEmail) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Email is required" });
        }

        newEmail = newEmail.trim().toLowerCase();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(newEmail)) {
            return res.json({ success: false, message: "Invalid email format" });
        }

        // Check if email is already in use by another user
        const existingUser = await User.findOne({ email: newEmail, _id: { $ne: userId } });
        if (existingUser) {
            return res.json({ success: false, message: "Email already registered" });
        }

        // Generate new OTP
        const otp = generateOtp();
        
        // Store OTP in session with expiry time (5 minutes)
        req.session.userOtp = {
            otp: otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
        };
        req.session.tempEmail = newEmail;
        console.log("Received email:", newEmail);

        // Send OTP
        const emailSent = await sendVerificationEmail(newEmail, otp);
        if (emailSent) {
            return res.json({ success: true, message: "OTP resent successfully" });
        } else {
            return res.json({ success: false, message: "Failed to resend OTP" });
        }
    } catch (error) {
        console.error("Error resending email OTP:", error);
        res.status(HttpStatus.SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
    }
};

// const changePassword = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         const { currentPassword, newPassword, confirmPassword } = req.body;

//         if (!userId) {
//             return res.redirect('/login');
//         }

//         if (!currentPassword || !newPassword || !confirmPassword) {
//             return res.redirect('/editProfile?message=All fields are required');
//         }

//         if (newPassword !== confirmPassword) {
//             return res.redirect('/editProfile?message=New passwords do not match');
//         }

//         const user = await User.findById(userId);
//         if (!user) {
//             return res.redirect('/login');
//         }

//         const isMatch = await bcrypt.compare(currentPassword, user.password);
//         if (!isMatch) {
//             return res.redirect('/editProfile?message=Incorrect current password');
//         }

//         const hashedPassword = await bcrypt.hash(newPassword, 10);
//         user.password = hashedPassword;
//         await user.save();

//         return res.redirect('/editProfile?message=Password updated successfully');
//     } catch (error) {
//         console.error("Error changing password:", error);
//         return res.redirect('/editProfile?message=Internal Server Error');
//     }
//};


// Get Address Management Page
const getAddresses = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            return res.redirect('/login');
        }

        console.log("Fetching addresses for user:", userId);

        const user = await User.findById(userId).populate('addresses');

        if (!user) {
            console.log("User not found, redirecting to login.");
            return res.redirect('/login');
        }

        res.render('addressManagement', { 
            user, 
            success: req.query.success || null 
        });
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(HttpStatus.SERVER_ERROR).send("Server Error");
    }
};




//  Add Address
const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            return res.redirect('/login');
        }

        console.log("Request Body:", req.body);

        const { name, phone, altPhone, city, landMark, state, pincode, isShippingAddress } = req.body;

        // Validate required fields
        if (!name || !phone || !city || !landMark || !state || !pincode) {
            console.log("Missing required fields:", { name, phone, city, landMark, state, pincode });
            return res.status(HttpStatus.BAD_REQUEST).send("All required fields (name, phone, city, landmark, state, pincode) must be provided.");
        }

        // Trim inputs to handle whitespace
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();
        const trimmedAltPhone = altPhone ? altPhone.trim() : '';
        const trimmedCity = city.trim();
        const trimmedLandMark = landMark.trim();
        const trimmedState = state.trim();
        const trimmedPincode = pincode.trim();

        // Re-check required fields after trimming
        if (!trimmedName || !trimmedPhone || !trimmedCity || !trimmedLandMark || !trimmedState || !trimmedPincode) {
            console.log("Required fields are empty after trimming:", { trimmedName, trimmedPhone, trimmedCity, trimmedLandMark, trimmedState, trimmedPincode });
            return res.status(HttpStatus.BAD_REQUEST).send("All required fields must not be empty after trimming whitespace.");
        }

        // Regex for letters and spaces only (no numbers or special characters)
        const lettersAndSpacesRegex = /^[A-Za-z\s]+$/;

        // Function to check if a string contains only spaces
        const isOnlySpaces = (str) => /^\s*$/.test(str);

        // Validate name
        if (isOnlySpaces(trimmedName)) {
            console.log("Name contains only spaces:", trimmedName);
            return res.status(HttpStatus.BAD_REQUEST).send("Name cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedName)) {
            console.log("Invalid name:", trimmedName);
            return res.status(HttpStatus.BAD_REQUEST).send("Name must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate city
        if (isOnlySpaces(trimmedCity)) {
            console.log("City contains only spaces:", trimmedCity);
            return res.status(HttpStatus.BAD_REQUEST).send("City cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedCity)) {
            console.log("Invalid city:", trimmedCity);
            return res.status(HttpStatus.BAD_REQUEST).send("City must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate landmark
        if (isOnlySpaces(trimmedLandMark)) {
            console.log("Landmark contains only spaces:", trimmedLandMark);
            return res.status(HttpStatus.BAD_REQUEST).send("Landmark cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedLandMark)) {
            console.log("Invalid landmark:", trimmedLandMark);
            return res.status(HttpStatus.BAD_REQUEST).send("Landmark must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate state
        if (isOnlySpaces(trimmedState)) {
            console.log("State contains only spaces:", trimmedState);
            return res.status(HttpStatus.BAD_REQUEST).send("State cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedState)) {
            console.log("Invalid state:", trimmedState);
            return res.status(HttpStatus.BAD_REQUEST).send("State must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate phone number
        const phoneRegex = /^[1-9][0-9]{9}$/;
        const phoneInvalidZeros = /^[1-9]0{9}$/;
        if (!phoneRegex.test(trimmedPhone) || phoneInvalidZeros.test(trimmedPhone)) {
            console.log("Invalid phone number:", trimmedPhone);
            return res.status(HttpStatus.BAD_REQUEST).send(
                trimmedPhone.length !== 10 ? "Phone number must be exactly 10 digits." :
                trimmedPhone.startsWith('0') ? "Phone number cannot start with 0." :
                "Remaining 9 digits of phone number cannot all be 0."
            );
        }

        // Validate alternate phone (if provided)
        if (trimmedAltPhone) {
            if (!phoneRegex.test(trimmedAltPhone) || phoneInvalidZeros.test(trimmedAltPhone)) {
                console.log("Invalid alternate phone number:", trimmedAltPhone);
                return res.status(HttpStatus.BAD_REQUEST).send(
                    trimmedAltPhone.length !== 10 ? "Alternate phone must be exactly 10 digits." :
                    trimmedAltPhone.startsWith('0') ? "Alternate phone cannot start with 0." :
                    "Remaining 9 digits of alternate phone cannot all be 0."
                );
            }
        }

        // Validate pincode
        const pincodeRegex = /^[1-9][0-9]{5}$/;
        const pincodeInvalidZeros = /^[1-9]0{5}$/;
        if (!pincodeRegex.test(trimmedPincode) || pincodeInvalidZeros.test(trimmedPincode)) {
            console.log("Invalid pincode:", trimmedPincode);
            return res.status(HttpStatus.BAD_REQUEST).send(
                trimmedPincode.length !== 6 ? "Pincode must be exactly 6 digits." :
                trimmedPincode.startsWith('0') ? "Pincode cannot start with 0." :
                "Remaining 5 digits of pincode cannot all be 0."
            );
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        const newAddress = new Address({
            userId: user._id,
            name: trimmedName,
            phone: trimmedPhone,
            altPhone: trimmedAltPhone,
            city: trimmedCity,
            landMark: trimmedLandMark,
            state: trimmedState,
            pincode: trimmedPincode,
            isShippingAddress: isShippingAddress === "on"
        });

        await newAddress.save();
        console.log("New Address Saved:", newAddress);

        user.addresses.push(newAddress._id);
        await user.save();
        console.log("User Updated:", user);

        console.log("Address added successfully!");
        return res.redirect("/address-management?success=Address added successfully!");
    } catch (error) {
        console.error("Error adding address:", error.stack);
        res.status(HttpStatus.SERVER_ERROR).send(`Server Error: ${error.message}`);
    }
};
//  Update Address
const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id;

        console.log("Updating address:", { userId, addressId });
        console.log("Request Body:", req.body);

        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            return res.redirect('/login');
        }

        const { name, phone, altPhone, city, landMark, state, pincode, isShippingAddress } = req.body;

        // Validate required fields
        if (!name || !phone || !city || !landMark || !state || !pincode) {
            console.log("Missing required fields:", { name, phone, city, landMark, state, pincode, altPhone });
            return res.status(HttpStatus.BAD_REQUEST).send("All required fields (name, phone, city, landmark, state, pincode) must be provided.");
        }

        // Trim inputs to handle whitespace
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();
        const trimmedAltPhone = altPhone ? altPhone.trim() : '';
        const trimmedCity = city.trim();
        const trimmedLandMark = landMark.trim();
        const trimmedState = state.trim();
        const trimmedPincode = pincode.trim();

        // Re-check required fields after trimming
        if (!trimmedName || !trimmedPhone || !trimmedCity || !trimmedLandMark || !trimmedState || !trimmedPincode) {
            console.log("Required fields are empty after trimming:", { trimmedName, trimmedPhone, trimmedCity, trimmedLandMark, trimmedState, trimmedPincode });
            return res.status(HttpStatus.BAD_REQUEST).send("All required fields must not be empty after trimming whitespace.");
        }

        // Regex for letters and spaces only (no numbers or special characters)
        const lettersAndSpacesRegex = /^[A-Za-z\s]+$/;

        // Function to check if a string contains only spaces
        const isOnlySpaces = (str) => /^\s*$/.test(str);

        // Validate name
        if (isOnlySpaces(trimmedName)) {
            console.log("Name contains only spaces:", trimmedName);
            return res.status(HttpStatus.BAD_REQUEST).send("Name cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedName)) {
            console.log("Invalid name:", trimmedName);
            return res.status(HttpStatus.BAD_REQUEST).send("Name must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate city
        if (isOnlySpaces(trimmedCity)) {
            console.log("City contains only spaces:", trimmedCity);
            return res.status(HttpStatus.BAD_REQUEST).send("City cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedCity)) {
            console.log("Invalid city:", trimmedCity);
            return res.status(HttpStatus.BAD_REQUEST).send("City must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate landmark
        if (isOnlySpaces(trimmedLandMark)) {
            console.log("Landmark contains only spaces:", trimmedLandMark);
            return res.status(HttpStatus.BAD_REQUEST).send("Landmark cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedLandMark)) {
            console.log("Invalid landmark:", trimmedLandMark);
            return res.status(HttpStatus.BAD_REQUEST).send("Landmark must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate state
        if (isOnlySpaces(trimmedState)) {
            console.log("State contains only spaces:", trimmedState);
            return res.status(HttpStatus.BAD_REQUEST).send("State cannot contain only spaces.");
        }
        if (!lettersAndSpacesRegex.test(trimmedState)) {
            console.log("Invalid state:", trimmedState);
            return res.status(HttpStatus.BAD_REQUEST).send("State must contain only letters and spaces (no numbers or special characters).");
        }

        // Validate phone number
        const phoneRegex = /^[1-9][0-9]{9}$/;
        const phoneInvalidZeros = /^[1-9]0{9}$/;
        if (!phoneRegex.test(trimmedPhone) || phoneInvalidZeros.test(trimmedPhone)) {
            console.log("Invalid phone number:", trimmedPhone);
            return res.status(HttpStatus.BAD_REQUEST).send(
                trimmedPhone.length !== 10 ? "Phone number must be exactly 10 digits." :
                trimmedPhone.startsWith('0') ? "Phone number cannot start with 0." :
                "Remaining 9 digits of phone number cannot all be 0."
            );
        }

        // Validate alternate phone (if provided)
        if (trimmedAltPhone) {
            if (!phoneRegex.test(trimmedAltPhone) || phoneInvalidZeros.test(trimmedAltPhone)) {
                console.log("Invalid alternate phone number:", trimmedAltPhone);
                return res.status(HttpStatus.BAD_REQUEST).send(
                    trimmedAltPhone.length !== 10 ? "Alternate phone must be exactly 10 digits." :
                    trimmedAltPhone.startsWith('0') ? "Alternate phone cannot start with 0." :
                    "Remaining 9 digits of alternate phone cannot all be 0."
                );
            }
        }

        // Validate pincode
        const pincodeRegex = /^[1-9][0-9]{5}$/;
        const pincodeInvalidZeros = /^[1-9]0{5}$/;
        if (!pincodeRegex.test(trimmedPincode) || pincodeInvalidZeros.test(trimmedPincode)) {
            console.log("Invalid pincode:", trimmedPincode);
            return res.status(HttpStatus.BAD_REQUEST).send(
                trimmedPincode.length !== 6 ? "Pincode must be exactly 6 digits." :
                trimmedPincode.startsWith('0') ? "Pincode cannot start with 0." :
                "Remaining 5 digits of pincode cannot all be 0."
            );
        }

        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            console.log("Address not found for user:", { addressId, userId });
            return res.status(HttpStatus.NOT_FOUND).send("Address not found.");
        }

        console.log("Current Address:", address);

        address.name = trimmedName;
        address.phone = trimmedPhone;
        address.altPhone = trimmedAltPhone;
        address.city = trimmedCity;
        address.landMark = trimmedLandMark;
        address.state = trimmedState;
        address.pincode = trimmedPincode;
        address.isShippingAddress = isShippingAddress === "on";

        await address.save();
        console.log("Updated Address:", address);

        console.log("Address updated successfully!");
        res.redirect('/address-management?success=Address updated successfully!');
    } catch (error) {
        console.error("Error updating address:", error.stack);
        res.status(HttpStatus.SERVER_ERROR).send(`Server Error: ${error.message}`);
    }
};
// 📌 Delete Address
const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user; // Get user ID from session
        const addressId = req.params.id; // Get address ID from URL

        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            return res.redirect('/login');
        }

        console.log(`Deleting address ${addressId} for user ${userId}`);

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(HttpStatus.NOT_FOUND).send("User not found.");
        }

        // Check if the address exists in the user's address list
        if (!user.addresses.includes(addressId)) {
            return res.status(HttpStatus.NOT_FOUND).send("Address not found.");
        }

        // Remove the address reference from the user's list
        user.addresses = user.addresses.filter(addr => addr.toString() !== addressId);
        await user.save();

        // Remove the address from the Address collection
        await Address.findByIdAndDelete(addressId);

        console.log("Address deleted successfully!");

        // ✅ Redirect to Address Management with a success message
        res.redirect('/address-management?success=Address deleted successfully');
    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(HttpStatus.SERVER_ERROR).send("Server Error");
    }
};


// 📌 Set Default Shipping Address
const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id;

        console.log("User ID:", userId);
        console.log("Address ID:", addressId);

        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if (!user) {
            console.log("User not found for ID:", userId);
            return res.status(HttpStatus.NOT_FOUND).send("User not found.");
        }

        console.log("User addresses:", user.addresses);

        // Convert addressId to ObjectId and check if it exists in addresses
        const addressIdObj =new mongoose.Types.ObjectId(addressId);
        if (!user.addresses.some(addr => addr.equals(addressIdObj))) {
            console.log("Address not found in user's addresses:", addressId);
            return res.status(HttpStatus.NOT_FOUND).send("Address not found.");
        }

        // Update the default shipping address
        user.shippingAddress = addressIdObj; // Use ObjectId
        await user.save();

        console.log("Updated user:", user);
        console.log("Default address set successfully!");

        res.redirect('/address-management?success=Default address updated successfully');
    } catch (error) {
        console.error("Error setting default address:", error.stack);
        res.status(HttpStatus.SERVER_ERROR).send(`Server Error: ${error.message}`);
    }
};







module.exports={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    getUserProfile,
    //getEditProfile,
    updateProfile,
    sendEmailOtp,
    verifyEmailOtp,
    changePassword,
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    resendEmailOtp


    
    

}