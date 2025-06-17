const User=require('../models/userSchema');
const { HttpStatus } = require("../shared/constants");

const userAuth=(req,res,next)=>{
    console.log('Session data:', req.session);
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                res.redirect('/login')
            }
        })
        .catch(error=>{
           console.log('Error in user auth middleware');
           res.status(HttpStatus.SERVER_ERROR).send('Internal Server Error');
        })
    }else{
        res.redirect('/login')
    }
}


const adminAuth = (req, res, next) => {
    
    if (req.session.admin) {
        User.findById(req.session.admin._id)
        .then(data => {
            if (data) {
                next();
            } else {
                console.log("Admin not found in DB");
                res.redirect('/admin/login');
            }
        })
        .catch(error => {
            console.log('Error in admin auth middleware', error);
            res.status(HttpStatus.SERVER_ERROR).send('Internal Server Error');
        });
    } else {
        console.log("Session admin not found. Redirecting to login.");
        res.redirect('/admin/login');
    }
};


module.exports={
    userAuth,
    adminAuth
}