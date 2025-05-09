const User=require('../../models/userSchema');
const Order=require('../../models/orderSchema');
const Address=require('../../models/addressSchema');
const sendVerificationEmail = require('../../helpers/emailHelper');
const generateOtp = require('../../helpers/otpHelper');
const securePassword = require('../../helpers/passwordHelper');
const session=require('express-session');
const bcrypt=require('bcrypt');
const mongoose=require('mongoose');




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
                res.json({success:false,message:'Failed to send OTP.Please try again'});
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

//verify otp for password Reset
// const verifyForgotPassOtp=async(req,res)=>{
//     try {
        

//         console.log("Stored OTP:", req.session.userOtp);
//         console.log("Entered OTP:", enteredOtp);
//         const enteredOtp=req.body.otp;

//         if (!otpRegex.test(enteredOtp)) {
//             return res.json({ success: false, message: 'Invalid OTP format' });
//         }

//         if(enteredOtp === req.session.userOtp){
//             res.json({success:true,redirectUrl:'/reset-password'});
//         }else{
//             res.json({success:false,message:"OTP not matching"});
//         }
//     } catch (error) {
//         res.status(500).json({success:false,message:'An error occured.Please try again'});
//     }
// }


const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const otpRegex = /^[0-9]{6}$/;

        console.log("Session Data:", req.session);
        console.log("Stored OTP:", req.session.userOtp, "Type:", typeof req.session.userOtp);
        console.log("Entered OTP:", enteredOtp, "Type:", typeof enteredOtp);

        if (!otpRegex.test(enteredOtp)) {
            return res.json({ success: false, message: 'Invalid OTP format' });
        }

        if (enteredOtp.toString() === req.session.userOtp.toString()) {
            res.json({ success: true, redirectUrl: '/reset-password' });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
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
            res.status(200).json({success:true,message:'Resend OTP Successful'});
        }
    } catch (error) {
        console.error('Error in resend otp',error);
        res.status(500).json({success:false,message:'Internal Server Error'})
    }
}


//new password
// const postNewPassword = async (req, res) => {
//     try {

//         console.log("Request method:", req.method);
//         const { newPass1, newPass2 } = req.body;
//         const email = req.session.email;

       
//         if (newPass1 !== newPass2) {
//             return res.render('reset-password', { message: 'Passwords do not match' });
//         }

//         const passwordHash = await securePassword(newPass1);
//         await User.updateOne({ email }, { $set: { password: passwordHash } });

//         res.redirect('/login');
//     } catch (error) {
//         res.redirect('/pageNotFound');
//     }
// };

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


// const getEditProfile = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         const userData = await User.findById(userId);

//         // Get message from query parameters (if any)
//         const message = req.query.message || '';

//         res.render('editProfile', { user: userData, message }); // Pass `message` to EJS
//     } catch (error) {
//         console.error('Error loading edit profile page:', error);
//         res.redirect('/pageNotFound');
//     }
// };


// const updateProfile = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         if (!userId) {
//             return res.status(401).redirect("/login");
//         }

//         const { name, phone } = req.body;
//         const user = await User.findById(userId);

//         if (!user) {
//             return res.status(404).redirect("/account?error=User not found");
//         }

//         // **🔹 Backend Validation for Name & Phone**
//         const nameRegex = /^[A-Za-z\s]{3,}$/;
//         const phoneRegex = /^\d{10}$/;

//         if (!nameRegex.test(name)) {
//             return res.redirect("/editProfile?error=Invalid name format. Must be at least 3 letters.");
//         }

//         if (!phoneRegex.test(phone)) {
//             return res.redirect("/editProfile?error=Invalid phone number. Must be 10 digits.");
//         }

//         // **🔹 Update Name & Phone**
//         user.name = name;
//         user.phone = phone;

//         console.log("Received data:", req.body);

//         // **🔹 Handle Profile Image Update**
//         if (req.file) {
//             user.profileImage = `/uploads/${req.file.filename}`;
//             console.log("Updated profile image path:", user.profileImage);
//         }

//         await user.save();

