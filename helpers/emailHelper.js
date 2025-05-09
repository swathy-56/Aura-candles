const nodemailer = require('nodemailer');
require('dotenv').config();



const sendVerificationEmail=async(email,otp)=>{
    try {
        
        const transporter=nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })



        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:'Your OTP for password reset',
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP:${otp}</h4><br></b>`
        }

        const info=await transporter.sendMail(mailOptions);
        console.log('Email sent:',info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email',error);
        return false;
    }
};

module.exports=sendVerificationEmail;