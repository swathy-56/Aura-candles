const User=require('../models/userSchema');

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
           res.status(500).send('Internal Server Error');
        })
    }else{
        res.redirect('/login')
    }
}


const adminAuth = (req, res, next) => {
    console.log("Admin Auth Middleware - Session Data:", req.session);
    
    if (req.session.admin) {
        User.findById(req.session.admin)
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
            res.status(500).send('Internal Server Error');
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