//         req.session.user = userId;
//         res.redirect("/account?success=Profile updated successfully"); 
//     } catch (error) {
//         console.error("Error updating profile:", error);
//         res.status(500).redirect("/editProfile?error=Something went wrong");
//     }
// };

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { name, phone } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const nameRegex = /^[A-Za-z\s]{3,}$/;
        const phoneRegex = /^\d{10}$/;

        if (!nameRegex.test(name)) {
            return res.json({ success: false, message: 'Invalid name format. Must be at least 3 letters.' });
        }

        if (!phoneRegex.test(phone)) {
            return res.json({ success: false, message: 'Invalid phone number. Must be 10 digits.' });
        }

        user.name = name;
        user.phone = phone;

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
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "New passwords do not match" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Incorrect current password" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Error changing password:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const sendEmailOtp = async (req, res) => {
    try {
        let { newEmail } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!newEmail) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        // Trim and validate email format
        newEmail = newEmail.trim().toLowerCase();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(newEmail)) {
            return res.json({ success: false, message: "Invalid email format" });
        }

        console.log("Received email:", newEmail);

        // Check if email is already in use
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.json({ success: false, message: "Email already registered" });
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
            return res.json({ success: true, message: "OTP sent successfully" });
        } else {
            return res.json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        console.error("Error sending email OTP:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};



// Verify OTP and update email
const verifyEmailOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.session.user;
        const newEmail = req.session.tempEmail;

        if (!userId || !newEmail) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
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
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const resendEmailOtp = async (req, res) => {
    try {
        let { newEmail } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!newEmail) {
            return res.status(400).json({ success: false, message: "Email is required" });
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
        res.status(500).json({ success: false, message: "Internal Server Error" });
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


// 📌 Get Address Management Page
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
            success: req.query.success || null // ✅ Pass success message to EJS
        });
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(500).send("Server Error");
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

        console.log("Request Body:", req.body); // Log incoming data

        const { name, phone, altPhone, city, landMark, state, pincode, isShippingAddress } = req.body;

        if (!name || !phone || !city || !landMark || !state || !pincode) {
            return res.status(400).send("All fields are required.");
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        const newAddress = new Address({
            userId: user._id,
            name,
            phone,
            altPhone,
            city,
            landMark,
            state,
            pincode,
            isShippingAddress: isShippingAddress === "on"
        });

        await newAddress.save();
        console.log("New Address Saved:", newAddress);

        user.addresses.push(newAddress._id);
        await user.save();
        console.log("User Updated:", user);

        console.log("Address added successfully!");
        // if (from === "checkout") {
        //     return res.redirect("/checkout?success=Address added successfully!");
        //   } else {
            return res.redirect("/address-management?success=Address added successfully!");
          //}
    } catch (error) {
        console.error("Error adding address:", error.stack); // Log full error stack
        res.status(500).send(`Server Error: ${error.message}`); // Send error message to client
    }
};
// 📌 Update Address
const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id;

        console.log("Updating address:", { userId, addressId }); // Log user and address IDs
        console.log("Request Body:", req.body); // Log incoming form data

        if (!userId) {
            console.log("User not authenticated, redirecting to login.");
            return res.redirect('/login');
        }

        const { name, phone, altPhone, city, landMark, state, pincode, isShippingAddress } = req.body;

        // Check if all required fields are present
        if (!name || !phone || !city || !landMark || !state || !pincode) {
            console.log("Missing required fields:", { name, phone, city, landMark, state, pincode });
            return res.status(400).send("All fields are required.");
        }

        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            console.log("Address not found for user:", { addressId, userId });
            return res.status(404).send("Address not found.");
        }

        console.log("Current Address:", address); // Log address before update

        address.name = name;
        address.phone = phone;
        address.altPhone = altPhone || ""; // Handle optional field
        address.city = city;
        address.landMark = landMark;
        address.state = state;
        address.pincode = pincode;
        address.isShippingAddress = isShippingAddress === "on"; // Ensure boolean conversion

        await address.save();
        console.log("Updated Address:", address); // Log address after update

        console.log("Address updated successfully!");
        res.redirect('/address-management?success=Address updated successfully!');
    } catch (error) {
        console.error("Error updating address:", error.stack); // Log full error stack
        res.status(500).send(`Server Error: ${error.message}`); // Send specific error message
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
            return res.status(404).send("User not found.");
        }

        // Check if the address exists in the user's address list
        if (!user.addresses.includes(addressId)) {
            return res.status(404).send("Address not found.");
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
        res.status(500).send("Server Error");
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
            return res.status(404).send("User not found.");
        }

        console.log("User addresses:", user.addresses);

        // Convert addressId to ObjectId and check if it exists in addresses
        const addressIdObj =new mongoose.Types.ObjectId(addressId);
        if (!user.addresses.some(addr => addr.equals(addressIdObj))) {
            console.log("Address not found in user's addresses:", addressId);
            return res.status(404).send("Address not found.");
        }

        // Update the default shipping address
        user.shippingAddress = addressIdObj; // Use ObjectId
        await user.save();

        console.log("Updated user:", user);
        console.log("Default address set successfully!");

        res.redirect('/address-management?success=Default address updated successfully');
    } catch (error) {
        console.error("Error setting default address:", error.stack);
        res.status(500).send(`Server Error: ${error.message}`);
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